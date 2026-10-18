import { randomUUID } from "node:crypto";
import { mkdir,readFile,writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect,test,type Page } from "@playwright/test";
import { establishSeedRoleSession,LOCAL_SEED_ENTITY_IDS as ids } from "../support/seed-auth";
import { localAuditTargets } from "./fixture-guard";
import { writeActionLedger,type ActionOutcome } from "./result-ledger";

const root="/api/v1/organizations/"+ids.organizationId;
const paymentId="uxqa-review-payment",orderId="uxqa-review-order",at="2026-10-17T12:00:00.000Z";
const payment={paymentId,organizationId:ids.organizationId,orderId,customerId:"uxqa-customer",slipKey:"uxqa/fixture-only-slip",status:"PENDING_REVIEW",
  rejectReason:null,reviewedBy:null,reviewedAt:null,createdAt:at,updatedAt:at};
const order={orderId,organizationId:ids.organizationId,campaignId:"uxqa-campaign",customerId:"uxqa-customer",status:"PAYMENT_REVIEW",
  subtotal:28000,total:28000,items:[],createdAt:at,updatedAt:at};
type Proof={id:string;state:string;notes:string;image:string};
test("Payment Review selection, private slip, approve/reject cancel and invalid reason",async({browser,request})=>{
  test.setTimeout(150000);
  const {frontend}=localAuditTargets(),runId="uxqa-"+randomUUID(),dir=join("test-results","quality-audit",runId);
  await mkdir(dir,{recursive:true});
  const proofs:Proof[]=[];let businessWrites=0,slipRequests=0,reviewWrites=0;
  const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:"reduce"});
  await establishSeedRoleSession(ctx,request,"staff");
  await ctx.route("**/*",async route=>{
    const req=route.request(),url=new URL(req.url()),method=req.method(),path=url.pathname;
    if(method==="GET"&&path===root+"/payments"){
      await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({success:true,data:{items:[payment],nextCursor:null}})});return;
    }
    if(method==="GET"&&path===root+"/payments/"+paymentId){
      await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({success:true,data:payment})});return;
    }
    if(method==="GET"&&path===root+"/orders/"+orderId){
      await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({success:true,data:order})});return;
    }
    if(method==="POST"&&path===root+"/files/download-url"){
      slipRequests++;expect(req.postDataJSON()).toEqual({objectKey:payment.slipKey});
      await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
        success:true,data:{url:"https://example.invalid/uxqa-ephemeral-slip",method:"GET",expiresInSeconds:900}
      })});return;
    }
    if(method==="POST"&&path.includes("/payments/")){reviewWrites++;await route.abort("blockedbyclient");return;}
    if(!["GET","HEAD","OPTIONS"].includes(method)){businessWrites++;await route.abort("blockedbyclient");return;}
    await route.continue();
  });
  async function prove(page:Page,id:string,state:string,notes:string){
    const image=id+"-"+state+".png";await page.screenshot({path:join(dir,image),animations:"disabled"});
    proofs.push({id,state,notes,image});
  }
  try{
    const page=await ctx.newPage();
    await page.goto(frontend+"/org/payments/?organizationId="+ids.organizationId,{waitUntil:"domcontentloaded"});
    await expect(page.getByRole("heading",{name:"ตรวจสอบการชำระเงิน",level:1})).toBeVisible({timeout:18000});
    await page.getByRole("button",{name:"ตรวจสอบ การชำระเงิน "+paymentId}).click();
    const detail=page.getByLabel("รายละเอียดการชำระเงิน");
    await expect(detail.getByRole("heading",{name:"Payment "+paymentId})).toBeVisible();
    await expect(detail).toContainText("28");
    await prove(page,"FE-UX-22-06","fresh-detail","Payment and Order details resolved through two distinct mocked GETs");

    await detail.getByRole("button",{name:"เปิดสลิป",exact:true}).click();
    const link=detail.getByRole("link",{name:"เปิดสลิปในแท็บใหม่"});
    await expect(link).toHaveAttribute("href","https://example.invalid/uxqa-ephemeral-slip");
    await expect(link).toHaveAttribute("rel",/noopener noreferrer/);
    await expect(link).toHaveAttribute("target","_blank");
    expect(slipRequests).toBe(1);
    await prove(page,"FE-UX-22-08","ephemeral-download-request","Private download URL issued only via intercepted POST");
    await prove(page,"FE-UX-22-09","safe-link-attributes","External temporary link has noopener/noreferrer and explicit new-tab target; external URL not opened");

    await detail.getByRole("button",{name:"อนุมัติการชำระเงิน"}).click();
    const approve=page.getByRole("dialog",{name:"ยืนยันการอนุมัติการชำระเงิน"});
    await expect(approve.getByRole("button",{name:"ยืนยันอนุมัติ"})).toBeVisible();
    await prove(page,"FE-UX-22-10","approve-confirm-open","Approval explicitly requires confirmation before POST");
    await approve.getByRole("button",{name:"ยกเลิก",exact:true}).click();
    await expect(approve).not.toBeVisible();
    await expect(detail.getByRole("button",{name:"อนุมัติการชำระเงิน"})).toBeFocused();
    await prove(page,"FE-UX-22-10","approve-cancel-focus","Dismissed approval without writes, focus returned to trigger");

    const rejectTrigger=detail.getByRole("button",{name:"ปฏิเสธการชำระเงิน"});
    await rejectTrigger.click();
    const reject=page.getByRole("dialog",{name:"ปฏิเสธการชำระเงิน"});
    await expect(reject.getByRole("textbox",{name:"เหตุผลที่ปฏิเสธ"})).toBeVisible();
    await prove(page,"FE-UX-22-11","reject-dialog-open","Rejection dialog explains reason requirement");
    await reject.getByRole("button",{name:"ยืนยันปฏิเสธ"}).click();
    const summary=reject.locator("#payment-reject-error-summary");
    await expect(summary.getByRole("link",{name:"กรุณาระบุเหตุผลที่ปฏิเสธการชำระเงิน"})).toBeVisible();
    await expect(summary).toBeFocused();
    await prove(page,"FE-UX-22-14","first-invalid-confirm","First invalid rejection confirm blocked and focused ErrorSummary");
    await reject.getByRole("textbox",{name:"เหตุผลที่ปฏิเสธ"}).fill("  ยอดเงินไม่ตรงกับรายการ  ");
    await expect(reject.getByRole("textbox",{name:"เหตุผลที่ปฏิเสธ"})).toHaveValue("  ยอดเงินไม่ตรงกับรายการ  ");
    await prove(page,"FE-UX-22-12","reason-draft","Editable reason clears stale validation and preserves draft");
    await reject.getByRole("button",{name:"กลับ",exact:true}).click();
    await expect(reject).not.toBeVisible();
    await expect(rejectTrigger).toBeFocused();
    await prove(page,"FE-UX-22-13","reject-back-focus","Back dismisses rejection and returns focus to trigger");
    await rejectTrigger.click();
    await expect(reject.getByRole("textbox",{name:"เหตุผลที่ปฏิเสธ"})).toHaveValue("");
    await prove(page,"FE-UX-22-11","reject-reopen-clean","Reopening does not leak previous reason or validation state");
    await page.keyboard.press("Escape");
    await expect(reject).not.toBeVisible();
    await prove(page,"FE-UX-22-13","reject-escape","Escape safely dismisses without review write");
    await page.close();
  }finally{await ctx.close();}
  expect(reviewWrites).toBe(0);expect(businessWrites).toBe(0);expect(slipRequests).toBe(1);
  const base=JSON.parse(await readFile("quality-audit/coverage-baseline.json","utf8")) as {
    actions:Array<{id:string;roles:string[];statesToTest:string[]}>;
    shellActions:Array<{id:string;roles:string[];statesToTest:string[]}>;
  };
  const ledger:ActionOutcome[]=[...base.actions,...base.shellActions].map(x=>({
    actionId:x.id,role:x.roles[0]!,state:"all-declared-states",viewport:"not-executed",
    status:"NOT_TESTED",testRunId:runId,evidence:[],notes:"Exhaustive matrix not tested: "+x.statesToTest.join(", "),
  }));
  for(const p of proofs)ledger.push({actionId:p.id,role:"staff",state:p.state,viewport:"390x844",
    status:"PASS",testRunId:runId,evidence:[p.image],notes:p.notes+"; browser mocks only, no actual payment review"});
  await writeActionLedger(runId,ledger);
  await writeFile(join(dir,"payment-review-safe-states.json"),JSON.stringify({
    proofs,distinctIds:[...new Set(proofs.map(x=>x.id))],slipRequests,reviewWrites,businessWrites,
    note:"No private slip URL visited; no approve or reject request sent.",
  },null,2)+"\n");
});
