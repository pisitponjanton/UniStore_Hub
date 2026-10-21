import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { establishSeedRoleSession, LOCAL_SEED_ENTITY_IDS as ids } from "../support/seed-auth";
import { blockBrowserApiWrites, localAuditTargets } from "./fixture-guard";

const cases = [
  { role: "guest", name: "storefront", path: "/" },
  { role: "guest", name: "login", path: "/login/" },
  { role: "guest", name: "register", path: "/register/" },
  { role: "customer", name: "customer-orders", path: "/my/orders/" },
  { role: "staff", name: "staff-payments", path: "/org/payments/?organizationId=" + ids.organizationId },
  { role: "organizationAdmin", name: "admin-dashboard", path: "/org/dashboard/?organizationId=" + ids.organizationId },
  { role: "platformAdmin", name: "platform-organizations", path: "/platform/organizations/" },
] as const;
test("Phase15: 200% root text sizing × seven representative surfaces × two themes (not native browser zoom)", async ({ browser, request }) => {
  test.setTimeout(240_000);
  const { frontend, api } = localAuditTargets();
  const root = join("quality-audit", ".evidence", "campus-a-phase15", "text200");
  await mkdir(root, { recursive: true });
  const outcomes: Array<Record<string, unknown>> = [];
  let interceptedWrites = 0;
  const unexpectedRequests: string[] = [];
  const nextDevDiagnostics: string[] = [];
  for (const theme of ["light", "dark"] as const) {
    for (const c of cases) {
      const ctx = await browser.newContext({ colorScheme: theme, viewport: { width: 390, height: 850 }, reducedMotion: "reduce" });
      if (c.role !== "guest") await establishSeedRoleSession(ctx, request, c.role);
      await ctx.route("**/*", async route => {
        const req = route.request();
        if (blockBrowserApiWrites(api)(req.url(), req.method())) {
          const path = new URL(req.url()).pathname;
          if (path === "/__nextjs_original-stack-frames") nextDevDiagnostics.push(req.method()+" "+path);
          else { interceptedWrites++; unexpectedRequests.push(req.method()+" "+path); }
          return route.abort("blockedbyclient");
        }
        return route.continue();
      });
      try {
        const page = await ctx.newPage();
        await page.goto(frontend + c.path, { waitUntil: "domcontentloaded" });
        await page.locator("main h1").first().waitFor({ state: "visible", timeout: 18000 });
        await page.waitForFunction(() => {
          const main = document.querySelector("main");
          return main?.querySelector("h1") && !/กำลังโหลด|กำลังตรวจสอบ|กำลังเตรียม/.test(main?.textContent?.slice(0,220)??"");
        }, { timeout: 12000 }).catch(() => {});
        // Ensure hydration has settled before photographic capture.
        await page.waitForTimeout(420);
        for (const width of [390, 768]) {
          await page.setViewportSize({ width, height: 900 });
          await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
          await page.waitForTimeout(130);
          const m = await page.evaluate(() => ({
            overflow: Math.max(0, document.documentElement.scrollWidth-innerWidth),
            main: Math.round(document.querySelector("main")?.getBoundingClientRect().width??0),
            h1: document.querySelector("main h1")?.textContent?.trim()??null,
            rootFont: getComputedStyle(document.documentElement).fontSize,
            clippedButtons: [...document.querySelectorAll<HTMLElement>('button,a[href],input,select,textarea')].filter(el=>{
              const b=el.getBoundingClientRect(),s=getComputedStyle(el);
              return s.display!=="none"&&s.visibility!=="hidden"&&b.width>0&&b.height>0&&(b.right>innerWidth+2||b.left< -2);
            }).length,
          }));
          if (width===390) await page.screenshot({ path:join(root,c.name+"-"+theme+"-390-text200.png"),animations:"disabled",caret:"initial" });
          outcomes.push({ route:c.path,role:c.role,theme,viewport:width,...m });
        }
        await page.close();
      } finally { await ctx.close(); }
    }
  }
  const failed = outcomes.filter(x=>Number(x.overflow)>1 || Number(x.clippedButtons)>0 || !x.h1 || Number(x.main)<=0);
  await writeFile(join(root,"text200-audit.json"),JSON.stringify({
    method:"CSS document root font-size 200%, not native browser pinch zoom, physical display zoom or OS text scaling.",
    measurements:outcomes.length,blockedWrites:interceptedWrites,unexpectedRequests,nextDevDiagnostics,failed:failed.length,failures:failed,outcomes,
  },null,2)+"\n");
  expect(interceptedWrites).toBe(0);
  expect(outcomes).toHaveLength(28);
  expect(failed,JSON.stringify(failed.slice(0,8))).toHaveLength(0);
});
