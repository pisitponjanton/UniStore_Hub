import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { establishSeedRoleSession } from "../support/seed-auth";
import { localAuditTargets } from "./fixture-guard";
import { writeActionLedger, type ActionOutcome } from "./result-ledger";

const list="/api/v1/platform/organizations",stamp="2026-10-17T12:00:00.000Z";
const base=[
 {organizationId:"uxqa-platform-pending",name:"UXQA Pending Organization",description:"Synthetic PENDING",status:"PENDING",createdBy:"test-only",createdAt:stamp,updatedAt:stamp},
 {organizationId:"uxqa-platform-active",name:"UXQA Active Organization",description:"Synthetic ACTIVE",status:"ACTIVE",createdBy:"test-only",createdAt:stamp,updatedAt:stamp},
 {organizationId:"uxqa-platform-suspended",name:"UXQA Suspended Organization",description:"Synthetic SUSPENDED",status:"SUSPENDED",createdBy:"test-only",createdAt:stamp,updatedAt:stamp},
] as const;
type Proof={id:string;state:string;notes:string;image:string};
const actions=[
 {id:"FE-UX-27-01",type:"approve",org:"uxqa-platform-pending",name:"UXQA Pending Organization",trigger:"อนุมัติ",dialog:"อนุมัติ UXQA Pending Organization?",confirm:"ยืนยันอนุมัติ",expected:"ACTIVE"},
 {id:"FE-UX-27-02",type:"suspend",org:"uxqa-platform-active",name:"UXQA Active Organization",trigger:"ระงับหน่วยงาน",dialog:"ระงับ UXQA Active Organization?",confirm:"ยืนยันระงับ",expected:"SUSPENDED"},
] as const;

