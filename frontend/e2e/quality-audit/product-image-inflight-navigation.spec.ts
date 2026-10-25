import {randomUUID} from "node:crypto";
import {mkdir,readFile,writeFile} from "node:fs/promises";
import {join} from "node:path";
import {expect,test,type Page} from "@playwright/test";
import {establishSeedRoleSession,LOCAL_SEED_ENTITY_IDS as ids} from "../support/seed-auth";
import {localAuditTargets} from "./fixture-guard";
import {writeActionLedger,type ActionOutcome} from "./result-ledger";

const at="2026-10-17T12:00:00.000Z";
const root="/api/v1/organizations/"+ids.organizationId,endpoint=root+"/products/"+ids.productId;
const product={productId:ids.productId,organizationId:ids.organizationId,storeId:ids.storeId,name:"UXQA Shirt",description:"Synthetic only",status:"ACTIVE",imageKey:null as string|null,imageUrl:null,variants:[],createdAt:at,updatedAt:at};
const store={storeId:ids.storeId,organizationId:ids.organizationId,name:"UXQA Store",description:"Synthetic only",status:"ACTIVE",createdAt:at,updatedAt:at};
const key="uxqa-inflight-patch-commit";
const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y2A2SYAAAAASUVORK5CYII=","base64");
type Proof={id:"FE-UX-18-15";state:string;role:"organizationAdmin";viewport:"390x844";image:string;note:string};

