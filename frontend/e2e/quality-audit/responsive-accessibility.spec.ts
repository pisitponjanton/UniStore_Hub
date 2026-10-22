/**
 * Campus Commerce A — behavior-focused browser regression suite.
 * Consolidated from historical work-item files; all test cases and mock guards retained.
 * Add related cases here; never introduce milestone-numbered spec files.
 */
import { expect, test, type BrowserContext } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { blockBrowserApiWrites, localAuditTargets } from "./fixture-guard";
import axe from "axe-core";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { establishSeedRoleSession, LOCAL_SEED_ENTITY_IDS as ids } from "../support/seed-auth";

test.describe("Text scale", () => {
const { frontend, api } = localAuditTargets();
const directory = resolve(process.cwd(), "quality-audit/.evidence/campus-commerce-responsive");
mkdirSync(directory, { recursive: true });

test("200% text scaling on public and auth surfaces, reduced-motion, read-only", async ({ browser }) => {
  test.setTimeout(120_000);
  const result: Array<{ theme: string; width: number; route: string; horizontalOverflow: number }> = [];
  for (const theme of ["light", "dark"] as const) {
    const context = await browser.newContext({ colorScheme: theme, reducedMotion: "reduce", viewport: { width: 390, height: 900 } });
    await context.route("**/*", async route => {
      if (blockBrowserApiWrites(api)(route.request().url(), route.request().method())) await route.abort("blockedbyclient");
      else await route.continue();
    });
    try {
      const page = await context.newPage();
      for (const width of [390, 768, 960, 1920]) {
        await page.setViewportSize({ width, height: 900 });
        for (const route of ["/", "/login/", "/register/"]) {
          await page.goto(frontend + route, { waitUntil: "domcontentloaded" });
          await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
          await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
          const horizontalOverflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth));
          expect(horizontalOverflow, theme + " " + route + " at " + width + "px / 200% text").toBeLessThanOrEqual(1);
          result.push({ theme, width, route, horizontalOverflow });
          if (width === 390 && route === "/login/") {
            await page.screenshot({ path: resolve(directory, "login-" + theme + "-390-200pct-text.png") });
          }
        }
      }
    } finally { await context.close(); }
  }
  writeFileSync(resolve(directory, "text-scale-200pct.json"), JSON.stringify({
    note: "CSS root font-size 200% smoke test, not a native browser zoom or full assistive technology certification.",
    cases: result,
  }, null, 2) + "\n");
});
});

