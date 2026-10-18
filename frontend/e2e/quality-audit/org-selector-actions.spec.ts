import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { establishSeedRoleSession } from "../support/seed-auth";
import { localAuditTargets } from "./fixture-guard";
import { writeActionLedger, type ActionOutcome } from "./result-ledger";

const at="2026-10-17T12:00:00.000Z";
const orgs=Array.from({length:145},(_,i)=>({
  organizationId:"uxqa-select-org-"+String(i+1).padStart(3,"0"),
  name:i===144?"Final KMITL Club":"Campus Club "+String(i+1),
  description:"Organization selector synthetic "+i,status:"ACTIVE",
  createdBy:"uxqa-user",createdAt:at,updatedAt:at
}));
const hidden={organizationId:"uxqa-private-org",name:"Hidden Other Tenant",description:"Must stay hidden",status:"ACTIVE",createdBy:"uxqa-user",createdAt:at,updatedAt:at};
const created={organizationId:"uxqa-new-created-org",name:"UXQA New Organization",description:"Temporary UXQA description",status:"PENDING",createdBy:"uxqa-user",createdAt:at,updatedAt:at};
type Role="staff"|"organizationAdmin";
type Proof={id:string;role:Role;state:string;note:string;image:string};

test("Organization Selector: 145-org search, role navigation, 503 retry, safe creation states",async({browser,request})=>{
 test.setTimeout(190000);
 const {frontend}=localAuditTargets();
 const runId="uxqa-"+randomUUID(),dir=join("test-results","quality-audit",runId);
 await mkdir(dir,{recursive:true});
 const proofs:Proof[]=[];
 let actualWrites=0,syntheticPosts=0,reads=0,postMode:"409"|"200"="409",pause=false,force503=false,includeCreated=false;
 const suspended:{release?:()=>void}={};
 const contexts:BrowserContext[]=[];
 async function setup(role:Role) {
  const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:"reduce"});
  contexts.push(ctx);
  await establishSeedRoleSession(ctx,request,role);
  await ctx.route("**/*",async route=>{
    const req=route.request(),u=new URL(req.url()),p=u.pathname,method=req.method();
    if(method==="GET"&&p==="/api/v1/me"){
      const memberships=orgs.map((o,i)=>({
        organizationId:o.organizationId,
        role: role==="staff"||i===0?"STAFF":"ORGANIZATION_ADMIN",status:"ACTIVE"
      }));
      if(includeCreated)memberships.push({organizationId:created.organizationId,role:"ORGANIZATION_ADMIN",status:"ACTIVE"});
      await route.fulfill({status:200,contentType:"application/json",
        body:JSON.stringify({success:true,data:{user:{userId:"uxqa-user",name:"QA user",email:"qa@local.unistore.test",status:"ACTIVE",platformRole:null},memberships}})});
      return;
    }
    if(method==="GET"&&p==="/api/v1/organizations"){
      reads++;
      if(force503)await route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({success:false,error:{code:"SERVICE_UNAVAILABLE",message:"Synthetic selector outage"}})});
      else await route.fulfill({status:200,contentType:"application/json",
        body:JSON.stringify({success:true,data:{items:[...orgs,hidden,...(includeCreated?[created]:[])],nextCursor:null}})});
      return;
    }
    if(method==="POST"&&p==="/api/v1/organizations"){
      syntheticPosts++;
      expect(req.postDataJSON()).toEqual({name:created.name,description:created.description});
      if(pause)await new Promise<void>(resolve=>{suspended.release=resolve;});
      if(postMode==="409")await route.fulfill({status:409,contentType:"application/json",
        body:JSON.stringify({success:false,error:{code:"ORGANIZATION_CONFLICT",message:"UXQA synthetic conflict"}})});
      else {includeCreated=true;await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({success:true,data:created})});}
      return;
    }
    if(!["GET","HEAD","OPTIONS"].includes(method)){actualWrites++;await route.abort("blockedbyclient");return;}
    await route.continue();
  });
  return ctx;
 }
 async function proof(page:Page,id:string,role:Role,state:string,note:string){
  const image=id+"-"+role+"-"+state+".png";
  await page.screenshot({path:join(dir,image),animations:"disabled"});
  proofs.push({id,role,state,note,image});
 }
 try{
  const staff=await setup("staff");
  const s=await staff.newPage();
  force503=true;
  await s.goto(frontend+"/org/select/",{waitUntil:"domcontentloaded"});
  await expect(s.getByRole("heading",{name:"เลือกหน่วยงานที่จะทำงาน",level:1})).toBeVisible();
  const retry=s.getByRole("button",{name:"ลองโหลดอีกครั้ง"});
  await expect(retry).toBeVisible();
  await proof(s,"FE-UX-13-01","staff","503-retry-offered","GET 503 has in-page Retry and H1");
  await retry.click();
  await expect(retry).toBeVisible();
  await expect(s.locator("#organization-select-heading")).toBeFocused();
  await proof(s,"FE-UX-13-01","staff","repeated-503-focus","Second GET failure returns keyboard focus to persistent heading");
  force503=false;
  await retry.click();
  const search=s.getByRole("searchbox",{name:"ค้นหาหน่วยงานที่เข้าถึงได้"});
  await expect(search).toBeVisible();
  await expect(s.locator("#organization-select-heading")).toBeFocused();
  await expect(s.locator("header [role=status]")).toContainText("145");
  await proof(s,"FE-UX-13-01","staff","retry-loaded","Retry restores accessible directory");
  await expect(s.getByText(hidden.name)).toHaveCount(0);
  await expect(s.getByText(orgs[144]!.name)).toHaveCount(0);
  await search.fill("Final KMITL");
  await expect(s.getByText(orgs[144]!.name,{exact:true})).toBeVisible();
  await expect(s.getByText("Campus Club 1",{exact:true})).toHaveCount(0);
  await proof(s,"FE-UX-13-02","staff","search-145","Search resolves final member without showing unowned tenant");
  await s.getByRole("button",{name:"เข้าใช้งาน "+orgs[144]!.name}).click();
  await expect(s).toHaveURL(frontend+"/org/orders/?organizationId="+orgs[144]!.organizationId);
  await proof(s,"FE-UX-13-02","staff","staff-scope","Staff selection routes to scoped Orders workspace");
  await s.close();

  const admin=await setup("organizationAdmin");
  const p=await admin.newPage();
  await p.goto(frontend+"/org/select/",{waitUntil:"domcontentloaded"});
  await expect(p.getByRole("searchbox",{name:"ค้นหาหน่วยงานที่เข้าถึงได้"})).toBeVisible();
  await p.getByRole("searchbox",{name:"ค้นหาหน่วยงานที่เข้าถึงได้"}).fill("Final KMITL");
  await p.getByRole("button",{name:"เข้าใช้งาน "+orgs[144]!.name}).click();
  await expect(p).toHaveURL(frontend+"/org/dashboard/?organizationId="+orgs[144]!.organizationId);
  await proof(p,"FE-UX-13-02","organizationAdmin","admin-scope","Admin selection routes to scoped Dashboard");
  await p.goto(frontend+"/org/select/",{waitUntil:"domcontentloaded"});
  await expect(p.getByRole("heading",{name:"สร้างหน่วยงาน",level:2})).toBeVisible();
  const name=p.getByRole("textbox",{name:"ชื่อหน่วยงาน"});
  const description=p.getByRole("textbox",{name:"คำอธิบาย"});
  await expect(name).toBeVisible();
  await proof(p,"FE-UX-13-03","organizationAdmin","name-ready","Name input is labelled and available");
  await description.fill(created.description);
  await expect(description).toHaveValue(created.description);
  await proof(p,"FE-UX-13-04","organizationAdmin","description-edited","Description field persists user-entered text");
  await p.getByRole("button",{name:"สร้างหน่วยงาน",exact:true}).click();
  const summary=p.locator("#organization-create-error-summary");
  await expect(summary.getByRole("link",{name:"กรุณาระบุชื่อหน่วยงาน"})).toBeVisible();
  await expect(summary).toBeFocused();
  expect(syntheticPosts).toBe(0);
  await proof(p,"FE-UX-13-05","organizationAdmin","invalid-submit-focused","Empty name validation focuses summary without POST");
  await name.fill(created.name);
  await expect(name).toHaveValue(created.name);
  await proof(p,"FE-UX-13-03","organizationAdmin","valid-name","Name accepts a valid organization title");
  pause=true;
  await p.getByRole("button",{name:"สร้างหน่วยงาน",exact:true}).click();
  await expect.poll(()=>syntheticPosts).toBe(1);
  await expect(p.getByRole("button",{name:"กำลังสร้างหน่วยงาน"})).toBeDisabled();
  await proof(p,"FE-UX-13-05","organizationAdmin","pending-submit","Pending synthetic POST disables duplicate submit");
  pause=false;suspended.release?.();
  await expect(p.getByText("ดำเนินการไม่สำเร็จ")).toBeVisible();
  const feedback=p.locator("#organization-action-feedback");
  await expect(feedback).toBeFocused();
  await expect.poll(()=>feedback.evaluate(el=>{const b=el.getBoundingClientRect();return b.top<innerHeight&&b.bottom>0;})).toBe(true);
  await proof(p,"FE-UX-13-05","organizationAdmin","synthetic-409-focused","Intercepted conflict focuses a visible terminal error");
  postMode="200";
  await p.getByRole("button",{name:"สร้างหน่วยงาน",exact:true}).click();
  await expect(p).toHaveURL(frontend+"/org/settings/?organizationId="+created.organizationId);
  await proof(p,"FE-UX-13-05","organizationAdmin","synthetic-200-navigation","Synthetic accepted creation restores membership and routes to Settings");
  await p.close();
 } finally{suspended.release?.();await Promise.all(contexts.map(c=>c.close()));}
 expect(actualWrites).toBe(0);
 expect(syntheticPosts).toBe(2);
 expect(reads).toBeGreaterThan(2);
 const baseline=JSON.parse(await readFile("quality-audit/coverage-baseline.json","utf8")) as {
  actions:Array<{id:string;roles:string[];statesToTest:string[]}>;
  shellActions:Array<{id:string;roles:string[];statesToTest:string[]}>;
 };
 const outcomes:ActionOutcome[]=[...baseline.actions,...baseline.shellActions].map(a=>({
  actionId:a.id,role:a.roles[0]!,state:"all-declared-states",viewport:"not-executed",
  status:"NOT_TESTED",testRunId:runId,evidence:[],notes:"Full state matrix still unverified: "+a.statesToTest.join(", "),
 }));
 for(const proof of proofs)outcomes.push({actionId:proof.id,role:proof.role,state:proof.state,viewport:"390x844",
  status:"PASS",testRunId:runId,evidence:[proof.image],notes:proof.note+"; GET mocked and organization POST intercepted"});
 await writeActionLedger(runId,outcomes);
 await writeFile(join(dir,"org-select-actions.json"),JSON.stringify({
  proofs,distinctIds:[...new Set(proofs.map(p=>p.id))],actualWrites,syntheticPosts,reads,
  limitation:"No real Organization created or altered; synthetic /me, /organizations GET and intercepted POST only"
 },null,2)+"\n");
});
