import axe from "axe-core";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, type BrowserContext } from "@playwright/test";
import { establishSeedRoleSession, LOCAL_SEED_ENTITY_IDS as ids } from "../support/seed-auth";
import { blockBrowserApiWrites, localAuditTargets } from "./fixture-guard";

type Role = "guest" | "customer" | "staff" | "organizationAdmin" | "platformAdmin";
type Route = { index: number; route: string; roles: Role[] };
const widths = [320, 390, 768, 1024, 1440, 1920, 2560, 3840];
const org = "?organizationId=" + ids.organizationId;
const highDensity = new Set([390, 1440, 3840]);
function roleFor(i: number): Role {
  return i <= 6 ? "guest" : i <= 12 ? "customer" : [13, 20, 21, 22, 24].includes(i) ? "staff" :
    i <= 25 ? "organizationAdmin" : "platformAdmin";
}
function urlFor(i: number, route: string, orderId: string | null) {
  const oid = orderId ?? "00000000-0000-4000-8000-000000000000";
  if (i === 4) return route + org + "&storeId=" + ids.storeId;
  if (i === 5) return route + org + "&productId=" + ids.productId + "&campaignId=" + ids.campaignId;
  if (i === 6) return route + org + "&campaignId=" + ids.campaignId;
  if (i === 7) return route + org + "&campaignId=" + ids.campaignId + "&productId=" + ids.productId + "&variantId=" + ids.variantId;
  if ([9, 10, 11].includes(i)) return route + "?orderId=" + oid;
  if (i >= 14 && i <= 25) return route + org + (i === 21 ? "&orderId=" + oid : "") + (i === 23 ? "&campaignId=" + ids.campaignId : "");
  return route;
}
for (const theme of ["light", "dark"] as const) {
  test("Phase 15 primary role browser 28 routes × 8 viewports / " + theme, async ({ browser, request }) => {
    test.setTimeout(850_000);
    const { frontend, api } = localAuditTargets();
    const runId = "uxqa-" + randomUUID();
    const dir = join("quality-audit", ".evidence", "campus-a-phase15", theme);
    await mkdir(dir, { recursive: true });
    const baseline = JSON.parse(await readFile("quality-audit/coverage-baseline.json", "utf8")) as { routes: Route[] };
    expect(baseline.routes).toHaveLength(28);
    const contexts = new Map<Role, BrowserContext>();
    const results: Array<Record<string, unknown>> = [];
    let blockedWrites = 0;
    let orderId: string | null = null;
    try {
      for (const role of ["guest", "customer", "staff", "organizationAdmin", "platformAdmin"] as const) {
        const context = await browser.newContext({ colorScheme: theme, viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
        if (role !== "guest") await establishSeedRoleSession(context, request, role);
        await context.route("**/*", async route => {
          const req = route.request();
          if (blockBrowserApiWrites(api)(req.url(), req.method())) {
            blockedWrites++; return route.abort("blockedbyclient");
          }
          return route.continue();
        });
        contexts.set(role, context);
      }
      const customer = await contexts.get("customer")!.newPage();
      await customer.goto(frontend + "/my/orders/", { waitUntil: "domcontentloaded" });
      try {
        const orderLink = customer.locator('main a[href*="orderId="]').first();
        await orderLink.waitFor({ state: "visible", timeout: 11000 });
        orderId = new URL((await orderLink.getAttribute("href"))!, frontend).searchParams.get("orderId");
      } catch { /* no existing order; recorded rather than fabricated */ }
      await customer.close();

      for (const entry of baseline.routes) {
        const role = roleFor(entry.index);
        const page = await contexts.get(role)!.newPage();
        const errors: string[] = [];
        page.on("pageerror", e => errors.push(e.message.slice(0, 220)));
        const uri = frontend.replace(/\/$/, "") + urlFor(entry.index, entry.route, orderId);
        let navError: string | null = null;
        try {
          await page.goto(uri, { waitUntil: "domcontentloaded", timeout: 20000 });
          await page.locator("main h1").first().waitFor({ state: "visible", timeout: 16000 }).catch(() => {});
          await page.waitForFunction(() => {
            const text = document.querySelector("main")?.textContent?.slice(0, 230) ?? "";
            return !/กำลังโหลด|กำลังตรวจสอบ|กำลังเตรียม/.test(text);
          }, { timeout: 12000 }).catch(() => {});
        } catch (e) { navError = e instanceof Error ? e.message : String(e); }

        let axeDone = false;
        for (const width of widths) {
          await page.setViewportSize({ width, height: width === 320 ? 740 : width === 768 ? 1024 : 900 });
          let snapshot = { h1: "" as string | null, overflow: 0, broken: 0, focusablesClipped: 0, mainWidth: 0, loading: false };
          await expect.poll(async () => {
            try {
              snapshot = await page.evaluate(() => {
                const main = document.querySelector("main");
                const rect = main?.getBoundingClientRect();
                const controls = [...document.querySelectorAll<HTMLElement>('button,a[href],input,select,textarea,summary')];
                const clipped = controls.filter(el => {
                  const b = el.getBoundingClientRect(),s=getComputedStyle(el);
                  return s.display!=="none"&&s.visibility!=="hidden"&&b.width>0&&b.height>0&&(b.right>innerWidth+2||b.left< -2);
                }).length;
                return {
                  h1: main?.querySelector("h1")?.textContent?.trim() ?? null,
                  overflow: Math.max(0, document.documentElement.scrollWidth-innerWidth),
                  broken: [...document.images].filter(x=>x.complete&&!x.naturalWidth).length,
                  focusablesClipped: clipped,
                  mainWidth: Math.round(rect?.width ?? 0),
                  loading: /กำลังโหลด|กำลังตรวจสอบ|กำลังเตรียม/.test(main?.textContent?.slice(0,230) ?? ""),
                };
              });
            } catch { snapshot.mainWidth = 0; }
            return snapshot.mainWidth > 0 && !snapshot.loading && Boolean(snapshot.h1) ? snapshot.mainWidth : 0;
          }, { timeout: 16000, intervals: [50,100,200] }).toBeGreaterThan(0);
          let axeViolations: string[] = [];
          if (width === 390 && !navError) {
            try {
              await page.addScriptTag({ content: axe.source });
              const violations = await page.evaluate(async () => {
                const runner = (window as unknown as { axe: typeof axe }).axe;
                return (await runner.run(document, {
                  runOnly: { type: "tag", values: ["wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa"] },
                })).violations.map(v=>v.id);
              });
              axeViolations=violations; axeDone=true;
            } catch(e) { axeViolations=["axe-injection-failed:" + String(e).slice(0,90)]; }
          }
          let screenshot: string | null = null;
          if (highDensity.has(width)) {
            screenshot="route-"+String(entry.index).padStart(2,"0")+"-"+width+".png";
            try { await page.screenshot({ path: join(dir,screenshot),animations:"disabled",timeout:15000 }); }
            catch { screenshot=null; }
          }
          results.push({ routeIndex: entry.index, route: entry.route, role, theme, viewport:width,
            ...snapshot, axeViolations, screenshot, navigationError:navError, pageErrors:[...errors] });
        }
        if (!axeDone && !navError) console.log("Phase15: axe not run for "+entry.route+" "+theme);
        await page.close();
      }
    } finally { await Promise.all([...contexts.values()].map(c=>c.close())); }
    const fails=results.filter(v => Number(v.overflow)>1 || Number(v.broken)>0 || Number(v.focusablesClipped)>0 ||
      !v.h1 || Boolean(v.loading) || Boolean(v.navigationError) ||
      (v.axeViolations as string[]).length>0 || (v.pageErrors as string[]).length>0);
    const report={ runId, theme, routes:baseline.routes.length, widths, results:results.length,blockedWrites,orderFound:!!orderId,
      pass:results.length-fails.length,fail:fails.length,failures:fails.map(v=>({ route:v.route,width:v.viewport,overflow:v.overflow,
        clipped:v.focusablesClipped,axe:v.axeViolations,nav:v.navigationError,page:v.pageErrors,loading:v.loading,h1:v.h1 })),outcomes:results };
    await writeFile(join(dir,"phase15-"+theme+"-audit.json"),JSON.stringify(report,null,2)+"\n");
    expect(results).toHaveLength(28*widths.length);
    expect(blockedWrites).toBe(0);
    expect(fails,JSON.stringify(report.failures.slice(0,12))).toHaveLength(0);
  });
}
