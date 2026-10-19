import axe from "axe-core";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test, expect, type BrowserContext } from "@playwright/test";
import { establishSeedRoleSession, LOCAL_SEED_ENTITY_IDS as ids } from "../support/seed-auth";
import { blockBrowserApiWrites, localAuditTargets } from "./fixture-guard";

type Role = "guest" | "customer" | "staff" | "organizationAdmin" | "platformAdmin";
type Route = { index: number; route: string; roles: Role[] };
const org = "?organizationId=" + ids.organizationId;
function urlFor(route: Route, orderId: string | null) {
  const i = route.index;
  if (i === 4) return route.route + org + "&storeId=" + ids.storeId;
  if (i === 5) return route.route + org + "&productId=" + ids.productId + "&campaignId=" + ids.campaignId;
  if (i === 6) return route.route + org + "&campaignId=" + ids.campaignId;
  if (i === 7) return route.route + org + "&campaignId=" + ids.campaignId + "&productId=" + ids.productId + "&variantId=" + ids.variantId;
  if ([9, 10, 11].includes(i)) return route.route + "?orderId=" + (orderId ?? "00000000-0000-4000-8000-000000000000");
  if (i >= 14 && i <= 25) return route.route + org
    + (i === 21 ? "&orderId=" + (orderId ?? "00000000-0000-4000-8000-000000000000") : "")
    + (i === 23 ? "&campaignId=" + ids.campaignId : "");
  return route.route;
}
function roleFor(route: Route): Role {
  if (route.index <= 6) return "guest";
  if (route.index <= 12) return "customer";
  if ([13, 20, 21, 22, 24].includes(route.index)) return "staff";
  if (route.index <= 25) return "organizationAdmin";
  return "platformAdmin";
}
test.use({ trace: "off", video: "off", screenshot: "off" });

