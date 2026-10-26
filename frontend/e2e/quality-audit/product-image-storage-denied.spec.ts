import {randomUUID} from "node:crypto";
import {mkdir,readFile,writeFile} from "node:fs/promises";
import {join} from "node:path";
import {expect,test,type Page} from "@playwright/test";
import {establishSeedRoleSession,LOCAL_SEED_ENTITY_IDS as ids} from "../support/seed-auth";
import {localAuditTargets} from "./fixture-guard";
import {writeActionLedger,type ActionOutcome} from "./result-ledger";

const root="/api/v1/organizations/"+ids.organizationId,endpoint=root+"/products/"+ids.productId,at="2026-10-17T12:00:00.000Z";
const product={productId:ids.productId,organizationId:ids.organizationId,storeId:ids.storeId,name:"UXQA Shirt",description:"Local synthetic",status:"ACTIVE",imageKey:null as string|null,imageUrl:null,variants:[],createdAt:at,updatedAt:at};
const store={storeId:ids.storeId,organizationId:ids.organizationId,name:"UXQA Store",description:"Local synthetic",status:"ACTIVE",createdAt:at,updatedAt:at};
const objectKey="uxqa-storage-blocked-committed-image";
const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y2A2SYAAAAASUVORK5CYII=","base64");
type Proof={id:"FE-UX-18-15";state:string;role:"organizationAdmin";viewport:"390x844";image:string;note:string};

