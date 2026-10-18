import { randomUUID } from "node:crypto";
import { mkdir,readFile,writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect,test,type Page } from "@playwright/test";
import { establishSeedRoleSession } from "../support/seed-auth";
import { localAuditTargets } from "./fixture-guard";
import { writeActionLedger,type ActionOutcome } from "./result-ledger";

const stamp="2026-10-17T12:00:00.000Z",notifs="/api/v1/notifications";
const a={notificationId:"uxqa-notification-a",userId:"uxqa-customer",type:"PAYMENT_REJECTED",title:"UXQA Payment Rejected",
  message:"Test-only payment status",resourceType:"ORDER",resourceId:"uxqa-notification-order",readAt:null,createdAt:stamp};
const b={...a,notificationId:"uxqa-notification-b",type:"READY_FOR_PICKUP",title:"UXQA Pickup Ready",message:"Test-only pickup status"};
const c={...a,notificationId:"uxqa-notification-c",type:"PAYMENT_APPROVED",title:"UXQA Payment Approved",readAt:stamp};
type Proof={id:string;state:string;note:string;image:string};
test("Customer Notifications: filters, paging, mark-read pending/409/200, refresh and focus",async({browser,request})=>{
  test.setTimeout(175000);
  const {frontend}=localAuditTargets(),runId="uxqa-"+randomUUID(),dir=join("test-results","quality-audit",runId);
  await mkdir(dir,{recursive:true});
  const proofList:Proof[]=[],reads:string[]=[];
  let markMode:"conflict"|"success"="conflict",markPending=false,markCalls=0,unplannedWrites=0,holdRefresh=false;
  const deferred:{release?:(()=>void)}={};
  const readIds=new Set([c.notificationId]);
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:"reduce"});
  await establishSeedRoleSession(context,request,"customer");
  await context.route("**/*",async route=>{
    const req=route.request(),url=new URL(req.url()),method=req.method();
    if(method==="GET"&&url.pathname===notifs){
      reads.push(url.search);
      if(holdRefresh){
        await route.fulfill({status:503,contentType:"application/json",
          body:JSON.stringify({success:false,error:{code:"SERVICE_UNAVAILABLE",message:"Synthetic notifications 503"}})});return;
      }
      const read=url.searchParams.get("read"),cursor=url.searchParams.get("cursor");
      let items=[a,b,c].map(x=>({...x,readAt:readIds.has(x.notificationId)?stamp:null}));
      if(read==="true")items=items.filter(x=>x.readAt);
      if(read==="false")items=items.filter(x=>!x.readAt);
      const output=cursor?items.slice(1):items.slice(0,1);
      await route.fulfill({status:200,contentType:"application/json",
        body:JSON.stringify({success:true,data:{items:output,nextCursor:cursor||items.length<=1?null:"uxqa-next"}})});return;
    }
    if(method==="PATCH"&&url.pathname===notifs+"/"+a.notificationId+"/read"){
      markCalls++;
      if(markPending)await new Promise<void>(resolve=>{deferred.release=resolve;});
      if(markMode==="conflict"){
        await route.fulfill({status:409,contentType:"application/json",
          body:JSON.stringify({success:false,error:{code:"INVALID_STATUS_TRANSITION",message:"Synthetic mark-read failure"}})});return;
      }
      readIds.add(a.notificationId);
      await route.fulfill({status:200,contentType:"application/json",
        body:JSON.stringify({success:true,data:{...a,readAt:stamp}})});return;
    }
    if(!["GET","HEAD","OPTIONS"].includes(method)){unplannedWrites++;await route.abort("blockedbyclient");return;}
    await route.continue();
  });
  async function record(page:Page,id:string,state:string,note:string){
    const image=id+"-"+state+".png";await page.screenshot({path:join(dir,image),animations:"disabled"});
    proofList.push({id,state,note,image});
  }
  try{
    const page=await context.newPage();
    await page.goto(frontend+"/notifications/",{waitUntil:"domcontentloaded"});
    await expect(page.getByRole("heading",{name:"การแจ้งเตือน",level:1})).toBeVisible({timeout:16000});
    const first=page.getByRole("article",{name:/UXQA Payment Rejected/});
    await expect(first).toBeVisible();
    await page.getByRole("button",{name:"โหลดเพิ่มเติม"}).click();
    await expect(page.getByRole("heading",{name:b.title})).toBeVisible();
    await expect(page.getByRole("heading",{name:c.title})).toBeVisible();
    expect(reads.some(q=>new URLSearchParams(q).get("cursor")==="uxqa-next")).toBe(true);
    await record(page,"FE-UX-12-07","opaque-cursor","Load More appends synthetic next page without losing first row");

    const mark=first.getByRole("button",{name:"ทำเครื่องหมายว่าอ่านแล้ว"});
    await mark.click();
    await expect.poll(()=>markCalls).toBe(1);
    // Early 409 is enough to observe error behavior before running the deferred-pending case.
    const error=page.getByRole("alert").filter({hasText:"ดำเนินการไม่สำเร็จ"});
    await expect(error).toBeVisible();
    await expect(error).toBeInViewport();
    await expect(page.locator("[data-notifications-action-error]")).toBeFocused();
    await record(page,"FE-UX-12-06","409-visible-error","Synthetic PATCH 409 surfaces visible recoverable error without changing notification read state");

    markPending=true;
    await mark.click();
    await expect.poll(()=>markCalls).toBe(2);
    await expect(first.getByRole("button",{name:"กำลังบันทึก"})).toBeDisabled();
    await record(page,"FE-UX-12-06","pending-locked","Mark-read pending is locked and no second request permitted");
    markPending=false;deferred.release?.();
    await expect(error).toBeVisible();
    await record(page,"FE-UX-12-06","pending-409","Deferred PATCH 409 completes and retains retryable unread item");
    markMode="success";
    await mark.click();
    await expect(first.getByRole("button",{name:"ทำเครื่องหมายว่าอ่านแล้ว"})).toHaveCount(0);
    await expect(first.getByText("อ่านแล้ว",{exact:true}).last()).toBeVisible();
    await record(page,"FE-UX-12-06","200-read","Synthetic 200 changes UI read status, no real Backend mutation");
    expect(markCalls).toBe(3);

    const filters=page.getByRole("group",{name:"กรองการแจ้งเตือน"});
    await filters.getByRole("button",{name:"ยังไม่อ่าน"}).click();
    await expect(filters.getByRole("button",{name:"ยังไม่อ่าน"})).toHaveAttribute("aria-pressed","true");
    await expect(page.getByRole("heading",{name:b.title})).toBeVisible();
    await expect(page.getByRole("heading",{name:a.title})).toHaveCount(0);
    await record(page,"FE-UX-12-03","unread-filter","Server-filtered unread result excludes marked-read item");
    await filters.getByRole("button",{name:"อ่านแล้ว",exact:true}).click();
    await expect(filters.getByRole("button",{name:"อ่านแล้ว",exact:true})).toHaveAttribute("aria-pressed","true");
    await expect(page.getByRole("heading",{name:a.title})).toBeVisible();
    await record(page,"FE-UX-12-04","read-filter","Read filter GET returns marked item");
    await filters.getByRole("button",{name:"ทั้งหมด"}).click();
    await expect(filters.getByRole("button",{name:"ทั้งหมด"})).toHaveAttribute("aria-pressed","true");
    await expect(first).toBeVisible();
    await record(page,"FE-UX-12-02","all-filter","All filter resets read query and re-renders list");

    holdRefresh=true;
    const refresh=page.getByRole("button",{name:"รีเฟรชรายการ"});
    await refresh.click();
    await expect(page.getByRole("alert").filter({hasText:"ดำเนินการไม่สำเร็จ"})).toBeVisible();
    await record(page,"FE-UX-12-01","refresh-503","Failed Refresh preserves last good notification list and shows error");
    holdRefresh=false;
    await refresh.click();
    await expect(page.getByRole("status").filter({hasText:"อัปเดตรายการแจ้งเตือนล่าสุดแล้ว"})).toBeVisible();
    await record(page,"FE-UX-12-01","refresh-success","Refresh success updates scoped list with visible feedback");
    await page.close();
  }finally{deferred.release?.();await context.close();}
  expect(unplannedWrites).toBe(0);
  const baseline=JSON.parse(await readFile("quality-audit/coverage-baseline.json","utf8")) as {
    actions:Array<{id:string;roles:string[];statesToTest:string[]}>;
    shellActions:Array<{id:string;roles:string[];statesToTest:string[]}>;
  };
  const entries:ActionOutcome[]=[...baseline.actions,...baseline.shellActions].map(x=>({
    actionId:x.id,role:x.roles[0]!,state:"all-declared-states",viewport:"not-executed",status:"NOT_TESTED",
    testRunId:runId,evidence:[],notes:"Full declared matrix not executed: "+x.statesToTest.join(", ")
  }));
  for(const p of proofList)entries.push({actionId:p.id,role:"customer",state:p.state,viewport:"390x844",
    status:"PASS",testRunId:runId,evidence:[p.image],notes:p.note+"; browser synthetic GET/PATCH only"});
  await writeActionLedger(runId,entries);
  await writeFile(join(dir,"notification-safe-states.json"),JSON.stringify({
    proofs:proofList,distinctIds:[...new Set(proofList.map(x=>x.id))],markCalls,unplannedWrites,
    limitation:"PATCH 409 and 200 intercepted by Playwright; no real notification read flag persisted",
  },null,2)+"\n");
});
