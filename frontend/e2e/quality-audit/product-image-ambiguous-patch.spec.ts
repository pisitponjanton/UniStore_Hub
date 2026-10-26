import {randomUUID} from "node:crypto";
import {mkdir,readFile,writeFile} from "node:fs/promises";
import {join} from "node:path";
import {expect,test,type Page} from "@playwright/test";
import {establishSeedRoleSession,LOCAL_SEED_ENTITY_IDS as ids} from "../support/seed-auth";
import {localAuditTargets} from "./fixture-guard";
import {writeActionLedger,type ActionOutcome} from "./result-ledger";

const at="2026-10-17T12:00:00.000Z",root="/api/v1/organizations/"+ids.organizationId,endpoint=root+"/products/"+ids.productId;
const store={storeId:ids.storeId,organizationId:ids.organizationId,name:"UXQA Store",description:"Synthetic only",status:"ACTIVE",createdAt:at,updatedAt:at};
const product={productId:ids.productId,organizationId:ids.organizationId,storeId:ids.storeId,name:"UXQA Shirt",description:"Synthetic only",status:"ACTIVE",imageKey:null as string|null,imageUrl:null,variants:[],createdAt:at,updatedAt:at};
const key="uxqa-synthetic-saved-image-key";
const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y2A2SYAAAAASUVORK5CYII=","base64");
type Proof={id:string;state:string;image:string;note:string;role:"organizationAdmin";viewport:"390x844"};

