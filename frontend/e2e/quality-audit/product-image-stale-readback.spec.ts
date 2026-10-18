import {randomUUID} from "node:crypto";
import {mkdir,readFile,writeFile} from "node:fs/promises";
import {join} from "node:path";
import {expect,test,type Page} from "@playwright/test";
import {establishSeedRoleSession,LOCAL_SEED_ENTITY_IDS as ids} from "../support/seed-auth";
import {localAuditTargets} from "./fixture-guard";
import {writeActionLedger,type ActionOutcome} from "./result-ledger";

const at="2026-10-17T12:00:00.000Z",root="/api/v1/organizations/"+ids.organizationId,endpoint=root+"/products/"+ids.productId;
const product={productId:ids.productId,organizationId:ids.organizationId,storeId:ids.storeId,name:"UXQA Shirt",description:"Synthetic",status:"ACTIVE",imageKey:null as string|null,imageUrl:null,variants:[],createdAt:at,updatedAt:at};
const store={storeId:ids.storeId,organizationId:ids.organizationId,name:"UXQA Store",description:"Synthetic",status:"ACTIVE",createdAt:at,updatedAt:at};
const imageKey="uxqa-eventual-readback-key";
const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y2A2SYAAAAASUVORK5CYII=","base64");
type Proof={id:"FE-UX-18-15";state:string;role:"organizationAdmin";viewport:"390x844";image:string;note:string};