test("28 canonical routes × 5 widths, accessibility, visuals and read-only security gate", async ({ browser, request }) => {
  test.setTimeout(480_000);
  const { frontend, api } = localAuditTargets();
  const manifest = JSON.parse(await readFile("quality-audit/coverage-baseline.json", "utf8")) as { routes: Route[]; sourceSha256: string };
  expect(manifest.routes).toHaveLength(28);
  const runId = "uxqa-" + randomUUID();
  const dir = join("test-results", "quality-audit", runId, "design-quality");
  await mkdir(dir, { recursive: true });
  const contexts = new Map<Role, BrowserContext>();
  const outcomes: Array<Record<string, unknown>> = [];
  let blockedWrites = 0;
  let existingOrder: string | null = null;
  try {
    for (const role of ["guest", "customer", "staff", "organizationAdmin", "platformAdmin"] as const) {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
      if (role !== "guest") await establishSeedRoleSession(ctx, request, role);
      await ctx.route("**/*", async route => {
        const req = route.request();
        if (blockBrowserApiWrites(api)(req.url(), req.method())) {
          blockedWrites++;
          await route.abort("blockedbyclient");
        } else await route.continue();
      });
      contexts.set(role, ctx);
    }
    const orderList = await contexts.get("customer")!.newPage();
    await orderList.goto(frontend + "/my/orders/", { waitUntil: "domcontentloaded" });
    try {
      const locator = orderList.locator('main a[href*="orderId="]').first();
      await locator.waitFor({ timeout: 14000, state: "visible" });
      existingOrder = new URL(await locator.getAttribute("href") ?? "", frontend).searchParams.get("orderId");
    } catch { /* fixture gap recorded per route below */ }
    await orderList.close();

    for (const route of manifest.routes) {
      const role = roleFor(route);
      const ctx = contexts.get(role)!;
      const page = await ctx.newPage();
      const url = urlFor(route, existingOrder);
      const pageErrors: string[] = [], errorResponses: string[] = [];
      page.on("pageerror", err => pageErrors.push(err.message.slice(0, 250)));
      page.on("response", response => {
        if (response.status() >= 500) errorResponses.push(response.status() + " " + new URL(response.url()).pathname);
      });
      let navigation: string | null = null;
      try {
        await page.goto(frontend.replace(/\/$/, "") + url, { waitUntil: "domcontentloaded", timeout: 18000 });
        await page.locator("main h1").first().waitFor({ state: "visible", timeout: 16000 }).catch(() => {});
        await page.waitForFunction(() => {
          const main = document.querySelector("main");
          return Boolean(main?.querySelector("h1")) &&
            !/กำลังโหลด|กำลังตรวจสอบ|กำลังเตรียม/.test(main?.textContent?.slice(0, 220) ?? "");
        }, null, { timeout: 12500 }).catch(() => {});
        await page.waitForTimeout(130);
      } catch (error) { navigation = error instanceof Error ? error.message.slice(0, 250) : String(error); }

      let axeResult: { violations: Array<{ id: string; impact: string | null; selectors: string[][]; description: string }> } | null = null;
      for (const [width, height] of [[320, 700], [390, 844], [768, 1024], [1024, 768], [1440, 900]] as const) {
        await page.setViewportSize({ width, height });
        await page.waitForTimeout(85);
        const metrics = await page.evaluate(() => {
          const main = document.querySelector("main");
          const smallViewport = innerWidth;
          const focusables = [...document.querySelectorAll<HTMLElement>('button,a[href],input,textarea,select,[tabindex]:not([tabindex="-1"])')];
          const clippedControls = focusables.filter(el => {
            const rect = el.getBoundingClientRect();
            const style = getComputedStyle(el);
            if (style.display === "none" || style.visibility === "hidden" || rect.width === 0 || rect.height === 0) return false;
            return rect.right > smallViewport + 2 || rect.left < -2;
          }).slice(0, 12).map(el => ({ tag: el.tagName, text: el.getAttribute("aria-label") ?? el.textContent?.trim().slice(0, 45), edge: Math.round(el.getBoundingClientRect().right) }));
          const unlabeled = [...document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("main input,main textarea,main select")].filter(el => {
            if (["hidden", "submit", "button"].includes(el.type)) return false;
            return !el.getAttribute("aria-label") && !el.getAttribute("aria-labelledby") && !el.labels?.length && !el.getAttribute("title");
          }).map(el => ({ tag: el.tagName, type: el.type, placeholder: el.getAttribute("placeholder") })).slice(0, 12);
          return {
            h1: main?.querySelector("h1")?.textContent?.trim() ?? null,
            overflowPx: Math.max(0, document.documentElement.scrollWidth - innerWidth),
            controls: main?.querySelectorAll("button,a[href],input,textarea,select").length ?? 0,
            brokenImages: [...document.images].filter(img => img.complete && !img.naturalWidth).length,
            loading: /กำลังโหลด|กำลังตรวจสอบ|กำลังเตรียม/.test(main?.textContent?.slice(0, 240) ?? ""),
            clippedControls,
            unlabeled,
          };
        });
        const name = "route-" + String(route.index).padStart(2, "0") + "-" + width + ".png";
        let screenshot: string | null = null;
        try {
          await page.screenshot({ path: join(dir, name), animations: "disabled", timeout: 12000 });
          screenshot = name;
        } catch {/* preserve failure */}
        if (width === 390 && !navigation) {
          try {
            await page.addScriptTag({ content: axe.source });
            axeResult = await page.evaluate(async () => {
              const a = (window as unknown as { axe: typeof axe }).axe;
              const result = await a.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } });
              return { violations: result.violations.map(v => ({
                id: v.id, impact: v.impact ?? null,
                description: v.help, selectors: v.nodes.slice(0, 6).map(n => n.target.map(String)),
              })) };
            });
          } catch (err) {
            axeResult = { violations: [{ id: "axe-run-error", impact: "critical", description: String(err).slice(0, 140), selectors: [] }] };
          }
        }
        const fixtureGap = !existingOrder && [9, 10, 11, 21].includes(route.index) ? "MISSING_EXISTING_ORDER" : null;
        const outcome = navigation || !screenshot ? "BLOCKED"
          : !metrics.h1 || metrics.loading || fixtureGap || metrics.overflowPx > 1 || metrics.unlabeled.length || metrics.clippedControls.length || pageErrors.length || metrics.brokenImages > 0 || (width === 390 && axeResult?.violations.length)
            ? "REVIEW_REQUIRED" : "CAPTURED";
        outcomes.push({
          routeIndex: route.index, route: route.route, role, viewport: width,
          navigation, outcome, screenshot, fixtureGap, ...metrics,
          axeViolations: width === 390 ? (axeResult?.violations ?? null) : null,
          pageErrors: [...new Set(pageErrors)], http5xx: [...new Set(errorResponses)],
          actionOutcomes: "NOT_TESTED",
        });
      }
      await page.close();
    }
  } finally {
    await Promise.all([...contexts.values()].map(c => c.close()));
  }
  const aggregate = {
    runId, manifestSha256: manifest.sourceSha256, uniqueRoutes: new Set(outcomes.map(x => x.routeIndex)).size,
    captures: outcomes.length, blockedWrites, existingOrderFound: Boolean(existingOrder),
    outcomeCounts: outcomes.reduce<Record<string, number>>((acc, x) => { const k = String(x.outcome); acc[k] = (acc[k] ?? 0) + 1; return acc; }, {}),
    axeViolations: outcomes.flatMap(x => (x.axeViolations as Array<{id: string}> | null) ?? []).reduce<Record<string, number>>((acc, x) => { acc[x.id] = (acc[x.id] ?? 0) + 1; return acc; }, {}),
    outcomes, caveat: "Screenshots and automated axe checks do not establish all 257 interactions. No mutation requests were sent.",
  };
  await writeFile(join(dir, "responsive-a11y-matrix.json"), JSON.stringify(aggregate, null, 2) + "\n");
  expect(outcomes).toHaveLength(140);
  expect(aggregate.uniqueRoutes).toBe(28);
  expect(blockedWrites).toBe(0);
});
