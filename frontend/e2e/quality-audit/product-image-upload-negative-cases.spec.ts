import {randomUUID} from "node:crypto";
import {mkdir,readFile,writeFile} from "node:fs/promises";
import {join} from "node:path";
import {expect,test,type Page} from "@playwright/test";
import {establishSeedRoleSession,LOCAL_SEED_ENTITY_IDS as ids} from "../support/seed-auth";
import {localAuditTargets} from "./fixture-guard";
import {writeActionLedger,type ActionOutcome} from "./result-ledger";

const at="2026-10-17T12:00:00.000Z",root="/api/v1/organizations/"+ids.organizationId,res=root+"/products/"+ids.productId;
const store={storeId:ids.storeId,organizationId:ids.organizationId,name:"UXQA Store",description:"Synthetic",status:"ACTIVE",createdAt:at,updatedAt:at};
const product={productId:ids.productId,organizationId:ids.organizationId,storeId:ids.storeId,name:"UXQA Shirt",description:"Synthetic",status:"ACTIVE",imageKey:null as string|null,imageUrl:null,variants:[],createdAt:at,updatedAt:at};
const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y2A2SYAAAAASUVORK5CYII=","base64");
type Proof={id:string;state:string;image:string;note:string};
test("image upload signing/PUT/PATCH negative states + focused recovery at 320px",async({browser,request})=>{
 test.setTimeout(180000);
 const {frontend}=localAuditTargets(),runId="uxqa-"+randomUUID(),dir=join("test-results","quality-audit",runId);
 await mkdir(dir,{recursive:true});
 const proof:Proof[]=[];let current={...product},signs=0,puts=0,patches=0,gets=0,writes=0;
 const ctx=await browser.newContext({viewport:{width:320,height:700},reducedMotion:"reduce"});
 await establishSeedRoleSession(ctx,request,"organizationAdmin");
 await ctx.route("**/*",async r=>{
  const q=r.request(),p=new URL(q.url()).pathname,m=q.method();
  const ok=(data:unknown)=>r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({success:true,data})});
  const err=(status:number,code:string)=>r.fulfill({status,contentType:"application/json",body:JSON.stringify({success:false,error:{code,message:"UXQA simulated error"}})});
  if(m==="GET"&&p===root+"/stores")return ok({items:[store],nextCursor:null});
  if(m==="GET"&&p===root+"/products")return ok({items:[current],nextCursor:null});
  if(m==="GET"&&p===res){gets++;return ok(current);}
  if(m==="POST"&&p===res+"/image-upload-url"){
   signs++;expect(q.postDataJSON()).toEqual({contentType:"image/png"});
   if(signs===1)return err(503,"SERVICE_UNAVAILABLE");
   return ok({objectKey:"uxqa-negative-"+signs,url:frontend+"/__uxqa_signed_matrix__/file-"+signs,method:"PUT",expiresInSeconds:900});
  }
  if(m==="PUT"&&p.startsWith("/__uxqa_signed_matrix__/")){
   puts++;expect(q.headers()["content-type"]).toBe("image/png");
   return r.fulfill({status:puts===1?500:200,body:puts===1?"UXQA synthetic storage error":""});
  }
  if(m==="PATCH"&&p===res){
   patches++;expect(q.postDataJSON()).toEqual({imageKey:"uxqa-negative-"+signs});
   if(patches===1)return err(409,"CONFLICT");
   current={...current,imageKey:"uxqa-negative-"+signs};
   return ok(current);
  }
  if(!["GET","HEAD","OPTIONS"].includes(m)){writes++;return r.abort("blockedbyclient");}
  return r.continue();
 });
 async function snap(page:Page,id:string,state:string,note:string){
  const image=id+"-"+state+".png";await page.screenshot({path:join(dir,image),animations:"disabled"});
  proof.push({id,state,image,note});
 }
 try{
  const page=await ctx.newPage();
  await page.goto(frontend+"/org/stores/view/?organizationId="+ids.organizationId+"&storeId="+ids.storeId+"&tab=products",{waitUntil:"domcontentloaded"});
  const card=page.getByRole("heading",{name:product.name,exact:true}).first().locator("xpath=ancestor::article");
  await expect(card).toBeVisible();
  await card.getByRole("link",{name:"แก้ไขสินค้า"}).click();
  const input=page.locator("#product-image-"+ids.productId),upload=page.getByRole("button",{name:"อัปโหลดรูปสินค้า"});
  await expect(input).toBeEnabled();
  await input.setInputFiles({name:"too-large.png",mimeType:"image/png",buffer:Buffer.alloc(5*1024*1024+1,0)});
  await expect(page.getByText("รูปสินค้าต้องมีขนาดไม่เกิน 5 MiB")).toBeVisible();
  await expect(upload).toBeDisabled();expect(signs).toBe(0);
  await snap(page,"FE-UX-18-14","size-exceeded","5MiB+1 rejected before network");
  await input.setInputFiles({name:"small-safe.png",mimeType:"image/png",buffer:png});
  await expect(upload).toBeEnabled();
  await snap(page,"FE-UX-18-14","valid-reselection","Valid file replaces bad selection");
  for(const step of [
   {state:"signing-503",signs:1,puts:0,patches:0},
   {state:"put-500",signs:2,puts:1,patches:0},
   {state:"patch-409",signs:3,puts:2,patches:1},
  ]){
   await upload.click();
   await expect(page.getByRole("alert").filter({hasText:"อัปโหลดไม่สำเร็จ"})).toBeVisible();
   await expect(upload).toBeEnabled();
   await expect(page.getByText("small-safe.png")).toBeVisible();
   expect([signs,puts,patches]).toEqual([step.signs,step.puts,step.patches]);
   const feedback=page.locator("[data-product-upload-feedback]");
   await expect(feedback).toBeFocused();
   await expect.poll(()=>feedback.evaluate(el=>{const b=el.getBoundingClientRect();return b.top<innerHeight&&b.bottom>0&&b.left>=-1&&b.right<=innerWidth+1;})).toBe(true);
   await snap(page,"FE-UX-18-15",step.state,"Terminal error focused and visible on 320 CSS pixel viewport");
  }
  await upload.click();
  await expect(page.getByText("อัปโหลดและบันทึกรูปสินค้าเรียบร้อยแล้ว")).toBeVisible();
  await expect(page.locator("[data-product-upload-feedback]")).toBeFocused();
  await expect(page.getByText("มีรูปสินค้าแล้ว").last()).toBeVisible();
  expect([signs,puts,patches]).toEqual([4,3,2]);
  await snap(page,"FE-UX-18-15","error-recovery-success","Intercepted POST/PUT/PATCH/GET success clears retry and focuses completion");
  const dims=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:innerWidth}));
  expect(dims.scroll).toBeLessThanOrEqual(dims.viewport+2);
  await snap(page,"FE-UX-18-15","narrow-width-no-overflow","Entire page fits 320 CSS pixel viewport; not native 200% zoom");
  await page.close();
 }finally{await ctx.close();}
 expect(writes).toBe(0);expect(gets).toBeGreaterThanOrEqual(2);
 const baseline=JSON.parse(await readFile("quality-audit/coverage-baseline.json","utf8")) as {actions:Array<{id:string;roles:string[];statesToTest:string[]}>;shellActions:Array<{id:string;roles:string[];statesToTest:string[]}>};
 const entries:ActionOutcome[]=[...baseline.actions,...baseline.shellActions].map(a=>({actionId:a.id,role:a.roles[0]!,state:"all-declared-states",viewport:"not-executed",status:"NOT_TESTED",testRunId:runId,evidence:[],notes:"Full matrix unverified: "+a.statesToTest.join(", ")}));
 for(const p of proof)entries.push({actionId:p.id,role:"organizationAdmin",state:p.state,viewport:"320x700",status:"PASS",testRunId:runId,evidence:[p.image],notes:p.note+"; intercepted requests only"});
 await writeActionLedger(runId,entries);
 await writeFile(join(dir,"product-upload-negative-matrix.json"),JSON.stringify({engine:browser.browserType().name(),proof,signs,puts,patches,gets,writes,limitation:"All write requests intercepted; 320 CSS px is not browser-native 200% zoom."},null,2)+"\n");
});