test("ambiguous image PATCH HTTP 503 after commit offers GET-only verification",async({browser,request})=>{
 test.setTimeout(165000);
 const {frontend}=localAuditTargets(),runId="uxqa-"+randomUUID(),dir=join("test-results","quality-audit",runId);
 await mkdir(dir,{recursive:true});
 const proofs:Proof[]=[];
 let signed=0,put=0,patch=0,readback=0,unexpected=0,hasCommitted=false;
 const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:"reduce"});
 await establishSeedRoleSession(ctx,request,"organizationAdmin");
 await ctx.route("**/*",async route=>{
  const req=route.request(),url=new URL(req.url()),path=url.pathname,method=req.method();
  const ok=(data:unknown)=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({success:true,data})});
  if(method==="GET"&&path===root+"/stores")return ok({items:[store],nextCursor:null});
  if(method==="GET"&&path===root+"/products")return ok({items:[product],nextCursor:null});
  if(method==="POST"&&path===endpoint+"/image-upload-url"){
   signed++;expect(req.postDataJSON()).toEqual({contentType:"image/png"});
   return ok({objectKey:key,method:"PUT",url:frontend+"/__uxqa_readback_test__/image",expiresInSeconds:900});
  }
  if(method==="PUT"&&path==="/__uxqa_readback_test__/image"){
   put++;expect(req.headers()["content-type"]).toBe("image/png");
   await route.fulfill({status:200,body:""});return;
  }
  if(method==="PATCH"&&path===endpoint){
   patch++;expect(req.postDataJSON()).toEqual({imageKey:key});hasCommitted=true;
   // Backend commits successfully, but response is lost/replaced by 503.
   return route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({success:false,error:{code:"SERVICE_UNAVAILABLE",message:"UXQA synthetic lost PATCH response"}})});
  }
  if(method==="GET"&&path===endpoint){
   if(!hasCommitted)return ok(product);
   readback++;
   if(readback<=2)return route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({success:false,error:{code:"SERVICE_UNAVAILABLE",message:"UXQA simulated readback outage"}})});
   if(readback===3)return ok({...product,imageKey:key});
   return ok({...product,imageKey:key});
  }
  if(!["GET","HEAD","OPTIONS"].includes(method)){unexpected++;return route.abort("blockedbyclient");}
  return route.continue();
 });
 async function screenshot(page:Page,state:string,note:string){
  const image="FE-UX-18-15-"+state+".png";await page.screenshot({path:join(dir,image),animations:"disabled"});
  proofs.push({id:"FE-UX-18-15",state,image,note,role:"organizationAdmin",viewport:"390x844"});
 }
 try{
  const page=await ctx.newPage();
  await page.goto(frontend+"/org/stores/view/?organizationId="+ids.organizationId+"&storeId="+ids.storeId+"&tab=products",{waitUntil:"domcontentloaded"});
  const card=page.getByRole("heading",{name:product.name,exact:true}).first().locator("xpath=ancestor::article");
  await expect(card).toBeVisible();
  await card.getByRole("link",{name:"แก้ไขสินค้า"}).click();
  const file=page.locator("#product-image-"+ids.productId),action=page.getByRole("button",{name:"บันทึกรูป"});
  await expect(file).toBeEnabled();
  await file.setInputFiles({name:"uxqa-saved-image.png",mimeType:"image/png",buffer:png});
  await action.click();
  await expect(page.getByText(/ส่งคำขอบันทึกรูปไปแล้ว แต่ยังยืนยันผลไม่ได้/)).toBeVisible();
  const retry=page.getByRole("button",{name:"ตรวจสอบข้อมูลล่าสุดอีกครั้ง"});
  const result=page.locator("[data-product-upload-feedback]");
  await expect(page.getByRole("alert").filter({hasText:"ยังยืนยันผลการบันทึกไม่ได้"})).toBeVisible();
  await expect(result).toBeFocused();
  await expect(retry).toBeEnabled();
  await expect(file).toBeDisabled();
  await expect(action).toHaveCount(0);
  expect([signed,put,patch,readback]).toEqual([1,1,1,0]);
  await screenshot(page,"ambiguous-patch-response-503","Backend mocked as committed, PATCH 503 received; only GET Retry remains");
  await retry.click();
  await expect.poll(()=>readback).toBe(1);
  await expect(page.getByText(/ส่งคำขอบันทึกรูปไปแล้ว แต่ยังยืนยันผลไม่ได้/)).toBeVisible();
  await expect(retry).toBeEnabled();
  await expect(result).toBeFocused();
  expect([signed,put,patch]).toEqual([1,1,1]);
  await screenshot(page,"ambiguous-readback-503","Repeat 503 retries only Product GET and preserves recovery action");
  await retry.click();
  await expect.poll(()=>readback).toBe(2);
  await expect(retry).toBeEnabled();
  await expect(result).toBeFocused();
  await expect(page.getByText(/ส่งคำขอบันทึกรูปไปแล้ว แต่ยังยืนยันผลไม่ได้/)).toBeVisible();
  expect([signed,put,patch]).toEqual([1,1,1]);
  await screenshot(page,"verify-stale-get","A stale 200 GET with old imageKey does not falsely confirm persisted image");
  await retry.click();
  await expect.poll(()=>readback).toBe(3);
  await expect(page.getByText("อัปโหลดและบันทึกรูปสินค้าเรียบร้อยแล้ว")).toBeVisible();
  await expect(result).toBeFocused();
  await expect(page.getByText("เปลี่ยนรูปสินค้า",{exact:true}).last()).toBeVisible();
  await expect(file).toBeEnabled();
  await expect(retry).toHaveCount(0);
  await expect(action).toHaveCount(0);
  expect([signed,put,patch,readback,unexpected]).toEqual([1,1,1,3,0]);
  await screenshot(page,"ambiguous-GET-verifies-commit","Once GET confirms the same image key, normal editor resumes without extra upload");
  await page.close();
 }finally{await ctx.close();}
 const b=JSON.parse(await readFile("quality-audit/coverage-baseline.json","utf8")) as {actions:Array<{id:string;roles:string[];statesToTest:string[]}>;shellActions:Array<{id:string;roles:string[];statesToTest:string[]}>};
 const entries:ActionOutcome[]=[...b.actions,...b.shellActions].map(x=>({actionId:x.id,role:x.roles[0]!,state:"all-declared-states",viewport:"not-executed",status:"NOT_TESTED",testRunId:runId,evidence:[],notes:"Full state matrix still unverified: "+x.statesToTest.join(", ")}));
 for(const p of proofs)entries.push({actionId:p.id,role:p.role,state:p.state,viewport:p.viewport,status:"PASS",testRunId:runId,evidence:[p.image],notes:p.note+"; all writes intercepted"});
 await writeActionLedger(runId,entries);
 await writeFile(join(dir,"ambiguous-image-patch.json"),JSON.stringify({browserEngine:browser.browserType().name(),proofs,signed,put,patch,readback,unexpected,actualBusinessWrites:0,limitation:"Synthetic POST/PUT/PATCH/GET. Proves no duplicate browser mutation, not persistence or object storage consistency."},null,2)+"\n");
});
