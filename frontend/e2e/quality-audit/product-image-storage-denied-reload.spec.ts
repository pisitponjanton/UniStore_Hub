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
const objectKey="uxqa-denied-reload-old-commit";
const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y2A2SYAAAAASUVORK5CYII=","base64");
type Proof={id:"FE-UX-18-15";state:string;role:"organizationAdmin";viewport:"390x844";image:string;note:string};
test("reload without Session Storage warns and offers safe Product GET before repeat upload",async({browser,request})=>{
 test.setTimeout(150000);
 const {frontend}=localAuditTargets(),runId="uxqa-"+randomUUID(),dir=join("test-results","quality-audit",runId);
 await mkdir(dir,{recursive:true});
 const proofs:Proof[]=[];
 let signed=0,put=0,patch=0,afterPatchGets=0,blocked=0,committed=false,showLatest=false;
 const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:"reduce"});
 await establishSeedRoleSession(ctx,request,"organizationAdmin");
 await ctx.addInitScript(()=>{
  const prefix="unistoreHub.productImageVerification.v1";
  for(const name of ["getItem","setItem","removeItem"] as const){
   const old=Storage.prototype[name];
   Object.defineProperty(Storage.prototype,name,{configurable:true,value:function(this:Storage,...args:[string,...string[]]){
    if(String(args[0]).includes(prefix))throw new DOMException("UXQA denied marker storage","SecurityError");
    return Reflect.apply(old,this,args);
   }});
  }
 });
 await ctx.route("**/*",async route=>{
  const req=route.request(),p=new URL(req.url()).pathname,m=req.method();
  const ok=(data:unknown)=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({success:true,data})});
  if(m==="GET"&&p===root+"/stores")return ok({items:[store],nextCursor:null});
  if(m==="GET"&&p===root+"/products")return ok({items:[showLatest?{...product,imageKey:objectKey}:product],nextCursor:null});
  if(m==="GET"&&p===endpoint){
   if(!committed)return ok(product);
   afterPatchGets++;
   if(afterPatchGets===1)return route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({success:false,error:{code:"SERVICE_UNAVAILABLE",message:"Synthetic readback failed"}})});
   return ok(showLatest?{...product,imageKey:objectKey}:product);
  }
  if(m==="POST"&&p===endpoint+"/image-upload-url"){signed++;return ok({objectKey,url:frontend+"/__uxqa_denied_reload__/image",method:"PUT",expiresInSeconds:900});}
  if(m==="PUT"&&p==="/__uxqa_denied_reload__/image"){put++;return route.fulfill({status:200,body:""});}
  if(m==="PATCH"&&p===endpoint){patch++;expect(req.postDataJSON()).toEqual({imageKey:objectKey});committed=true;return ok({...product,imageKey:objectKey});}
  if(!["GET","HEAD","OPTIONS"].includes(m)){blocked++;return route.abort("blockedbyclient");}
  return route.continue();
 });
 async function save(page:Page,state:string,note:string){
  const image="FE-UX-18-15-"+state+".png";await page.screenshot({path:join(dir,image),animations:"disabled"});
  proofs.push({id:"FE-UX-18-15",role:"organizationAdmin",viewport:"390x844",state,image,note});
 }
 try{
  const page=await ctx.newPage(),url=frontend+"/org/stores/view/?organizationId="+ids.organizationId+"&storeId="+ids.storeId+"&tab=products";
  async function editor(){
   const card=page.getByRole("heading",{name:product.name,exact:true}).first().locator("xpath=ancestor::article");
   await expect(card).toBeVisible();await card.getByRole("link",{name:"แก้ไขสินค้า"}).click();
   await expect(page.locator("#product-image-"+ids.productId)).toBeVisible();
  }
  await page.goto(url,{waitUntil:"domcontentloaded"});
  await editor();
  await page.locator("#product-image-"+ids.productId).setInputFiles({name:"old-commit.png",mimeType:"image/png",buffer:png});
  await page.getByRole("button",{name:"บันทึกรูป"}).click();
  await expect(page.getByText(/บันทึกรูปสินค้าแล้ว แต่ยังโหลดข้อมูลล่าสุดไม่สำเร็จ/)).toBeVisible();
  await expect(page.getByText(/เบราว์เซอร์ไม่อนุญาตให้บันทึกสถานะชั่วคราว/)).toBeVisible();
  expect([signed,put,patch,afterPatchGets]).toEqual([1,1,1,1]);
  await page.reload({waitUntil:"domcontentloaded"});
  await expect(page.locator("#product-image-"+ids.productId)).toBeVisible();
  const safe=page.getByRole("button",{name:"โหลดข้อมูลสินค้าล่าสุด"});
  await expect(safe).toBeEnabled();
  await expect(page.getByText(/เบราว์เซอร์ไม่อนุญาตให้จำสถานะตรวจสอบรูปสินค้า/)).toBeVisible();
  await expect(page.getByRole("button",{name:"ตรวจสอบข้อมูลล่าสุดอีกครั้ง"})).toHaveCount(0);
  expect([signed,put,patch]).toEqual([1,1,1]);
  await save(page,"storage-denied-reload-caution","After reload marker cannot be reconstructed; warn honestly and offer GET-only check before another upload");
  showLatest=true;
  await safe.click();
  await expect(page.getByText(/โหลดข้อมูลสินค้าล่าสุดแล้ว/)).toBeVisible();
  await expect(page.getByText("เปลี่ยนรูปสินค้า",{exact:true}).last()).toBeVisible();
  await expect(page.locator("[data-product-upload-feedback]")).toBeFocused();
  expect([signed,put,patch,blocked]).toEqual([1,1,1,0]);
  await save(page,"storage-denied-reload-GET-only-check","Read-only recheck returns current imageKey without signing/PUT/PATCH");
  await page.close();
 }finally{await ctx.close();}
 const b=JSON.parse(await readFile("quality-audit/coverage-baseline.json","utf8")) as {actions:Array<{id:string;roles:string[];statesToTest:string[]}>;shellActions:Array<{id:string;roles:string[];statesToTest:string[]}>};
 const entries:ActionOutcome[]=[...b.actions,...b.shellActions].map(a=>({actionId:a.id,role:a.roles[0]!,state:"all-declared-states",viewport:"not-executed",status:"NOT_TESTED",testRunId:runId,evidence:[],notes:"Exhaustive baseline state matrix unverified: "+a.statesToTest.join(", ")}));
 for(const p of proofs)entries.push({actionId:p.id,role:p.role,state:p.state,viewport:p.viewport,status:"PASS",testRunId:runId,evidence:[p.image],notes:p.note+"; synthetic backend, no writes"});
 await writeActionLedger(runId,entries);
 await writeFile(join(dir,"storage-denied-reload.json"),JSON.stringify({engine:browser.browserType().name(),proofs,signed,put,patch,afterPatchGets,blocked,realWrites:0,limitation:"With storage denied, a past PATCH marker cannot be guaranteed across reload; this test certifies a warning and read-only GET affordance, not automatic transaction recovery."},null,2)+"\n");
});
