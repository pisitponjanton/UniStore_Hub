import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { establishSeedRoleSession, LOCAL_SEED_ENTITY_IDS as ids } from "../support/seed-auth";
import { localAuditTargets } from "./fixture-guard";
import { writeActionLedger, type ActionOutcome } from "./result-ledger";

const at="2026-10-17T12:00:00.000Z";
const root="/api/v1/organizations/"+ids.organizationId;
const imageEndpoint=root+"/products/"+ids.productId;
const store={storeId:ids.storeId,organizationId:ids.organizationId,name:"UXQA Store",description:"Local synthetic",status:"ACTIVE",createdAt:at,updatedAt:at};
const product={productId:ids.productId,organizationId:ids.organizationId,storeId:ids.storeId,
 name:"UXQA Shirt",description:"Local synthetic",status:"ACTIVE",imageKey:null as string|null,imageUrl:null,
 variants:[],createdAt:at,updatedAt:at};
type Proof={id:string;role:"organizationAdmin";state:string;note:string;image:string};

test("Product Image validation, pending, signed PUT 403 and synthetic success",async({browser,request})=>{
 test.setTimeout(185000);
 const {frontend}=localAuditTargets(),runId="uxqa-"+randomUUID(),dir=join("test-results","quality-audit",runId);
 await mkdir(dir,{recursive:true});
 const proofs:Proof[]=[];
 let blockedWrites=0,signs=0,puts=0,patches=0,gets=0,waitForSigning=false;
 let saved={...product};
 const pending:{release?:()=>void}={};
 const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:"reduce"});
 await establishSeedRoleSession(ctx,request,"organizationAdmin");
 await ctx.route("**/*",async route=>{
  const req=route.request(),u=new URL(req.url()),p=u.pathname,m=req.method();
  const json=(data:unknown)=>({status:200,contentType:"application/json",body:JSON.stringify({success:true,data})});
  if(m==="GET"&&p===root+"/stores"){await route.fulfill(json({items:[store],nextCursor:null}));return;}
  if(m==="GET"&&p===root+"/products"){await route.fulfill(json({items:[saved],nextCursor:null}));return;}
  if(m==="GET"&&p===imageEndpoint){gets++;await route.fulfill(json(saved));return;}
  if(m==="POST"&&p===imageEndpoint+"/image-upload-url"){
   signs++;expect(req.postDataJSON()).toEqual({contentType:"image/png"});
   if(waitForSigning)await new Promise<void>(resolve=>{pending.release=resolve;});
   await route.fulfill(json({objectKey:"uxqa-synthetic-"+signs,
    url:frontend+"/__uxqa_signed_upload__/image-"+signs,method:"PUT",expiresInSeconds:900}));return;
  }
  if(m==="PUT"&&p.startsWith("/__uxqa_signed_upload__/")){
   puts++;expect(req.headers()["content-type"]).toBe("image/png");
   if(puts===1)await route.fulfill({status:403,body:"expired synthetic signature"});
   else await route.fulfill({status:200,body:""});
   return;
  }
  if(m==="PATCH"&&p===imageEndpoint){
   patches++;expect(req.postDataJSON()).toEqual({imageKey:"uxqa-synthetic-2"});
   saved={...saved,imageKey:"uxqa-synthetic-2",updatedAt:at};
   await route.fulfill(json(saved));return;
  }
  if(!["GET","HEAD","OPTIONS"].includes(m)){blockedWrites++;await route.abort("blockedbyclient");return;}
  await route.continue();
 });
 async function proof(page:Page,id:string,state:string,note:string){
  const image=id+"-"+state+".png";
  await page.screenshot({path:join(dir,image),animations:"disabled"});
  proofs.push({id,role:"organizationAdmin",state,note,image});
 }
 try{
  const page=await ctx.newPage();
  await page.goto(frontend+"/org/stores/view/?organizationId="+ids.organizationId+"&storeId="+ids.storeId+"&tab=products",{waitUntil:"domcontentloaded"});
  await expect(page.getByRole("heading",{level:2,name:"สินค้าและตัวเลือก",exact:true})).toBeVisible();
  const item=page.getByRole("heading",{name:product.name,exact:true}).first();
  await expect(item).toBeVisible();
  await item.locator("xpath=ancestor::article").getByRole("link",{name:"แก้ไขสินค้า"}).click();
  await expect(page.getByRole("heading",{name:"รูปสินค้า"})).toBeVisible();
  const input=page.locator("#product-image-"+ids.productId);
  const action=page.getByRole("button",{name:"อัปโหลดรูปสินค้า"});
  await expect(action).toBeDisabled();
  await input.setInputFiles({name:"invalid.txt",mimeType:"text/plain",buffer:Buffer.from("invalid-only")});
  await expect(page.getByText("รองรับเฉพาะ JPEG, PNG และ WebP")).toBeVisible();
  await expect(action).toBeDisabled();
  await proof(page,"FE-UX-18-14","unsupported-file","Unsupported file type rejected before issuing signed POST");
  await input.setInputFiles({name:"uxqa-image.png",mimeType:"image/png",
   buffer:Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y2A2SYAAAAASUVORK5CYII=","base64")});
  await expect(page.getByText("uxqa-image.png")).toBeVisible();
  await expect(action).toBeEnabled();
  await proof(page,"FE-UX-18-14","file-selected","Valid 1px PNG is selected with clear metadata; no API write");
  expect(signs).toBe(0);
  waitForSigning=true;
  await action.click();
  await expect.poll(()=>signs).toBe(1);
  await expect(page.getByRole("button",{name:"กำลังเตรียมการอัปโหลด"})).toBeDisabled();
  await expect(input).toBeDisabled();
  await expect(page.getByText("กำลังเตรียมการอัปโหลด").first()).toBeVisible();
  await proof(page,"FE-UX-18-15","pending-signature","Deferred synthetic signing POST locks input and submit, progress visible");
  waitForSigning=false;pending.release?.();
  await expect(page.getByText("ลิงก์อัปโหลดหมดอายุหรือถูกปฏิเสธ กรุณากดอัปโหลดอีกครั้งเพื่อสร้างลิงก์ใหม่")).toBeVisible();
  await expect(action).toBeEnabled();
  await expect(page.getByText("uxqa-image.png")).toBeVisible();
  expect(patches).toBe(0);expect(puts).toBe(1);
  await proof(page,"FE-UX-18-15","synthetic-403-retry","Intercepted signed PUT 403 keeps file and offers retry without image PATCH");
  await action.click();
  await expect(page.getByText("อัปโหลดและบันทึกรูปสินค้าเรียบร้อยแล้ว")).toBeVisible();
  await expect(page.getByText("มีรูปสินค้าแล้ว").last()).toBeVisible();
  await expect(action).toBeDisabled();
  await expect(page.getByText("uxqa-image.png")).toHaveCount(0);
  expect(signs).toBe(2);expect(puts).toBe(2);expect(patches).toBe(1);
  await proof(page,"FE-UX-18-15","synthetic-upload-success","Intercepted new signing POST, PUT 200, PATCH ImageKey and GET refresh");
  await page.close();
 }finally{pending.release?.();await ctx.close();}
 expect(blockedWrites).toBe(0);expect(gets).toBeGreaterThanOrEqual(2);
 const base=JSON.parse(await readFile("quality-audit/coverage-baseline.json","utf8")) as {
  actions:Array<{id:string;roles:string[];statesToTest:string[]}>;shellActions:Array<{id:string;roles:string[];statesToTest:string[]}>;
 };
 const outcomes:ActionOutcome[]=[...base.actions,...base.shellActions].map(a=>({
  actionId:a.id,role:a.roles[0]!,state:"all-declared-states",viewport:"not-executed",status:"NOT_TESTED",
  testRunId:runId,evidence:[],notes:"Full matrix unverified: "+a.statesToTest.join(", ")
 }));
 for(const p of proofs)outcomes.push({actionId:p.id,role:p.role,state:p.state,viewport:"390x844",status:"PASS",
  testRunId:runId,evidence:[p.image],notes:p.note+"; fully intercepted upload lifecycle only"});
 await writeActionLedger(runId,outcomes);
 await writeFile(join(dir,"product-image-action-evidence.json"),JSON.stringify({browserEngine:browser.browserType().name(),
  proofs,distinctIds:[...new Set(proofs.map(p=>p.id))],blockedWrites,signs,puts,patches,gets,
  limitation:"All three upload writes intercepted; no object-store write nor real product update performed."},null,2)+"\n");
});
