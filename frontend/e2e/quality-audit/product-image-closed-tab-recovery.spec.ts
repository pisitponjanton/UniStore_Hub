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
const imageKey="uxqa-tabclosed-inflight-patch";
const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y2A2SYAAAAASUVORK5CYII=","base64");
type Proof={id:"FE-UX-18-15";state:string;role:"organizationAdmin";viewport:"390x844";image:string;note:string};
test("closing tab loses per-tab PATCH marker but a new tab offers explicit GET-only refresh",async({browser,request})=>{
 test.setTimeout(150000);
 const {frontend}=localAuditTargets(),runId="uxqa-"+randomUUID(),dir=join("test-results","quality-audit",runId);
 await mkdir(dir,{recursive:true});
 const proof:Proof[]=[];
 let sign=0,put=0,patch=0,reads=0,blocked=0,committed=false,showCurrent=false;
 const hold:{release?:()=>void}={};
 const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:"reduce"});
 await establishSeedRoleSession(ctx,request,"organizationAdmin");
 await ctx.route("**/*",async route=>{
  const req=route.request(),p=new URL(req.url()).pathname,m=req.method();
  const ok=(data:unknown)=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({success:true,data})});
  if(m==="GET"&&p===root+"/stores")return ok({items:[store],nextCursor:null});
  if(m==="GET"&&p===root+"/products")return ok({items:[product],nextCursor:null});
  if(m==="GET"&&p===endpoint){if(committed)reads++;return ok(showCurrent?{...product,imageKey}:product);}
  if(m==="POST"&&p===endpoint+"/image-upload-url"){
   sign++;expect(req.postDataJSON()).toEqual({contentType:"image/png"});
   return ok({objectKey:imageKey,method:"PUT",url:frontend+"/__uxqa_newtab__/image",expiresInSeconds:900});
  }
  if(m==="PUT"&&p==="/__uxqa_newtab__/image"){
   put++;return route.fulfill({status:200,body:""});
  }
  if(m==="PATCH"&&p===endpoint){
   patch++;expect(req.postDataJSON()).toEqual({imageKey});
   committed=true;
   await new Promise<void>(resolve=>{hold.release=resolve;});
   try{return await route.abort("failed");}catch{return;}
  }
  if(!["GET","HEAD","OPTIONS"].includes(m)){blocked++;return route.abort("blockedbyclient");}
  return route.continue();
 });
 const tabMarker=(page:Page)=>page.evaluate(()=>Object.entries(sessionStorage).filter(([key])=>key.includes("productImageVerification.v1")).map(([,value])=>value));
 async function snap(page:Page,state:string,note:string){
  const image="FE-UX-18-15-"+state+".png";
  await page.screenshot({path:join(dir,image),animations:"disabled"});
  proof.push({id:"FE-UX-18-15",role:"organizationAdmin",state,image,note,viewport:"390x844"});
 }
 const url=frontend+"/org/products/?organizationId="+ids.organizationId;
 async function editor(page:Page){
  const card=page.getByRole("heading",{name:product.name,exact:true}).first().locator("xpath=ancestor::article");
  await expect(card).toBeVisible();await card.getByRole("button",{name:"แก้ไขข้อมูล"}).click();
  await expect(page.locator("#product-image-"+ids.productId)).toBeVisible();
 }
 try{
  const first=await ctx.newPage();
  await first.goto(url,{waitUntil:"domcontentloaded"});
  await editor(first);
  await first.locator("#product-image-"+ids.productId).setInputFiles({name:"first-tab.png",mimeType:"image/png",buffer:png});
  await first.getByRole("button",{name:"อัปโหลดรูปสินค้า"}).click();
  await expect.poll(()=>patch).toBe(1);
  await expect.poll(()=>tabMarker(first)).toEqual([imageKey]);
  await snap(first,"first-tab-patch-awaiting-ACK","First tab sent one PATCH; saved its provisional marker before response was lost");
  await first.close();
  hold.release?.();

  const second=await ctx.newPage();
  await second.goto(url,{waitUntil:"domcontentloaded"});
  await editor(second);
  await expect.poll(()=>tabMarker(second)).toEqual([]);
  await expect(second.getByRole("button",{name:"ตรวจสอบข้อมูลล่าสุดอีกครั้ง"})).toHaveCount(0);
  const safe=second.getByRole("button",{name:"โหลดข้อมูลสินค้าล่าสุด"});
  await expect(safe).toBeEnabled();
  await expect(second.getByText(/หากเพิ่งอัปโหลดแล้วเปิดหน้าใหม่ กรุณาโหลดข้อมูลสินค้าล่าสุดก่อนส่งไฟล์ซ้ำ/)).toBeVisible();
  expect([sign,put,patch]).toEqual([1,1,1]);
  await snap(second,"new-tab-missing-marker","Different browser tab cannot be assumed to inherit the pending marker; GET-only refresh remains available");

  showCurrent=true;
  const before=reads;
  await safe.click();
  await expect.poll(()=>reads).toBe(before+1);
  await expect(second.getByText(/โหลดข้อมูลสินค้าล่าสุดแล้ว/)).toBeVisible();
  await expect(second.getByText("มีรูปสินค้าแล้ว").last()).toBeVisible();
  await expect(second.locator("[data-product-upload-feedback]")).toBeFocused();
  expect([sign,put,patch,blocked]).toEqual([1,1,1,0]);
  await snap(second,"new-tab-read-only-current-image","Fresh Product GET reveals current image without re-signing, PUT or PATCH");
  await second.close();
 }finally{hold.release?.();await ctx.close();}
 const base=JSON.parse(await readFile("quality-audit/coverage-baseline.json","utf8")) as {actions:Array<{id:string;roles:string[];statesToTest:string[]}>;shellActions:Array<{id:string;roles:string[];statesToTest:string[]}>};
 const entries:ActionOutcome[]=[...base.actions,...base.shellActions].map(a=>({actionId:a.id,role:a.roles[0]!,state:"all-declared-states",viewport:"not-executed",status:"NOT_TESTED",testRunId:runId,evidence:[],notes:"Full state matrix not certified: "+a.statesToTest.join(", ")}));
 for(const p of proof)entries.push({actionId:p.id,role:p.role,state:p.state,viewport:p.viewport,status:"PASS",testRunId:runId,evidence:[p.image],notes:p.note+"; all writes isolated Browser mocks"});
 await writeActionLedger(runId,entries);
 await writeFile(join(dir,"tab-close-current-product.json"),JSON.stringify({engine:browser.browserType().name(),proof,sign,put,patch,reads,blocked,realBusinessWrites:0,limitations:"Closing the original tab loses its session marker. The manual read-only refresh mitigates but does not guarantee recovery of unacknowledged writes."},null,2)+"\n");
});
