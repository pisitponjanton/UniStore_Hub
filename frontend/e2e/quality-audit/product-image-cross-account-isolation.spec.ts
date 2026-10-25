import {randomUUID} from "node:crypto";
import {mkdir,readFile,writeFile} from "node:fs/promises";
import {join} from "node:path";
import {expect,test,type Page} from "@playwright/test";
import {getSeedRoleToken,getSeedRoleCredentials,LOCAL_SEED_ENTITY_IDS as ids} from "../support/seed-auth";
import {localAuditTargets} from "./fixture-guard";
import {writeActionLedger,type ActionOutcome} from "./result-ledger";

const org="/api/v1/organizations/"+ids.organizationId,resource=org+"/products/"+ids.productId;
const at="2026-10-17T12:00:00.000Z",key="uxqa-acknowledged-admin-before-logout";
const product={productId:ids.productId,organizationId:ids.organizationId,storeId:ids.storeId,name:"UXQA Shirt",description:"Synthetic",status:"ACTIVE",imageKey:null as string|null,imageUrl:null,variants:[],createdAt:at,updatedAt:at};
const store={storeId:ids.storeId,organizationId:ids.organizationId,name:"UXQA Store",description:"Synthetic",status:"ACTIVE",createdAt:at,updatedAt:at};
const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y2A2SYAAAAASUVORK5CYII=","base64");
type Proof={id:string;role:string;state:string;image:string;note:string};
test("same-tab Account A logout → Staff login → Admin login isolates pending image verification",async({browser,request})=>{
 test.setTimeout(200000);
 const {frontend}=localAuditTargets(),runId="uxqa-"+randomUUID(),dir=join("test-results","quality-audit",runId);
 await mkdir(dir,{recursive:true});
 const tokens={organizationAdmin:await getSeedRoleToken(request,"organizationAdmin"),staff:await getSeedRoleToken(request,"staff")};
 const proofs:Proof[]=[];
 let logins=0,signs=0,puts=0,patches=0,postCommitGets=0,blocked=0,committed=false,readbackVerified=false;
 const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:"reduce"});
 await ctx.route("**/*",async route=>{
  const req=route.request(),path=new URL(req.url()).pathname,method=req.method();
  const ok=(data:unknown)=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({success:true,data})});
  if(method==="POST"&&path==="/api/v1/auth/login"){
   const payload=req.postDataJSON() as {email:string;password:string};
   const role=payload.email===getSeedRoleCredentials("organizationAdmin").email?"organizationAdmin":
    payload.email===getSeedRoleCredentials("staff").email?"staff":null;
   if(!role)throw new Error("Unexpected login identity");
   expect(payload.password).toBe(getSeedRoleCredentials(role).password);
   logins++;return ok({token:tokens[role]});
  }
  if(method==="GET"&&path===org+"/stores")return ok({items:[store],nextCursor:null});
  if(method==="GET"&&path===org+"/products")return ok({items:[product],nextCursor:null});
  if(method==="GET"&&path===resource){
   if(!committed)return ok(product);
   postCommitGets++;
   if(postCommitGets===1)return route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({success:false,error:{code:"SERVICE_UNAVAILABLE",message:"Synthetic unverified readback"}})});
   return ok(readbackVerified?{...product,imageKey:key}:product);
  }
  if(method==="POST"&&path===resource+"/image-upload-url"){
   signs++;expect(req.postDataJSON()).toEqual({contentType:"image/png"});
   return ok({objectKey:key,method:"PUT",url:frontend+"/__uxqa_account_switch__/object",expiresInSeconds:900});
  }
  if(method==="PUT"&&path==="/__uxqa_account_switch__/object"){
   puts++;return route.fulfill({status:200,body:""});
  }
  if(method==="PATCH"&&path===resource){
   patches++;expect(req.postDataJSON()).toEqual({imageKey:key});committed=true;
   return ok({...product,imageKey:key});
  }
  if(!["GET","HEAD","OPTIONS"].includes(method)){blocked++;return route.abort("blockedbyclient");}
  return route.continue();
 });
 async function screenshot(page:Page,state:string,role:string,note:string,id="FE-UX-18-15"){
  const image=id+"-"+state+".png";
  await page.screenshot({path:join(dir,image),animations:"disabled"});
  proofs.push({id,role,state,image,note});
 }
 async function login(page:Page,role:"staff"|"organizationAdmin"){
  await page.goto(frontend+"/login/",{waitUntil:"domcontentloaded"});
  await expect(page.locator("#login-email")).toBeVisible();
  await page.locator("#login-email").fill(getSeedRoleCredentials(role).email);
  await page.locator("#login-password").fill(getSeedRoleCredentials(role).password);
  await page.getByRole("button",{name:"เข้าสู่ระบบ",exact:true}).click();
  await expect(page).toHaveURL(frontend+"/",{timeout:20000});
  await expect.poll(()=>page.evaluate(()=>window.sessionStorage.getItem("unistoreHub.accessToken"))).toBe(tokens[role]);
 }
 async function logout(page:Page){
  await page.getByRole("button",{name:"เปิดเมนูหลัก"}).click();
  const drawer=page.getByRole("dialog",{name:"เมนูหลัก"});
  await drawer.getByRole("button",{name:"ออกจากระบบ"}).click();
  await expect(page).toHaveURL(/\/(?:login\/?(?:\?.*)?)?$/);
  await expect.poll(()=>page.evaluate(()=>window.sessionStorage.getItem("unistoreHub.accessToken"))).toBeNull();
 }
 const target=frontend+"/org/stores/view/?organizationId="+ids.organizationId+"&storeId="+ids.storeId+"&tab=products";
 async function edit(page:Page){
  const card=page.getByRole("heading",{name:product.name,exact:true}).first().locator("xpath=ancestor::article");
  await expect(card).toBeVisible();
  await card.getByRole("link",{name:"แก้ไขสินค้า"}).click();
  try {
   await expect(page.locator("#product-image-"+ids.productId)).toBeVisible();
  } catch(error) {
   console.log("UXQA editor diagnostics",await page.evaluate(()=>({url:location.href,body:document.body.innerText.slice(-1800),buttons:[...document.querySelectorAll("button")].map(e=>e.textContent?.trim()).filter(Boolean).slice(-28),token:!!sessionStorage.getItem("unistoreHub.accessToken")})));
   throw error;
  }
 }
 try{
  const page=await ctx.newPage();
  await login(page,"organizationAdmin");
  await page.goto(target,{waitUntil:"domcontentloaded"});
  await edit(page);
  await page.locator("#product-image-"+ids.productId).setInputFiles({name:"uxqa-account-a.png",mimeType:"image/png",buffer:png});
  await page.getByRole("button",{name:"อัปโหลดรูปสินค้า"}).click();
  await expect(page.getByText(/บันทึกรูปสินค้าแล้ว แต่ยังโหลดข้อมูลล่าสุดไม่สำเร็จ/)).toBeVisible();
  await expect(page.getByRole("button",{name:"ตรวจสอบข้อมูลล่าสุดอีกครั้ง"})).toBeEnabled();
  expect([signs,puts,patches]).toEqual([1,1,1]);
  await screenshot(page,"admin-saved-unverified","organizationAdmin","Admin has committed image awaiting readback");
  await logout(page);
  await login(page,"staff");
  await page.goto(target,{waitUntil:"domcontentloaded"});
  await expect(page.getByRole("heading",{name:"ไม่มีสิทธิ์เข้าถึง"})).toBeVisible();
  await expect(page.getByRole("button",{name:"ตรวจสอบข้อมูลล่าสุดอีกครั้ง"})).toHaveCount(0);
  await expect(page.locator("#product-image-"+ids.productId)).toHaveCount(0);
  await screenshot(page,"staff-cannot-access-admin-upload","staff","Second local staff account receives forbidden and cannot access upload or verification", "FE-UX-18-15");
  await page.goto(frontend+"/org/orders/?organizationId="+ids.organizationId,{waitUntil:"domcontentloaded"});
  await expect(page.getByRole("button",{name:"เปิดเมนูหลัก"})).toBeVisible();
  await logout(page);
  await login(page,"organizationAdmin");
  await page.goto(target,{waitUntil:"domcontentloaded"});
  await edit(page);
  const retry=page.getByRole("button",{name:"ตรวจสอบข้อมูลล่าสุดอีกครั้ง"});
  await expect(retry).toBeEnabled();
  await expect(page.locator("#product-image-"+ids.productId)).toBeDisabled();
  expect([signs,puts,patches]).toEqual([1,1,1]);
  await screenshot(page,"admin-resumes-after-staff","organizationAdmin","Original admin resumes scoped GET-only pending state without second write");
  readbackVerified=true;
  await retry.click();
  await expect(page.getByText("อัปโหลดและบันทึกรูปสินค้าเรียบร้อยแล้ว")).toBeVisible();
  await expect(retry).toHaveCount(0);
  expect([signs,puts,patches,blocked,logins]).toEqual([1,1,1,0,3]);
  await screenshot(page,"admin-verifies-after-switch","organizationAdmin","Only original account sees completed readback after matching GET");
  await page.close();
 }finally{await ctx.close();}
 const base=JSON.parse(await readFile("quality-audit/coverage-baseline.json","utf8")) as {actions:Array<{id:string;roles:string[];statesToTest:string[]}>;shellActions:Array<{id:string;roles:string[];statesToTest:string[]}>};
 const outcomes:ActionOutcome[]=[...base.actions,...base.shellActions].map(a=>({actionId:a.id,role:a.roles[0]!,state:"all-declared-states",viewport:"not-executed",status:"NOT_TESTED",testRunId:runId,evidence:[],notes:"Full declared-state matrix unverified: "+a.statesToTest.join(", ")}));
 // Upload actions are declared only for Org Admin; Staff's forbidden check is
 // retained in the scenario JSON/screenshot, not misclassified as Staff PASS.
 for(const p of proofs.filter(p=>p.role==="organizationAdmin"))outcomes.push({actionId:p.id,role:p.role,state:p.state,viewport:"390x844",status:"PASS",testRunId:runId,evidence:[p.image],notes:p.note+"; local seed auth tokens and synthetic product writes"});
 await writeActionLedger(runId,outcomes);
 await writeFile(join(dir,"cross-account-image-verification.json"),JSON.stringify({engine:browser.browserType().name(),proofs,logins,signs,puts,patches,postCommitGets,blocked,realBusinessWrites:0,limitation:"Staff is forbidden from org Products; does not simulate a second authorized organization admin."},null,2)+"\n");
});