test.describe("Full matrix", () => {
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
for (const group of ["guest", "customer", "staff", "organizationAdmin", "platformAdmin"] as const) {
  test("primary role browser " + group + " routes × 8 viewports / " + theme, async ({ browser, request }) => {
    test.setTimeout(850_000);
    const { frontend, api } = localAuditTargets();
    const runId = "uxqa-" + randomUUID();
    const dir = join("quality-audit", ".evidence", "campus-commerce-comprehensive-audit", theme);
    await mkdir(dir, { recursive: true });
    const baseline = JSON.parse(await readFile("quality-audit/coverage-baseline.json", "utf8")) as { routes: Route[] };
    expect(baseline.routes).toHaveLength(28);
    const groupRoutes = baseline.routes.filter(entry => roleFor(entry.index) === group);
    expect(groupRoutes.length).toBeGreaterThan(0);
    const contexts = new Map<Role, BrowserContext>();
    const results: Array<Record<string, unknown>> = [];
    let blockedWrites = 0;
    let orderId: string | null = null;
    try {
      const neededRoles = (group === "customer" || group === "staff")
        ? [...new Set<Role>(["customer", group])] : [group];
      for (const role of neededRoles) {
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
      if (contexts.has("customer")) {
        const customer = await contexts.get("customer")!.newPage();
        await customer.goto(frontend + "/my/orders/", { waitUntil: "domcontentloaded" });
        try {
          const orderLink = customer.locator('main a[href*="orderId="]').first();
          await orderLink.waitFor({ state: "visible", timeout: 11000 });
          orderId = new URL((await orderLink.getAttribute("href"))!, frontend).searchParams.get("orderId");
        } catch { /* no existing order; recorded rather than fabricated */ }
        await customer.close();
      }

      for (const entry of groupRoutes) {
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
                  const b = el.getBoundingClientRect(), style = getComputedStyle(el);
                  if (style.display === "none" || style.visibility === "hidden" || b.width <= 0 || b.height <= 0) return false;
                  if (b.left >= -2 && b.right <= innerWidth + 2) return false;
                  // A visible, keyboard-focusable overflow region deliberately exposes
                  // off-screen table cells by horizontal scrolling. They are reachable,
                  // unlike focusable elements clipped outside the viewport without a scroll container.
                  const region = el.closest<HTMLElement>('[role="region"][tabindex]');
                  if (region) {
                    const regionBox = region.getBoundingClientRect();
                    const overflowX = getComputedStyle(region).overflowX;
                    if (regionBox.left >= -2 && regionBox.right <= innerWidth + 2 &&
                        region.scrollWidth > region.clientWidth + 2 &&
                        (overflowX === "auto" || overflowX === "scroll")) return false;
                  }
                  return true;
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
          if (entry.index === 25 && (width === 768 || width === 1024)) {
            const region = page.locator('[role="region"][tabindex]').filter({ has: page.locator("summary") }).first();
            await expect(region, "Audit's table must expose a keyboard-focusable region").toBeVisible();
            await region.evaluate(el => { el.scrollLeft = 0; });
            await region.focus();
            await page.keyboard.press("ArrowRight");
            await expect.poll(() => region.evaluate(el => el.scrollLeft), {
              message: "ArrowRight should move Audit table horizontally",
              timeout: 3000,
            }).toBeGreaterThan(0);
            await region.evaluate(el => { el.scrollLeft = el.scrollWidth; });
            const lastSummary = region.locator("summary").last();
            await lastSummary.focus();
            const keyboardReach = await lastSummary.evaluate(el => {
              const container = el.closest<HTMLElement>('[role="region"][tabindex]')!;
              const cell = el.getBoundingClientRect(), viewport = container.getBoundingClientRect();
              return {
                focused: document.activeElement === el,
                scrollable: container.scrollWidth > container.clientWidth + 2,
                insideRegion: cell.left >= viewport.left - 2 && cell.right <= viewport.right + 2,
                insideViewport: cell.left >= -2 && cell.right <= innerWidth + 2,
              };
            });
            expect(keyboardReach, "Audit offscreen controls must become visible after scroll").toMatchObject({
              focused: true, scrollable: true, insideRegion: true, insideViewport: true,
            });
          }
          let axeViolations: string[] = [];
          if (width === 390 && !navError) {
            try {
              await page.addScriptTag({ content: axe.source });
              const violations = await page.evaluate(async () => {
                const runner = (window as unknown as { axe: typeof axe }).axe;
                return (await runner.run(document, {
                  runOnly: { type: "tag", values: ["wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa"] },
                })).violations.map(v => v.id + ": " + v.nodes.slice(0, 6)
                  .map(n => JSON.stringify({ target: n.target, reason: n.failureSummary?.slice(0, 240), html: n.html.slice(0, 220) })).join("; "));
              });
              axeViolations=violations; axeDone=true;
            } catch(e) { axeViolations=["axe-injection-failed:" + String(e).slice(0,90)]; }
          }
          let screenshot: string | null = null;
          if (highDensity.has(width)) {
            // Restore the initial visual state after scroll/focus accessibility probes.
            await page.evaluate(() => {
              window.scrollTo({ top: 0, left: 0, behavior: "instant" });
              for (const region of document.querySelectorAll<HTMLElement>('[role="region"][tabindex]')) region.scrollLeft = 0;
            });
            screenshot="route-"+String(entry.index).padStart(2,"0")+"-"+width+".png";
            try { await page.screenshot({ path: join(dir,screenshot),animations:"disabled",timeout:15000 }); }
            catch { screenshot=null; }
          }
          results.push({ routeIndex: entry.index, route: entry.route, role, theme, viewport:width,
            ...snapshot, axeViolations, screenshot, navigationError:navError, pageErrors:[...errors] });
        }
        if (!axeDone && !navError) console.log(" axe not run for "+entry.route+" "+theme);
        await page.close();
      }
    } finally { await Promise.all([...contexts.values()].map(c=>c.close())); }
    const fails=results.filter(v => Number(v.overflow)>1 || Number(v.broken)>0 || Number(v.focusablesClipped)>0 ||
      !v.h1 || Boolean(v.loading) || Boolean(v.navigationError) ||
      (v.axeViolations as string[]).length>0 || (v.pageErrors as string[]).length>0);
    const report={ runId, theme, group, routes:groupRoutes.length, canonicalRoutes:baseline.routes.length, widths, results:results.length,blockedWrites,orderFound:!!orderId,
      pass:results.length-fails.length,fail:fails.length,failures:fails.map(v=>({ route:v.route,width:v.viewport,overflow:v.overflow,
        clipped:v.focusablesClipped,axe:v.axeViolations,nav:v.navigationError,page:v.pageErrors,loading:v.loading,h1:v.h1 })),outcomes:results };
    await writeFile(join(dir,theme+"-"+group+"-viewport-audit.json"),JSON.stringify(report,null,2)+"\n");
    expect(results).toHaveLength(groupRoutes.length*widths.length);
    expect(blockedWrites).toBe(0);
    expect(fails,JSON.stringify(report.failures.slice(0,12))).toHaveLength(0);
  });
}
}
});