test("image PATCH committed with sessionStorage blocked: warning and GET-only recovery",async({browser,request})=>{
 test.setTimeout(150000);
 const {frontend}=localAuditTargets(),runId="uxqa-"+randomUUID(),dir=join("test-results","quality-audit",runId);
 await mkdir(dir,{recursive:true});
 const proofs:Proof[]=[];
 let signs=0,puts=0,patches=0,postCommitGets=0,blockedWrites=0,committed=false;
 const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:"reduce"});
 await establishSeedRoleSession(ctx,request,"organizationAdmin");
 // Simulate a privacy policy that rejects ONLY product-image verification
 // marker access. Auth session token storage is deliberately unaffected.
 await ctx.addInitScript(()=>{
  const prefix="unistoreHub.productImageVerification.v1";
  for(const name of ["getItem","setItem","removeItem"] as const){
   const old=Storage.prototype[name];
   Object.defineProperty(Storage.prototype,name,{
    configurable:true, value:function(this:Storage,...args:[string,...string[]]){
     if(String(args[0]).includes(prefix))throw new DOMException("UXQA simulated session storage denial","SecurityError");
     return Reflect.apply(old,this,args);
    }
   });
  }
 });
 await ctx.route("**/*",async route=>{
  const req=route.request(),p=new URL(req.url()).pathname,m=req.method();
  const ok=(data:unknown)=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({success:true,data})});
  if(m==="GET"&&p===root+"/stores")return ok({items:[store],nextCursor:null});
  if(m==="GET"&&p===root+"/products")return ok({items:[product],nextCursor:null});
  if(m==="GET"&&p===endpoint){
   if(!committed)return ok(product);
   postCommitGets++;
   if(postCommitGets===1)return route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({success:false,error:{code:"SERVICE_UNAVAILABLE",message:"UXQA readback error"}})});
   if(postCommitGets===2)return ok(product);
   return ok({...product,imageKey:objectKey});
  }
  if(m==="POST"&&p===endpoint+"/image-upload-url"){
   signs++;expect(req.postDataJSON()).toEqual({contentType:"image/png"});
   return ok({objectKey,url:frontend+"/__uxqa_storage_denied__/file",method:"PUT",expiresInSeconds:900});
  }
  if(m==="PUT"&&p==="/__uxqa_storage_denied__/file"){
   puts++;expect(req.headers()["content-type"]).toBe("image/png");
   return route.fulfill({status:200,body:""});
  }
  if(m==="PATCH"&&p===endpoint){
   patches++;expect(req.postDataJSON()).toEqual({imageKey:objectKey});
   committed=true;return ok({...product,imageKey:objectKey});
  }
  if(!["GET","HEAD","OPTIONS"].includes(m)){blockedWrites++;return route.abort("blockedbyclient");}
  return route.continue();
 });
 async function capture(page:Page,state:string,note:string){
  const image="FE-UX-18-15-"+state+".png";
  await page.screenshot({path:join(dir,image),animations:"disabled"});
  proofs.push({id:"FE-UX-18-15",state,image,role:"organizationAdmin",viewport:"390x844",note});
 }
 try{
  const page=await ctx.newPage();
  await page.goto(frontend+"/org/stores/view/?organizationId="+ids.organizationId+"&storeId="+ids.storeId+"&tab=products",{waitUntil:"domcontentloaded"});
  await expect(page.getByRole("heading",{level:2,name:"สินค้าและตัวเลือก",exact:true})).toBeVisible();
  const card=page.getByRole("heading",{name:product.name,exact:true}).first().locator("xpath=ancestor::article");
  await card.getByRole("link",{name:"แก้ไขสินค้า"}).click();
  const input=page.locator("#product-image-"+ids.productId);
  await expect(input).toBeEnabled();
  await input.setInputFiles({name:"uxqa-denied-storage.png",mimeType:"image/png",buffer:png});
  await page.getByRole("button",{name:"บันทึกรูป"}).click();
  await expect(page.getByText(/บันทึกรูปสินค้าแล้ว แต่ยังโหลดข้อมูลล่าสุดไม่สำเร็จ/)).toBeVisible();
  await expect(page.getByText(/เบราว์เซอร์ไม่อนุญาตให้บันทึกสถานะชั่วคราว/)).toBeVisible();
  const retry=page.getByRole("button",{name:"ตรวจสอบข้อมูลล่าสุดอีกครั้ง"});
  const feedback=page.locator("[data-product-upload-feedback]");
  await expect(retry).toBeEnabled();
  await expect(feedback).toBeFocused();
  await expect(input).toBeDisabled();
  await expect(page.getByRole("button",{name:"บันทึกรูป"})).toHaveCount(0);
  expect([signs,puts,patches,postCommitGets]).toEqual([1,1,1,1]);
  await capture(page,"storage-denied-committed-503","Storage denied: truthful warning, focus and readback-only; no re-upload");
  await retry.click();
  await expect(page.getByText(/ข้อมูลล่าสุดยังไม่แสดงรูปที่บันทึก/)).toBeVisible();
  await expect(feedback).toBeFocused();
  await expect(retry).toBeEnabled();
  expect([signs,puts,patches,postCommitGets]).toEqual([1,1,1,2]);
  await capture(page,"storage-denied-stale-get","GET 200 with stale key cannot unlock new upload even without storage");
  await retry.click();
  await expect(page.getByText("อัปโหลดและบันทึกรูปสินค้าเรียบร้อยแล้ว")).toBeVisible();
  await expect(feedback).toBeFocused();
  await expect(retry).toHaveCount(0);
  await expect(page.getByText("เปลี่ยนรูปสินค้า",{exact:true}).last()).toBeVisible();
  await expect(page.getByText(/เบราว์เซอร์ไม่อนุญาตให้บันทึกสถานะชั่วคราว/)).toHaveCount(0);
  expect([signs,puts,patches,postCommitGets,blockedWrites]).toEqual([1,1,1,3,0]);
  await capture(page,"storage-denied-get-recovered","Verified matching GET clears warning without duplicate writes");
  await page.close();
 }finally{await ctx.close();}
 const b=JSON.parse(await readFile("quality-audit/coverage-baseline.json","utf8")) as {actions:Array<{id:string;roles:string[];statesToTest:string[]}>;shellActions:Array<{id:string;roles:string[];statesToTest:string[]}>};
 const entries:ActionOutcome[]=[...b.actions,...b.shellActions].map(x=>({actionId:x.id,role:x.roles[0]!,state:"all-declared-states",viewport:"not-executed",status:"NOT_TESTED",testRunId:runId,evidence:[],notes:"Exhaustive declared-state matrix not verified: "+x.statesToTest.join(", ")}));
 for(const p of proofs)entries.push({actionId:p.id,role:p.role,state:p.state,viewport:p.viewport,status:"PASS",testRunId:runId,evidence:[p.image],notes:p.note+"; synthetic GET and fully intercepted POST/PUT/PATCH"});
 await writeActionLedger(runId,entries);
 await writeFile(join(dir,"storage-denied-product-image.json"),JSON.stringify({engine:browser.browserType().name(),proofs,signs,puts,patches,postCommitGets,blockedWrites,actualBusinessWrites:0,limitations:"Synthetic storage denial only. State is not guaranteed after unmount or reload when storage is blocked."},null,2)+"\n");
});