test("repeated stale/mismatched GET never triggers duplicate upload or false success",async({browser,request})=>{
 test.setTimeout(150000);
 const {frontend}=localAuditTargets(),runId="uxqa-"+randomUUID(),dir=join("test-results","quality-audit",runId);
 await mkdir(dir,{recursive:true});
 const proofs:Proof[]=[];
 let signs=0,puts=0,patches=0,gets=0,blocked=0,dispatched=false;
 let mode:"stale"|"error"|"other"|"matching"="stale";
 const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:"reduce"});
 await establishSeedRoleSession(ctx,request,"organizationAdmin");
 await ctx.route("**/*",async route=>{
  const q=route.request(),p=new URL(q.url()).pathname,m=q.method();
  const ok=(data:unknown)=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({success:true,data})});
  if(m==="GET"&&p===root+"/stores")return ok({items:[store],nextCursor:null});
  if(m==="GET"&&p===root+"/products")return ok({items:[product],nextCursor:null});
  if(m==="GET"&&p===endpoint){
   if(dispatched)gets++;
   if(!dispatched||mode==="stale")return ok(product);
   if(mode==="other")return ok({...product,imageKey:"another-upload-key"});
   if(mode==="matching")return ok({...product,imageKey});
   return route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({success:false,error:{code:"SERVICE_UNAVAILABLE",message:"UXQA simulated stale GET outage"}})});
  }
  if(m==="POST"&&p===endpoint+"/image-upload-url"){
   signs++;return ok({objectKey:imageKey,method:"PUT",url:frontend+"/__uxqa_long_stale__/image",expiresInSeconds:900});
  }
  if(m==="PUT"&&p==="/__uxqa_long_stale__/image"){
   puts++;return route.fulfill({status:200,body:""});
  }
  if(m==="PATCH"&&p===endpoint){
   patches++;expect(q.postDataJSON()).toEqual({imageKey});dispatched=true;
   return route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({success:false,error:{code:"SERVICE_UNAVAILABLE",message:"UXQA ambiguous PATCH after server commit"}})});
  }
  if(!["GET","HEAD","OPTIONS"].includes(m)){blocked++;return route.abort("blockedbyclient");}
  return route.continue();
 });
 async function snap(page:Page,state:string,note:string){
  const image="FE-UX-18-15-"+state+".png";await page.screenshot({path:join(dir,image),animations:"disabled"});
  proofs.push({id:"FE-UX-18-15",state,image,role:"organizationAdmin",viewport:"390x844",note});
 }
 const url=frontend+"/org/products/?organizationId="+ids.organizationId;
 async function edit(page:Page){
  const card=page.getByRole("heading",{name:product.name,exact:true}).first().locator("xpath=ancestor::article");
  await expect(card).toBeVisible();await card.getByRole("button",{name:"แก้ไขข้อมูล"}).click();
  await expect(page.locator("#product-image-"+ids.productId)).toBeVisible();
 }
 try{
  const page=await ctx.newPage();
  await page.goto(url,{waitUntil:"domcontentloaded"});
  await edit(page);
  await page.locator("#product-image-"+ids.productId).setInputFiles({name:"long-stale.png",mimeType:"image/png",buffer:png});
  await page.getByRole("button",{name:"อัปโหลดรูปสินค้า"}).click();
  const retry=page.getByRole("button",{name:"ตรวจสอบข้อมูลล่าสุดอีกครั้ง"});
  await expect(retry).toBeEnabled();
  await expect(page.getByText(/ส่งคำขอบันทึกรูปไปแล้ว แต่ยังยืนยันผลไม่ได้/)).toBeVisible();
  await snap(page,"long-stale-ambiguous-start","Ambiguous PATCH 503 keeps GET-only recovery without a second POST/PUT/PATCH");
  for(let i=0;i<3;i++){
   const before=gets;
   await retry.click();
   await expect.poll(()=>gets).toBe(before+1);
   await expect(page.getByText(/ยังยืนยันผลการบันทึกรูปไม่ได้/)).toBeVisible();
   await expect(retry).toBeEnabled();
   await expect(page.getByRole("button",{name:"อัปโหลดรูปสินค้า"})).toHaveCount(0);
   expect([signs,puts,patches]).toEqual([1,1,1]);
  }
  await expect(page.getByText(/ตรวจสอบหลายครั้งแล้วยังไม่ยืนยันผล/)).toBeVisible();
  await expect(page.getByText(/กรุณาติดต่อผู้ดูแลระบบพร้อมรหัสสินค้าและอย่าเพิ่งอัปโหลดรูปซ้ำ/)).toBeVisible();
  await snap(page,"three-stale-GETs-no-write","Three stale GET retries show support guidance without permitting duplicate upload");
  mode="other";
  await retry.click();
  await expect(page.getByText(/ยังยืนยันผลการบันทึกรูปไม่ได้/)).toBeVisible();
  await expect(retry).toBeEnabled();
  expect([signs,puts,patches]).toEqual([1,1,1]);
  await snap(page,"conflicting-image-key-remains-unverified","Other imageKey from server is NOT accepted as proof that expected upload persisted");
  mode="error";
  await retry.click();
  await expect(page.getByText(/ส่งคำขอบันทึกรูปไปแล้ว แต่ยังยืนยันผลไม่ได้/)).toBeVisible();
  await expect(retry).toBeEnabled();
  await snap(page,"GET-503-after-stale","Subsequent GET 503 does not clear pending key or allow duplicate write");
  mode="stale";
  await page.reload({waitUntil:"domcontentloaded"});
  await edit(page);
  const retryAfterReload=page.getByRole("button",{name:"ตรวจสอบข้อมูลล่าสุดอีกครั้ง"});
  await expect(retryAfterReload).toBeEnabled();
  await expect(page.getByText(/สถานะการบันทึกรูปยังไม่ชัดเจน/)).toBeVisible();
  await snap(page,"reload-after-prolonged-stale","After repeated stale GET and reload, conservative marker restores readback-only UI");
  mode="matching";
  await retryAfterReload.click();
  await expect(page.getByText("อัปโหลดและบันทึกรูปสินค้าเรียบร้อยแล้ว")).toBeVisible();
  await expect(page.getByText(/ตรวจสอบหลายครั้งแล้วยังไม่ยืนยันผล/)).toHaveCount(0);
  await expect(page.getByText("มีรูปสินค้าแล้ว").last()).toBeVisible();
  expect([signs,puts,patches,blocked]).toEqual([1,1,1,0]);
  await snap(page,"eventual-matching-key","Once matching GET arrives, recovery completes without any duplicate browser write");
  await page.close();
 }finally{await ctx.close();}
 const manifest=JSON.parse(await readFile("quality-audit/coverage-baseline.json","utf8")) as {actions:Array<{id:string;roles:string[];statesToTest:string[]}>;shellActions:Array<{id:string;roles:string[];statesToTest:string[]}>};
 const entries:ActionOutcome[]=[...manifest.actions,...manifest.shellActions].map(a=>({actionId:a.id,role:a.roles[0]!,state:"all-declared-states",viewport:"not-executed",status:"NOT_TESTED",testRunId:runId,evidence:[],notes:"Full declared-state matrix not certified: "+a.statesToTest.join(", ")}));
 for(const p of proofs)entries.push({actionId:p.id,role:p.role,state:p.state,viewport:p.viewport,status:"PASS",testRunId:runId,evidence:[p.image],notes:p.note+"; synthetic product reads and intercepted writes"});
 await writeActionLedger(runId,entries);
 await writeFile(join(dir,"prolonged-stale-readback.json"),JSON.stringify({engine:browser.browserType().name(),proofs,signs,puts,patches,gets,blocked,realBusinessWrites:0,limitations:"Manual GET retry loop with mocked eventual consistency; not proof of actual backend stability or a timeout guarantee."},null,2)+"\n");
});