test("image PATCH in-flight during page navigation preserves GET-only recovery",async({browser,request})=>{
 test.setTimeout(150000);
 const {frontend}=localAuditTargets(),runId="uxqa-"+randomUUID(),dir=join("test-results","quality-audit",runId);
 await mkdir(dir,{recursive:true});
 const proof:Proof[]=[];
 let signs=0,puts=0,patches=0,reads=0,blocked=0,devStackRequests=0,committed=false,recovered=false;
 const blockedRequests:string[]=[];
 const hold:{release?:()=>void}={};
 const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:"reduce"});
 await establishSeedRoleSession(ctx,request,"organizationAdmin");
 await ctx.route("**/*",async route=>{
  const q=route.request(),p=new URL(q.url()).pathname,m=q.method();
  const ok=(data:unknown)=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({success:true,data})});
  if(m==="GET"&&p===root+"/stores")return ok({items:[store],nextCursor:null});
  if(m==="GET"&&p===root+"/products")return ok({items:[product],nextCursor:null});
  if(m==="GET"&&p===endpoint){
   if(committed)reads++;
   return ok(recovered?{...product,imageKey:key}:product);
  }
  if(m==="POST"&&p===endpoint+"/image-upload-url"){
   signs++;expect(q.postDataJSON()).toEqual({contentType:"image/png"});
   return ok({objectKey:key,url:frontend+"/__uxqa_inflight_patch__/image",method:"PUT",expiresInSeconds:900});
  }
  if(m==="PUT"&&p==="/__uxqa_inflight_patch__/image"){
   puts++;return route.fulfill({status:200,body:""});
  }
  if(m==="PATCH"&&p===endpoint){
   patches++;expect(q.postDataJSON()).toEqual({imageKey:key});
   // The isolated mock commits, but the browser never receives its ACK
   // before the user leaves this page.
   committed=true;
   await new Promise<void>(resolve=>{hold.release=resolve;});
   try{return await route.abort("failed");}catch{return;}
  }
  // WebKit may request Next.js' local development stack-frame formatter
  // after the intentionally aborted PATCH. It is NOT a business mutation.
  if(m==="POST"&&p==="/__nextjs_original-stack-frames"){
   devStackRequests++;
   return route.fulfill({status:200,contentType:"application/json",body:"{}"});
  }
  if(!["GET","HEAD","OPTIONS"].includes(m)){blocked++;blockedRequests.push(m+" "+p);return route.abort("blockedbyclient");}
  return route.continue();
 });
 const marker=async(page:Page)=>page.evaluate(()=>Object.entries(sessionStorage).filter(([k])=>k.includes("productImageVerification.v1")).map(([,v])=>v));
 async function snap(page:Page,state:string,note:string){
  const image="FE-UX-18-15-"+state+".png";
  await page.screenshot({path:join(dir,image),animations:"disabled"});
  proof.push({id:"FE-UX-18-15",state,image,note,role:"organizationAdmin",viewport:"390x844"});
 }
 const productUrl=frontend+"/org/stores/view/?organizationId="+ids.organizationId+"&storeId="+ids.storeId+"&tab=products";
 async function edit(page:Page){
  const card=page.getByRole("heading",{name:product.name,exact:true}).first().locator("xpath=ancestor::article");
  await expect(card).toBeVisible();
  await card.getByRole("link",{name:"แก้ไขสินค้า"}).click();
  await expect(page.locator("#product-image-"+ids.productId)).toBeVisible();
 }
 try{
  const page=await ctx.newPage();
  await page.goto(productUrl,{waitUntil:"domcontentloaded"});
  await edit(page);
  await page.locator("#product-image-"+ids.productId).setInputFiles({name:"inflight-patch.png",mimeType:"image/png",buffer:png});
  await page.getByRole("button",{name:"อัปโหลดรูปสินค้า"}).click();
  await expect.poll(()=>patches).toBe(1);
  await expect.poll(()=>marker(page)).toEqual([key]);
  await expect(page.getByRole("button",{name:"กำลังบันทึกรูปสินค้า"})).toBeDisabled();
  await snap(page,"patch-request-held","PATCH sent once, server mock commits while response is withheld; marker already stored");
  await page.goto(frontend+"/",{waitUntil:"domcontentloaded"});
  hold.release?.();
  await expect.poll(()=>marker(page)).toEqual([key]);
  await snap(page,"navigation-after-dispatch","Leaving editor while PATCH response is lost preserves marker in same tab");
  await page.goto(productUrl,{waitUntil:"domcontentloaded"});
  await edit(page);
  const retry=page.getByRole("button",{name:"ตรวจสอบข้อมูลล่าสุดอีกครั้ง"});
  await expect(retry).toBeEnabled();
  await expect(page.getByText(/สถานะการบันทึกรูปยังไม่ชัดเจน/)).toBeVisible();
  await expect(page.getByRole("button",{name:"อัปโหลดรูปสินค้า"})).toHaveCount(0);
  await expect(page.locator("#product-image-"+ids.productId)).toBeDisabled();
  expect([signs,puts,patches]).toEqual([1,1,1]);
  await snap(page,"reentry-unacknowledged","After navigating back, conservative marker blocks duplicate upload and offers GET-only retry");
  await retry.click();
  await expect(page.getByText(/ยังยืนยันผลการบันทึกรูปไม่ได้/)).toBeVisible();
  await expect(retry).toBeEnabled();
  expect([signs,puts,patches]).toEqual([1,1,1]);
  await snap(page,"readback-stale-after-exit","A stale Product GET leaves the original pending marker and no new mutation");
  recovered=true;
  await retry.click();
  await expect(page.getByText("อัปโหลดและบันทึกรูปสินค้าเรียบร้อยแล้ว")).toBeVisible();
  await expect.poll(()=>marker(page)).toEqual([]);
  await expect(page.getByText("มีรูปสินค้าแล้ว").last()).toBeVisible();
  expect([signs,puts,patches,blocked], "Unexpected request(s): "+blockedRequests.join(" | ")).toEqual([1,1,1,0]);
  await snap(page,"readback-confirms-saved","Matching GET confirms image without a second signed PUT or PATCH");
  await page.close();
 }finally{hold.release?.();await ctx.close();}
 const baseline=JSON.parse(await readFile("quality-audit/coverage-baseline.json","utf8")) as {actions:Array<{id:string;roles:string[];statesToTest:string[]}>;shellActions:Array<{id:string;roles:string[];statesToTest:string[]}>};
 const entries:ActionOutcome[]=[...baseline.actions,...baseline.shellActions].map(a=>({actionId:a.id,role:a.roles[0]!,state:"all-declared-states",viewport:"not-executed",status:"NOT_TESTED",testRunId:runId,evidence:[],notes:"Full state matrix not executed: "+a.statesToTest.join(", ")}));
 for(const p of proof)entries.push({actionId:p.id,role:p.role,state:p.state,viewport:p.viewport,status:"PASS",testRunId:runId,evidence:[p.image],notes:p.note+"; all writes synthetic Browser intercepts"});
 await writeActionLedger(runId,entries);
 await writeFile(join(dir,"inflight-patch-navigation.json"),JSON.stringify({engine:browser.browserType().name(),proof,signs,puts,patches,reads,blocked,blockedRequests,devStackRequests,realBusinessWrites:0,limitations:"Same-tab navigation with mocked lost ACK; closing an entire tab and durable backend transaction status not certified"},null,2)+"\n");
});
