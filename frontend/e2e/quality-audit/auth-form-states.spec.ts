import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { localAuditTargets } from "./fixture-guard";
import { writeActionLedger, type ActionOutcome } from "./result-ledger";

test("Login and Register validation, pending, 503/conflict and retry stay browser-only", async ({ browser }) => {
  test.setTimeout(150_000);
  const { frontend } = localAuditTargets();
  const runId = "uxqa-" + randomUUID();
  const dir = join("test-results", "quality-audit", runId);
  await mkdir(dir, { recursive: true });
  const proof: Array<{ actionId: string; state: string; evidence: string; note: string }> = [];
  let interceptedPosts=0, unmockedWrites=0;
  const cases = [
    { name:"login", path:"/login/", submit:"เข้าสู่ระบบ", email:"#login-email", pass:"#login-password",
      summary:"#login-error-summary", actionId:"FE-UX-02-04", endpoint:"/api/v1/auth/login", errorCode:"SERVICE_UNAVAILABLE",
      httpStatus:503, errorTitle:"เข้าสู่ระบบไม่สำเร็จ" },
    { name:"register", path:"/register/", submit:"สร้างบัญชี", email:"#register-email", pass:"#register-password",
      summary:"#register-error-summary", actionId:"FE-UX-03-05", endpoint:"/api/v1/auth/register", errorCode:"CONFLICT",
      httpStatus:409, errorTitle:"สมัครสมาชิกไม่สำเร็จ" },
  ] as const;
  for (const c of cases) {
    const ctx=await browser.newContext({ viewport:{width:390,height:844}, reducedMotion:"reduce" });
    let release: (() => void) | undefined, requests=0;
    const payloads: Array<Record<string, unknown>>=[];
    await ctx.route("**/*", async route => {
      const req=route.request(), url=new URL(req.url());
      if (req.method()==="POST" && url.pathname===c.endpoint) {
        interceptedPosts++; requests++;
        payloads.push(req.postDataJSON() as Record<string,unknown>);
        await new Promise<void>(resolve=>{ release=resolve; });
        await route.fulfill({status:c.httpStatus, contentType:"application/json",
          body:JSON.stringify({success:false,error:{code:c.errorCode,message:"Synthetic test-only auth response"}})});
        return;
      }
      if(!["GET","HEAD","OPTIONS"].includes(req.method())) {
        unmockedWrites++;await route.abort("blockedbyclient");return;
      }
      await route.continue();
    });
    try {
      const page=await ctx.newPage();
      await page.goto(frontend+c.path,{waitUntil:"domcontentloaded"});
      const submit=page.locator("form button[type=submit]");
      await expect(submit).toHaveText(c.submit);
      await submit.click();
      await expect(page.locator(c.summary)).toBeVisible();
      await expect(page.locator(c.summary)).toBeFocused();
      await expect(page.locator(c.email)).toHaveAttribute("aria-invalid","true");
      await expect(page.locator(c.pass)).toHaveAttribute("aria-invalid","true");
      expect(requests).toBe(0);
      let picture=c.name+"-empty-validation.png";
      await page.screenshot({path:join(dir,picture),animations:"disabled"});
      proof.push({actionId:c.actionId,state:"empty-validation",evidence:picture,
        note:"Empty submit focuses linked validation summary, marks required fields and makes no API request"});

      await page.locator(c.email).fill("not-an-email");
      await page.locator(c.pass).fill("tiny");
      if(c.name==="register") await page.locator("#register-name").fill(" ");
      await submit.click();
      await expect(page.locator(c.summary)).toBeVisible();
      await expect(page.locator(c.email)).toHaveAttribute("aria-invalid","true");
      await expect(page.locator(c.pass)).toHaveAttribute("aria-invalid","true");
      expect(requests).toBe(0);
      picture=c.name+"-invalid-validation.png";
      await page.screenshot({path:join(dir,picture),animations:"disabled"});
      proof.push({actionId:c.actionId,state:"malformed-validation",evidence:picture,
        note:"Malformed email and short password rejected client-side without POST"});

      await page.locator(c.email).fill("  TEST-ONLY@EXAMPLE.COM  ");
      await page.locator(c.pass).fill("local-test-only-password");
      if(c.name==="register") await page.locator("#register-name").fill("  Test-only User  ");
      await submit.click();
      await expect.poll(()=>requests).toBe(1);
      await expect(submit).toBeDisabled();
      await expect(page.locator(c.email)).toBeDisabled();
      await expect(page.locator(c.pass)).toBeDisabled();
      await expect(page.getByRole("button",{name:"แสดงรหัสผ่าน"})).toBeDisabled();
      picture=c.name+"-pending.png";
      await page.screenshot({path:join(dir,picture),animations:"disabled"});
      proof.push({actionId:c.actionId,state:"pending-disabled",evidence:picture,
        note:"Form and password toggle disabled during deferred POST; request intercepted by Playwright"});

      expect(release).toBeDefined();
      release?.();
      await expect(page.getByRole("alert").filter({hasText:c.errorTitle})).toBeVisible();
      await expect(submit).toBeEnabled();
      await expect(page.locator(c.email)).toBeEnabled();
      expect(payloads[0]?.email).toBe("test-only@example.com");
      if(c.name==="register") expect(payloads[0]?.name).toBe("Test-only User");
      picture=c.name+"-server-error.png";
      await page.screenshot({path:join(dir,picture),animations:"disabled"});
      proof.push({actionId:c.actionId,state:c.httpStatus+"-server-error",evidence:picture,
        note:"Browser-only HTTP error displays user-readable alert and restores editable form; normalized request verified"});
      await page.locator(c.email).fill("test-retry@example.com");
      await expect(page.getByRole("alert").filter({hasText:c.errorTitle})).toHaveCount(0);
      expect(requests).toBe(1);
      picture=c.name+"-error-dismissed-on-edit.png";
      await page.screenshot({path:join(dir,picture),animations:"disabled"});
      proof.push({actionId:c.actionId,state:"edit-after-error",evidence:picture,
        note:"Editing input clears stale server error without retry POST"});
      await page.close();
    }finally {release?.();await ctx.close();}
  }
  expect(unmockedWrites).toBe(0);
  expect(interceptedPosts).toBe(2);
  expect(proof).toHaveLength(10);
  const baseline=JSON.parse(await readFile("quality-audit/coverage-baseline.json","utf8")) as {
    actions:Array<{id:string;roles:string[];statesToTest:string[]}>;
    shellActions:Array<{id:string;roles:string[];statesToTest:string[]}>;
  };
  const ledger:ActionOutcome[]=[...baseline.actions,...baseline.shellActions].map(a=>({
    actionId:a.id,role:a.roles[0]!,state:"all-declared-states",viewport:"not-executed",
    status:"NOT_TESTED",testRunId:runId,evidence:[],
    notes:"Exhaustive declared states not verified: "+a.statesToTest.join(", "),
  }));
  for(const p of proof) ledger.push({actionId:p.actionId,role:"guest",state:p.state,viewport:"390x844",
    status:"PASS",testRunId:runId,evidence:[p.evidence],notes:p.note+"; synthetic browser POST only"});
  await writeActionLedger(runId,ledger);
  await writeFile(join(dir,"auth-form-states.json"),JSON.stringify({
    states:proof,interceptedPosts,unmockedWrites,backendMutations:0,
  },null,2)+"\n");
});
