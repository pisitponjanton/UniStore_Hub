import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { establishSeedRoleSession, LOCAL_SEED_ENTITY_IDS as ids } from "../support/seed-auth";
import { localAuditTargets } from "./fixture-guard";
import { writeActionLedger, type ActionOutcome } from "./result-ledger";

const at="2026-10-17T12:00:00.000Z",root="/api/v1/organizations/"+ids.organizationId;
const idB="77777777-7777-4777-8777-777777777778",imageKey="uxqa-late-readback";
const a={productId:ids.productId,organizationId:ids.organizationId,storeId:ids.storeId,name:"UXQA Product A",description:"synthetic",status:"ACTIVE",imageKey:null as string|null,imageUrl:null,variants:[],createdAt:at,updatedAt:at};
const b={...a,productId:idB,name:"UXQA Product B"};
const store={storeId:ids.storeId,organizationId:ids.organizationId,name:"UXQA Store",description:"synthetic",status:"ACTIVE",createdAt:at,updatedAt:at};
const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y2A2SYAAAAASUVORK5CYII=","base64");
type Proof={id:"FE-UX-18-15";role:"organizationAdmin";state:string;viewport:"390x844";image:string;note:string};
test("late image GET response cannot replace a different selected Product",async({browser,request})=>{
 test.setTimeout(135000);
 const {frontend}=localAuditTargets(),runId="uxqa-"+randomUUID(),dir=join("test-results","quality-audit",runId);
 await mkdir(dir,{recursive:true});
 const proofs:Proof[]=[];let committed=false,signs=0,puts=0,patches=0,afterPatchReads=0,finishedReads=0,blocked=0;
 const hold:{release?:()=>void}={};
 const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:"reduce"});
 await establishSeedRoleSession(ctx,request,"organizationAdmin");
 await ctx.route("**/*",async route=>{
  const q=route.request(),p=new URL(q.url()).pathname,m=q.method();
  const ok=(data:unknown)=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({success:true,data})});
  if(m==="GET"&&p===root+"/stores")return ok({items:[store],nextCursor:null});
  if(m==="GET"&&p===root+"/products")return ok({items:[committed?{...a,imageKey}:a,b],nextCursor:null});
  if(m==="GET"&&p===root+"/products/"+idB)return ok(b);
  if(m==="GET"&&p===root+"/products/"+ids.productId){
   if(!committed)return ok(a);
   afterPatchReads++;
   if(afterPatchReads===1)await new Promise<void>(resolve=>{hold.release=resolve;});
   finishedReads++;
   return ok({...a,imageKey});
  }
  if(m==="POST"&&p===root+"/products/"+ids.productId+"/image-upload-url"){
   signs++;expect(q.postDataJSON()).toEqual({contentType:"image/png"});
   return ok({objectKey:imageKey,method:"PUT",url:frontend+"/__uxqa_inflight_switch__/image",expiresInSeconds:900});
  }
  if(m==="PUT"&&p==="/__uxqa_inflight_switch__/image"){
   puts++;return route.fulfill({status:200,body:""});
  }
  if(m==="PATCH"&&p===root+"/products/"+ids.productId){
   patches++;expect(q.postDataJSON()).toEqual({imageKey});committed=true;
   return ok({...a,imageKey});
  }
  if(!["GET","HEAD","OPTIONS"].includes(m)){blocked++;return route.abort("blockedbyclient");}
  return route.continue();
 });
 async function snap(page:Page,state:string,note:string){
  const image="FE-UX-18-15-"+state+".png";
  await page.screenshot({path:join(dir,image),animations:"disabled"});
  proofs.push({id:"FE-UX-18-15",role:"organizationAdmin",state,viewport:"390x844",image,note});
 }
 async function edit(page:Page,name:string){
  const heading=page.getByRole("heading",{name,exact:true}).first();
  await expect(heading).toBeVisible();
  await heading.locator("xpath=ancestor::article").getByRole("link",{name:"แก้ไขสินค้า"}).click();
  await expect(page.getByRole("heading",{name:"รูปสินค้า"})).toBeVisible();
 }
 try{
  const page=await ctx.newPage();
  await page.goto(frontend+"/org/stores/view/?organizationId="+ids.organizationId+"&storeId="+ids.storeId+"&tab=products",{waitUntil:"domcontentloaded"});
  await edit(page,a.name);
  await page.locator("#product-image-"+ids.productId).setInputFiles({name:"uxqa-inflight.png",mimeType:"image/png",buffer:png});
  await page.getByRole("button",{name:"อัปโหลดรูปสินค้า"}).click();
  await expect.poll(()=>afterPatchReads).toBe(1);
  await expect(page.getByRole("button",{name:"กำลังตรวจสอบข้อมูลล่าสุด"})).toBeDisabled();
  await snap(page,"inflight-readback-pending","Readback GET is intentionally held after a single acknowledged PATCH");

  await page.getByRole("link",{name:/กลับไปรายการสินค้า/}).click();
  await edit(page,b.name);
  await expect(page.locator("#product-image-"+idB)).toBeEnabled();
  await expect(page.getByRole("button",{name:"ตรวจสอบข้อมูลล่าสุดอีกครั้ง"})).toHaveCount(0);
  await snap(page,"switch-while-A-inflight","B is selected while A has a pending GET, without inheriting pending state");

  hold.release?.();
  await expect.poll(()=>finishedReads).toBe(1);
  await expect(page.locator("#product-image-"+idB)).toBeEnabled();
  await expect(page.getByText("รหัสสินค้า: "+idB)).toBeVisible();
  await expect(page.locator("#product-image-"+ids.productId)).toHaveCount(0);
  await snap(page,"late-A-result-ignored-for-B","Late successful GET for A cannot replace B's editor after unmount");

  await page.getByRole("link",{name:/กลับไปรายการสินค้า/}).click();
  await edit(page,a.name);
  await expect(page.getByText("มีรูปสินค้าแล้ว").last()).toBeVisible();
  await expect(page.getByRole("button",{name:"ตรวจสอบข้อมูลล่าสุดอีกครั้ง"})).toHaveCount(0);
  expect([signs,puts,patches,blocked]).toEqual([1,1,1,0]);
  await snap(page,"return-A-verified","A can be reopened without reupload; late GET completed verification");
  await page.close();
 }finally{hold.release?.();await ctx.close();}
 const manifest=JSON.parse(await readFile("quality-audit/coverage-baseline.json","utf8")) as {actions:Array<{id:string;roles:string[];statesToTest:string[]}>;shellActions:Array<{id:string;roles:string[];statesToTest:string[]}>};
 const entries:ActionOutcome[]=[...manifest.actions,...manifest.shellActions].map(e=>({actionId:e.id,role:e.roles[0]!,state:"all-declared-states",viewport:"not-executed",status:"NOT_TESTED",testRunId:runId,evidence:[],notes:"Not an exhaustive state matrix: "+e.statesToTest.join(", ")}));
 for(const p of proofs)entries.push({actionId:p.id,role:p.role,state:p.state,viewport:p.viewport,status:"PASS",testRunId:runId,evidence:[p.image],notes:p.note+"; synthetic Browser writes only"});
 await writeActionLedger(runId,entries);
 await writeFile(join(dir,"inflight-product-switch.json"),JSON.stringify({browserEngine:browser.browserType().name(),proofs,signs,puts,patches,afterPatchReads,finishedReads,blocked,realWrites:0},null,2)+"\n");
});