test.describe("Text 200", () => {
const cases = [
  { role: "guest", name: "storefront", path: "/" },
  { role: "guest", name: "login", path: "/login/" },
  { role: "guest", name: "register", path: "/register/" },
  { role: "customer", name: "customer-orders", path: "/my/orders/" },
  { role: "staff", name: "staff-payments", path: "/org/payments/?organizationId=" + ids.organizationId },
  { role: "organizationAdmin", name: "admin-dashboard", path: "/org/dashboard/?organizationId=" + ids.organizationId },
  { role: "platformAdmin", name: "platform-organizations", path: "/platform/organizations/" },
] as const;
test("200% root text sizing × seven representative surfaces × two themes (not native browser zoom)", async ({ browser, request }) => {
  test.setTimeout(240_000);
  const { frontend, api } = localAuditTargets();
  const root = join("quality-audit", ".evidence", "campus-commerce-comprehensive-audit", "text200");
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
});


test.describe("Visual migration baseline", () => {
  const { frontend, api } = localAuditTargets();
  const roleRoutes = [
    { role: "guest", route: "/", note: "public marketplace / fixture partition" },
    { role: "customer", route: "/my/orders/", note: "customer status / order list" },
    { role: "staff", route: "/org/orders/?organizationId=" + ids.organizationId, note: "priority and show-more staff queue" },
    { role: "organizationAdmin", route: "/org/dashboard/?organizationId=" + ids.organizationId, note: "organization dashboard" },
    { role: "platformAdmin", route: "/platform/organizations/", note: "governance and approval confirmation" },
  ] as const;

  for (const theme of ["light", "dark"] as const) {
    test("Capture UX-frozen main design, all five roles in " + theme, async ({ browser, request }) => {
      test.setTimeout(240_000);
      const evidenceDir = join("quality-audit", ".evidence", "visual-migration-baseline", theme);
      await mkdir(evidenceDir, { recursive: true });
      const outcomes: Array<Record<string, unknown>> = [];
      let interceptedWrites = 0;
      for (const {role, route, note} of roleRoutes) {
        const context = await browser.newContext({
          colorScheme: theme, reducedMotion: "reduce", viewport: {width:390,height:844}
        });
        try {
          if (role !== "guest") await establishSeedRoleSession(context, request, role);
          await context.route("**/*", async next => {
            const req = next.request();
            if (blockBrowserApiWrites(api)(req.url(), req.method())) {
              interceptedWrites++;
              await next.abort("blockedbyclient");
            } else await next.continue();
          });
          const page = await context.newPage();
          const errors: string[] = [];
          page.on("pageerror", e => errors.push(e.message.slice(0,220)));
          await page.goto(frontend + route, {waitUntil:"domcontentloaded",timeout:20000});
          await page.locator("main h1").first().waitFor({state:"visible",timeout:18000});
          await page.waitForFunction(() => {
            const body = document.querySelector("main")?.textContent?.slice(0,200) ?? "";
            return !/กำลังโหลด|กำลังตรวจสอบ|กำลังเตรียม/.test(body);
          }, {timeout:9000}).catch(() => {});
          for (const width of [390,1440,3840]) {
            await page.setViewportSize({width,height:width === 390 ? 844:900});
            if (role === "organizationAdmin") {
              await page.waitForFunction(() => !/กำลังโหลดแดชบอร์ดหน่วยงาน/.test(document.querySelector("main")?.textContent ?? ""), undefined, {timeout:20000}).catch(() => {});
            }
            await page.evaluate(() => document.fonts.ready);
            await page.waitForTimeout(100);
            const metrics = await page.evaluate(() => {
              const root = getComputedStyle(document.documentElement);
              const main = document.querySelector("main");
              return {
                pathname: location.pathname,
                h1: main?.querySelector("h1")?.textContent?.trim() ?? null,
                mainWidth: Math.round(main?.getBoundingClientRect().width ?? 0),
                overflow: Math.max(0,document.documentElement.scrollWidth - innerWidth),
                canvas: root.getPropertyValue("--canvas").trim(),
                brand: root.getPropertyValue("--brand").trim(),
                textColor: root.getPropertyValue("--ink").trim(),
                loading: /กำลังโหลด|กำลังตรวจสอบ|กำลังเตรียม/.test(main?.textContent?.slice(0,200) ?? ""),
                brokenImages: [...document.images].filter(x => x.complete && !x.naturalWidth).length
              };
            });
            const imageName = role + "-" + theme + "-" + width + ".png";
            await page.screenshot({path:join(evidenceDir,imageName),animations:"disabled",caret:"initial",timeout:18000});
            outcomes.push({role,requested:route,theme,width,note,screenshot:theme+"/"+imageName,
              ...metrics,pageErrors:[...errors]});
          }
          await page.close();
        } finally { await context.close(); }
      }
      const failures=outcomes.filter(x=>Number(x.overflow)>1 || Number(x.brokenImages)>0 || !x.h1 || Number(x.mainWidth)===0 ||
        (x.pageErrors as string[]).length>0);
      const summary={theme,context:"read-only UX baseline, not design branch visual parity",screenshots:outcomes.length,
        roleCount:roleRoutes.length,widths:[390,1440,3840],blockedBrowserWrites:interceptedWrites,failures,results:outcomes};
      await writeFile(join(evidenceDir,"visual-baseline.json"),JSON.stringify(summary,null,2)+"\n");
      expect(outcomes).toHaveLength(15);
      expect(interceptedWrites).toBe(0);
      expect(failures,JSON.stringify(failures.slice(0,5))).toHaveLength(0);
    });
  }
});


test.describe("KMITL Orange semantic theme", () => {
  const { frontend, api } = localAuditTargets();
  const cases = [
    { role: "guest", url: "/" },
    { role: "customer", url: "/my/orders/" },
    { role: "staff", url: "/org/orders/?organizationId=" + ids.organizationId },
    { role: "organizationAdmin", url: "/org/dashboard/?organizationId=" + ids.organizationId },
    { role: "platformAdmin", url: "/platform/organizations/" },
  ] as const;

  function luminance(hex: string): number {
    const six = /^#[0-9a-f]{3}$/i.test(hex)
      ? "#" + [...hex.slice(1)].map(part => part + part).join("") : hex;
    if (!/^#[0-9a-f]{6}$/i.test(six)) throw Error("Expected CSS hex, got: " + hex);
    const parts = six.slice(1).match(/.{2}/g)!.map(part => parseInt(part,16)/255)
      .map(x => x<=0.04045 ? x/12.92 : ((x+0.055)/1.055)**2.4);
    return parts[0]*0.2126+parts[1]*0.7152+parts[2]*0.0722;
  }
  function contrast(foreground: string, background: string): number {
    const values = [luminance(foreground),luminance(background)].sort((a,b)=>a-b);
    return (values[1]+0.05)/(values[0]+0.05);
  }

  for(const theme of ["light","dark"] as const) {
    test("Orange palette, five role shells, dark preservation and 4K layout / " + theme, async ({browser,request})=>{
      test.setTimeout(280_000);
      const folder=join("quality-audit",".evidence","kmitl-orange-theme",theme);
      await mkdir(folder,{recursive:true});
      const result: Array<Record<string,unknown>>=[];
      let blockedWrites=0;
      for(const {role,url} of cases){
        const context=await browser.newContext({colorScheme:theme,reducedMotion:"reduce",viewport:{width:390,height:844}});
        try{
          if(role!=="guest")await establishSeedRoleSession(context,request,role);
          await context.route("**/*",async next=>{
            if(blockBrowserApiWrites(api)(next.request().url(),next.request().method())){
              blockedWrites++;return next.abort("blockedbyclient");
            }
            return next.continue();
          });
          const page=await context.newPage();
          const errors: string[]=[];
          page.on("pageerror",e=>errors.push(e.message));
          await page.goto(frontend+url,{waitUntil:"domcontentloaded",timeout:20000});
          await expect(page.locator("main h1").first()).toBeVisible({timeout:15000});
          await page.waitForFunction(()=>
            !/กำลังโหลด|กำลังตรวจสอบ|กำลังเตรียม/.test(document.querySelector("main")?.textContent?.slice(0,200)??""),
            undefined,{timeout:20000}).catch(()=>{});
          for(const width of [390,1440,3840]){
            await page.setViewportSize({width,height:width===390?844:900});
            await page.evaluate(()=>document.fonts.ready);
            await page.waitForTimeout(100);
            const data=await page.evaluate(()=>{
              const root=getComputedStyle(document.documentElement);
              const value=(token:string)=>root.getPropertyValue(token).trim();
              return {
                heading:document.querySelector("main h1")?.textContent?.trim()??"",
                overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),
                canvas:value("--canvas"),surface:value("--surface"),surfaceHover:value("--surface-hover"),
                surfaceSelected:value("--surface-selected"),ink:value("--ink"),secondary:value("--ink-secondary"),
                brand:value("--brand"),brandOn:value("--brand-on"),brandStrong:value("--brand-strong"),brandSoft:value("--brand-soft"),
                focus:value("--focus"),success:value("--success"),
                maxWidth:value("--content-max"),wideWidth:value("--content-wide"),
                targetMin:value("--target-min"),
                colorScheme:root.colorScheme,
                brokenImages:[...document.images].filter(x=>x.complete&&!x.naturalWidth).length
              };
            });
            expect(data.heading).toBeTruthy();
            expect(data.overflow).toBeLessThanOrEqual(1);
            expect(data.brokenImages).toBe(0);
            expect(data.maxWidth).toBe("2680px");
            expect(data.wideWidth).toBe("3000px");
            expect(data.targetMin).toBe("44px");
            expect(data.brand).toBe(theme==="light"?"#e35205":"#ffb47f");
            expect(data.colorScheme).toBe(theme);
            expect(data.success).not.toBe(data.brand);
            for(const [foreground,background] of [
              [data.ink,data.canvas],[data.secondary,data.surface],
              [data.brandOn,data.brand],[data.brandStrong,data.brandSoft],
              [data.ink,data.surfaceHover],[data.ink,data.surfaceSelected]
            ]){
              expect(contrast(foreground,background),theme+" "+role+" "+width+" contrast").toBeGreaterThanOrEqual(4.5);
            }
            expect(contrast(data.focus,data.surface),theme+" focus contrast").toBeGreaterThanOrEqual(3);
            const image=role+"-"+theme+"-"+width+".png";
            await page.screenshot({path:join(folder,image),animations:"disabled",caret:"initial",timeout:18000});
            result.push({role,theme,width,image,...data,errors:[...errors]});
          }
          expect(errors).toEqual([]);
          await page.close();
        }finally{await context.close();}
      }
      await writeFile(join(folder,"semantic-theme-audit.json"),JSON.stringify({
        evidence:"current main palette after semantic token migration",theme,measurements:result.length,
        blockedBusinessWrites:blockedWrites,results:result
      },null,2)+"\n");
      expect(result).toHaveLength(15);
      expect(blockedWrites).toBe(0);
    });
  }
});