test("Platform organization confirmations, cancellation, pending lock, 409 and 200 with no backend writes",async({browser,request})=>{
 test.setTimeout(195000);
 const {frontend}=localAuditTargets(),runId="uxqa-"+randomUUID(),path=join("test-results","quality-audit",runId);
 await mkdir(path,{recursive:true});
 const records=[...base].map(o=>({...o,status:o.status as "PENDING"|"ACTIVE"|"SUSPENDED"}));
 const proofs:Proof[]=[];
 const state:Record<string,{mode:"conflict"|"success";release:(()=>void)|null;pending: boolean;count:number}>={
   approve:{mode:"conflict",release:null,pending:false,count:0},
   suspend:{mode:"conflict",release:null,pending:false,count:0},
 };
 let rejectedWrites=0,listGets=0;
 const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:"reduce"});
 await establishSeedRoleSession(ctx,request,"platformAdmin");
 await ctx.route("**/*",async route=>{
   const req=route.request(),u=new URL(req.url());
   if(req.method()==="GET"&&u.pathname===list){
     listGets++;
     await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({success:true,data:{items:records,nextCursor:null}})});return;
   }
   const action=actions.find(a=>req.method()==="POST"&&u.pathname===list+"/"+a.org+"/"+a.type);
   if(action){
     const stateEntry=state[action.type];stateEntry.count++;
     if(stateEntry.pending)await new Promise<void>(resolve=>{stateEntry.release=resolve;});
     if(stateEntry.mode==="conflict"){
       await route.fulfill({status:409,contentType:"application/json",
         body:JSON.stringify({success:false,error:{code:"INVALID_STATUS_TRANSITION",message:"Synthetic conflicting organization status"}})});return;
     }
     const target=records.find(o=>o.organizationId===action.org)!;target.status=action.expected;
     await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({success:true,data:target})});return;
   }
   if(!["GET","HEAD","OPTIONS"].includes(req.method())){rejectedWrites++;await route.abort("blockedbyclient");return;}
   await route.continue();
 });
 async function proof(page:Page,id:string,state:string,notes:string){
   const image=id+"-"+state+".png";await page.screenshot({path:join(path,image),animations:"disabled"});
   proofs.push({id,state,notes,image});
 }
 try{
   const page=await ctx.newPage();
   await page.goto(frontend+"/platform/organizations/",{waitUntil:"domcontentloaded"});
   await expect(page.getByRole("heading",{name:"จัดการหน่วยงาน",level:1})).toBeVisible({timeout:16000});
   const suspended=page.getByRole("article").filter({has:page.getByRole("heading",{name:"UXQA Suspended Organization"})});
   await expect(suspended.getByText("ไม่มี action เพิ่มเติมในสถานะนี้")).toBeVisible();
   await proof(page,"FE-UX-27-01","status-eligibility","Suspended organizations cannot be approved or suspended again");
   for(const a of actions){
     const row=page.getByRole("article").filter({has:page.getByRole("heading",{name:a.name})});
     const trigger=row.getByRole("button",{name:a.trigger,exact:true});
     await expect(trigger).toBeEnabled();
     await trigger.click();
     let modal=page.getByRole("dialog",{name:a.dialog});
     await expect(modal.getByRole("button",{name:a.confirm})).toBeVisible();
     await proof(page,a.id,"dialog-open","Dialog names affected organization and state transition");
     await modal.getByRole("button",{name:"ยกเลิก",exact:true}).click();
     await expect(modal).not.toBeVisible();
     await expect(trigger).toBeFocused();
     expect(state[a.type].count).toBe(0);
     await proof(page,a.id,"dialog-cancel","Cancel restores trigger focus without POST");

     state[a.type].pending=true;
     await trigger.click();
     modal=page.getByRole("dialog",{name:a.dialog});
     await modal.getByRole("button",{name:a.confirm}).click();
     await expect.poll(()=>state[a.type].count).toBe(1);
     await expect(modal.getByRole("button",{name:"กำลังดำเนินการ"})).toBeDisabled();
     await page.keyboard.press("Escape");
     await expect(modal).toBeVisible();
     await proof(page,a.id,"pending-locked","Pending confirmation blocks further click and Escape");
     state[a.type].release?.();state[a.type].pending=false;
     await expect(modal).not.toBeVisible();
     const feedback=page.locator("#platform-action-feedback");
     await expect(feedback).toBeFocused();
     await expect(feedback.getByRole("alert")).toContainText(/สถานะหน่วยงานเปลี่ยนไปแล้ว/);
     await expect.poll(()=>feedback.evaluate(el=>{const r=el.getBoundingClientRect();return r.top<innerHeight&&r.bottom>0;})).toBe(true);
     await expect(trigger).toBeEnabled();
     await proof(page,a.id,"409-focus-retryable","Synthetic 409 closes dialog, announces visible error and preserves retry action");
     state[a.type].mode="success";
     await trigger.click();
     await page.getByRole("dialog",{name:a.dialog}).getByRole("button",{name:a.confirm}).click();
     await expect(feedback.getByRole("status")).toBeVisible();
     await expect(feedback).toBeFocused();
     await expect(trigger).toHaveCount(0);
     await proof(page,a.id,"synthetic-200","Browser-intercepted 200 updates visible eligibility and focused confirmation");
     expect(state[a.type].count).toBe(2);
   }
   await page.close();
 }finally{
   for(const a of actions)state[a.type].release?.();
   await ctx.close();
 }
 expect(rejectedWrites).toBe(0);
 const baseline=JSON.parse(await readFile("quality-audit/coverage-baseline.json","utf8")) as {
   actions:Array<{id:string;roles:string[];statesToTest:string[]}>;
   shellActions:Array<{id:string;roles:string[];statesToTest:string[]}>;
 };
 const outcomes:ActionOutcome[]=[...baseline.actions,...baseline.shellActions].map(a=>({
   actionId:a.id,role:a.roles[0]!,state:"all-declared-states",viewport:"not-executed",status:"NOT_TESTED",
   testRunId:runId,evidence:[],notes:"All state variants not yet certified: "+a.statesToTest.join(", "),
 }));
 for(const p of proofs)outcomes.push({actionId:p.id,role:"platformAdmin",state:p.state,viewport:"390x844",
   status:"PASS",testRunId:runId,evidence:[p.image],notes:p.notes+"; browser-only synthetic POST"});
 await writeActionLedger(runId,outcomes);
 await writeFile(join(path,"platform-organization-actions.json"),JSON.stringify({
   proofs,ids:[...new Set(proofs.map(p=>p.id))],listGets,rejectedWrites,
   interceptedPosts:Object.fromEntries(actions.map(a=>[a.type,state[a.type].count])),
   limitation:"No backend organization state was mutated. 409/200 served by Playwright.",
 },null,2)+"\n");
});
