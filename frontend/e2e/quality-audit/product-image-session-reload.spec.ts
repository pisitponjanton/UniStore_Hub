import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { establishSeedRoleSession, LOCAL_SEED_ENTITY_IDS as ids } from "../support/seed-auth";
import { localAuditTargets } from "./fixture-guard";
import { writeActionLedger, type ActionOutcome } from "./result-ledger";

const at="2026-10-17T12:00:00.000Z",root="/api/v1/organizations/"+ids.organizationId;
const otherId="77777777-7777-4777-8777-777777777778";
const productA={productId:ids.productId,organizationId:ids.organizationId,storeId:ids.storeId,name:"UXQA Shirt A",description:"Synthetic",status:"ACTIVE",imageKey:null as string|null,imageUrl:null,variants:[],createdAt:at,updatedAt:at};
const productB={...productA,productId:otherId,name:"UXQA Shirt B"};
const store={storeId:ids.storeId,organizationId:ids.organizationId,name:"UXQA Store",description:"Synthetic",status:"ACTIVE",createdAt:at,updatedAt:at};
const imageKey="uxqa-acknowledged-before-route-change";
const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y2A2SYAAAAASUVORK5CYII=","base64");
type Proof={id:"FE-UX-18-15";state:string;image:string;note:string;role:"organizationAdmin";viewport:"390x844"};
test("imageKey post-PATCH pending survives product switch, page exit and reload",async({browser,request})=>{
 test.setTimeout(180000);
 const {frontend}=localAuditTargets(),runId="uxqa-"+randomUUID(),dir=join("test-results","quality-audit",runId);
 await mkdir(dir,{recursive:true});
 const proofs:Proof[]=[];
 let committed=false,recovered=false,firstReadback=false,signs=0,puts=0,patches=0,afterCommitGets=0,blockedWrites=0;
 const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:"reduce"});
 await establishSeedRoleSession(ctx,request,"organizationAdmin");
 await ctx.route("**/*",async route=>{
  const req=route.request(),p=new URL(req.url()).pathname,m=req.method();
  const ok=(data:unknown)=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({success:true,data})});
  if(m==="GET"&&p===root+"/stores")return ok({items:[store],nextCursor:null});
  if(m==="GET"&&p===root+"/products")return ok({items:[committed&&recovered?{...productA,imageKey}:productA,productB],nextCursor:null});
  if(m==="GET"&&p===root+"/products/"+otherId)return ok(productB);
  if(m==="GET"&&p===root+"/products/"+ids.productId){
   if(!committed)return ok(productA);
   afterCommitGets++;
   if(recovered)return ok({...productA,imageKey});
   if(!firstReadback){firstReadback=true;return route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({success:false,error:{code:"SERVICE_UNAVAILABLE",message:"UXQA synthetic readback outage"}})});}
   return ok(productA);
  }
  if(m==="POST"&&p===root+"/products/"+ids.productId+"/image-upload-url"){
   signs++;expect(req.postDataJSON()).toEqual({contentType:"image/png"});
   return ok({objectKey:imageKey,method:"PUT",url:frontend+"/__uxqa_switch_reload__/image",expiresInSeconds:900});
  }
  if(m==="PUT"&&p==="/__uxqa_switch_reload__/image"){
   puts++;expect(req.headers()["content-type"]).toBe("image/png");
   return route.fulfill({status:200,body:""});
  }
  if(m==="PATCH"&&p===root+"/products/"+ids.productId){
   patches++;expect(req.postDataJSON()).toEqual({imageKey});
   committed=true;return ok({...productA,imageKey});
  }
  if(!["GET","HEAD","OPTIONS"].includes(m)){blockedWrites++;return route.abort("blockedbyclient");}
  return route.continue();
 });
 async function snap(page:Page,state:string,note:string){
  const image="FE-UX-18-15-"+state+".png";
  await page.screenshot({path:join(dir,image),animations:"disabled"});
  proofs.push({id:"FE-UX-18-15",state,image,note,role:"organizationAdmin",viewport:"390x844"});
 }
 const routeURL=frontend+"/org/stores/view/?organizationId="+ids.organizationId+"&storeId="+ids.storeId+"&tab=products";
 const markerCount=async(page:Page)=>page.evaluate(()=>Object.keys(sessionStorage).filter(k=>k.includes("productImageVerification.v1")).length);
 async function edit(page:Page,productName:string){
  const heading=page.getByRole("heading",{name:productName,exact:true}).first();
  await expect(heading).toBeVisible();
  await heading.locator("xpath=ancestor::article").getByRole("link",{name:"แก้ไขสินค้า"}).click();
  await expect(page.getByRole("heading",{name:"รูปสินค้า"})).toBeVisible();
 }
 try{
  const page=await ctx.newPage();
  await page.goto(routeURL,{waitUntil:"domcontentloaded"});
  await edit(page,productA.name);
  await page.locator("#product-image-"+ids.productId).setInputFiles({name:"uxqa-original.png",mimeType:"image/png",buffer:png});
  await page.getByRole("button",{name:"บันทึกรูป"}).click();
  await expect(page.getByText(/บันทึกรูปสินค้าแล้ว แต่ยังโหลดข้อมูลล่าสุดไม่สำเร็จ/)).toBeVisible();
  await expect.poll(()=>markerCount(page)).toBe(1);
  await snap(page,"committed-session-marker","Acknowledged PATCH records scoped tab-session marker before failed readback");
  expect([signs,puts,patches]).toEqual([1,1,1]);

  // Switching products remounts the uploader; the old verification state must not leak into B.
  await page.getByRole("link",{name:/กลับไปรายการสินค้า/}).click();
  await edit(page,productB.name);
  await expect(page.locator("#product-image-"+otherId)).toBeEnabled();
  await expect(page.getByRole("button",{name:"บันทึกรูป"})).toHaveCount(0);
  await expect(page.getByRole("button",{name:"ตรวจสอบข้อมูลล่าสุดอีกครั้ง"})).toHaveCount(0);
  await snap(page,"other-product-independent","Product B has clean upload state; Product A marker remains scoped");
  await page.getByRole("link",{name:/กลับไปรายการสินค้า/}).click();
  await edit(page,productA.name);
  await expect(page.getByRole("button",{name:"ตรวจสอบข้อมูลล่าสุดอีกครั้ง"})).toBeEnabled();
  await expect(page.locator("#product-image-"+ids.productId)).toBeDisabled();
  await expect(page.getByRole("button",{name:"บันทึกรูป"})).toHaveCount(0);
  await snap(page,"return-to-product-pending","Reselecting A restores readback-only recovery without re-upload");

  // Leave the page, return and open A, then reload the whole browser page.
  await page.goto(frontend+"/",{waitUntil:"domcontentloaded"});
  await page.goto(routeURL,{waitUntil:"domcontentloaded"});
  await edit(page,productA.name);
  await expect(page.getByRole("button",{name:"ตรวจสอบข้อมูลล่าสุดอีกครั้ง"})).toBeEnabled();
  await snap(page,"route-exit-return","Navigation away/back preserves A's acknowledged marker");
  await page.reload({waitUntil:"domcontentloaded"});
  await expect(page.locator("#product-image-"+ids.productId)).toBeVisible();
  const retry=page.getByRole("button",{name:"ตรวจสอบข้อมูลล่าสุดอีกครั้ง"});
  await expect(retry).toBeEnabled();
  await expect(page.locator("#product-image-"+ids.productId)).toBeDisabled();
  await snap(page,"full-reload-restored","Full reload restores pending committed imageKey; Upload remains blocked");
  expect([signs,puts,patches]).toEqual([1,1,1]);

  // Stale successful GET must not clear the marker or allow duplicate write.
  await retry.click();
  await expect(page.getByText(/ยังยืนยันผลการบันทึกรูปไม่ได้/)).toBeVisible();
  await expect.poll(()=>markerCount(page)).toBe(1);
  await expect(retry).toBeEnabled();
  await snap(page,"reload-stale-get-only","Post-reload GET 200 with old imageKey leaves safe verification-only state");
  recovered=true;
  await retry.click();
  await expect(page.getByText("อัปโหลดและบันทึกรูปสินค้าเรียบร้อยแล้ว")).toBeVisible();
  await expect.poll(()=>markerCount(page)).toBe(0);
  await expect(page.getByText("เปลี่ยนรูปสินค้า",{exact:true}).last()).toBeVisible();
  await expect(page.getByRole("button",{name:"บันทึกรูป"})).toHaveCount(0);
  await snap(page,"verified-clears-scoped-marker","Matching GET clears pending marker and restores normal editor");
  expect([signs,puts,patches,blockedWrites]).toEqual([1,1,1,0]);
  await page.close();
 }finally{await ctx.close();}
 const b=JSON.parse(await readFile("quality-audit/coverage-baseline.json","utf8")) as {actions:Array<{id:string;roles:string[];statesToTest:string[]}>;shellActions:Array<{id:string;roles:string[];statesToTest:string[]}>};
 const entries:ActionOutcome[]=[...b.actions,...b.shellActions].map(x=>({actionId:x.id,role:x.roles[0]!,state:"all-declared-states",viewport:"not-executed",status:"NOT_TESTED",testRunId:runId,evidence:[],notes:"Full matrix unverified: "+x.statesToTest.join(", ")}));
 for(const p of proofs)entries.push({actionId:p.id,role:p.role,state:p.state,viewport:p.viewport,status:"PASS",testRunId:runId,evidence:[p.image],notes:p.note+"; all browser writes intercepted"});
 await writeActionLedger(runId,entries);
 await writeFile(join(dir,"product-image-reload-switch.json"),JSON.stringify({browserEngine:browser.browserType().name(),proofs,signs,puts,patches,afterCommitGets,blockedWrites,actualBusinessWrites:0,limitation:"Tab-only sessionStorage and synthetic GET/POST/PUT/PATCH; not persistence or production security certification."},null,2)+"\n");
});
