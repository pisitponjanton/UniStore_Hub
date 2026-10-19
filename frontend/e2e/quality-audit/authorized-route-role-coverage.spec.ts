import axe from "axe-core";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, type BrowserContext } from "@playwright/test";
import { establishSeedRoleSession, LOCAL_SEED_ENTITY_IDS as ids } from "../support/seed-auth";
import { localAuditTargets, blockBrowserApiWrites } from "./fixture-guard";

type Role = "guest" | "customer" | "staff" | "organizationAdmin" | "platformAdmin";
type Route = { index: number; route: string; roles: Role[] };
const widths = [[320, 700], [390, 844], [768, 1024], [1024, 768], [1440, 900]] as const;
const org = "?organizationId=" + ids.organizationId;

function canonicalRole(index: number): Role {
  if (index <= 6) return "guest";
  if (index <= 12) return "customer";
  if ([13, 20, 21, 22, 24].includes(index)) return "staff";
  if (index <= 25) return "organizationAdmin";
  return "platformAdmin";
}

function routeUrl(route: Route, orderId: string | null) {
  if (route.index === 4) return route.route + org + "&storeId=" + ids.storeId;
  if (route.index === 5) return route.route + org + "&productId=" + ids.productId + "&campaignId=" + ids.campaignId;
  if (route.index === 6) return route.route + org + "&campaignId=" + ids.campaignId;
  if (route.index === 21) return route.route + org + "&orderId=" + (orderId ?? "00000000-0000-4000-8000-000000000000");
  if (route.index >= 13 && route.index <= 25) return route.route + org;
  return route.route;
}

test("all additional authorized route-role combinations across five widths, read-only", async ({ browser, request }) => {
  test.setTimeout(200_000);
  const { frontend, api } = localAuditTargets();
  const manifest = JSON.parse(await readFile("quality-audit/coverage-baseline.json", "utf8")) as { routes: Route[] };
  const scenarios = manifest.routes.flatMap(route =>
    route.roles.filter(role => role !== canonicalRole(route.index)).map(role => ({ route, role }))
  );
  expect(scenarios).toHaveLength(11);
  const dir = join("quality-audit", ".evidence", "design-quality", "secondary-roles-" + randomUUID());
  await mkdir(dir, { recursive: true });
  const contexts = new Map<Role, BrowserContext>();
  const results: Array<Record<string, unknown>> = [];
  let blockedWrites = 0;
  let existingOrder: string | null = null;
  try {
    for (const role of ["guest", "customer", "organizationAdmin"] as const) {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
      if (role !== "guest") await establishSeedRoleSession(ctx, request, role);
      await ctx.route("**/*", async route => {
        if (blockBrowserApiWrites(api)(route.request().url(), route.request().method())) {
          blockedWrites++; await route.abort("blockedbyclient");
        } else await route.continue();
      });
      contexts.set(role, ctx);
    }
    const customer = contexts.get("customer")!;
    const orderList = await customer.newPage();
    await orderList.goto(frontend + "/my/orders/", { waitUntil: "domcontentloaded" });
    const orderLink = orderList.locator('main a[href*="orderId="]').first();
    if (await orderLink.waitFor({ state: "visible", timeout: 11000 }).then(() => true).catch(() => false)) {
      existingOrder = new URL((await orderLink.getAttribute("href"))!, frontend).searchParams.get("orderId");
    }
    await orderList.close();

    for (const { route, role } of scenarios) {
      const page = await contexts.get(role)!.newPage();
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      const requested = frontend + routeUrl(route, existingOrder);
      await page.goto(requested, { waitUntil: "domcontentloaded", timeout: 18000 });
      await expect(page.locator("main h1").first()).toBeVisible({ timeout: 16000 });
      await page.waitForFunction(() => {
        const text = document.querySelector("main")?.textContent?.slice(0, 180) ?? "";
        return !/กำลังโหลด|กำลังตรวจสอบ|กำลังเตรียม/.test(text);
      }, { timeout: 11000 }).catch(() => {});

      for (const [width, height] of widths) {
        await page.setViewportSize({ width, height });
        await page.waitForTimeout(65);
        const metric = await page.evaluate(() => ({
          heading: document.querySelector("main h1")?.textContent?.trim() ?? null,
          overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
          brokenImages: [...document.images].filter(x => x.complete && !x.naturalWidth).length,
        }));
        let violations: string[] = [];
        if (width === 390) {
          await page.addScriptTag({ content: axe.source });
          violations = await page.evaluate(async () => {
            const a = (window as unknown as { axe: typeof axe }).axe;
            const result = await a.run(document, { runOnly: { type: "tag",
              values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } });
            return result.violations.map(v => v.id);
          });
        }
        results.push({ route: route.route, role, width, heading: metric.heading,
          redirected: new URL(page.url()).pathname !== new URL(requested).pathname,
          overflow: metric.overflow, brokenImages: metric.brokenImages,
          violations, pageErrors: [...errors] });
        expect(metric.heading).toBeTruthy();
        expect(metric.overflow, route.route + " " + role + " " + width).toBeLessThanOrEqual(1);
        expect(metric.brokenImages).toBe(0);
        expect(errors).toEqual([]);
        expect(violations).toEqual([]);
      }
      await page.close();
    }
  } finally {
    await Promise.all([...contexts.values()].map(ctx => ctx.close()));
  }
  await writeFile(join(dir, "secondary-route-role-matrix.json"),
    JSON.stringify({ authorizedCombinations: scenarios.length, checks: results.length,
      blockedWrites, existingOrderFound: Boolean(existingOrder), results,
      limitation: "Primary role routes are in responsive-a11y; this extends all other declared authorized roles, not all action states." }, null, 2) + "\n");
  expect(results).toHaveLength(55);
  expect(blockedWrites).toBe(0);
});
