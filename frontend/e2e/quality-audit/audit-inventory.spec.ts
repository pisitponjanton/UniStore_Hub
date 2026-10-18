import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, type BrowserContext } from "@playwright/test";
import { establishSeedRoleSession, LOCAL_SEED_ENTITY_IDS as ids } from "../support/seed-auth";
import { assertLocalAuditTargets, assertOwnedMutation, FixtureRegistry, localAuditTargets, blockBrowserApiWrites } from "./fixture-guard";

type AuditRole = "guest" | "customer" | "staff" | "organizationAdmin" | "platformAdmin";
type Entry = { index: number; route: string; roles: string[]; declaredActionCount: number };
const orgQuery = "?organizationId=" + ids.organizationId;
const urlFor = (row: Entry, orderId: string | null) => {
  const idx = row.index;
  if (idx === 4) return row.route + orgQuery + "&storeId=" + ids.storeId;
  if (idx === 5) return row.route + orgQuery + "&productId=" + ids.productId + "&campaignId=" + ids.campaignId;
  if (idx === 6) return row.route + orgQuery + "&campaignId=" + ids.campaignId;
  if (idx === 7) return row.route + orgQuery + "&campaignId=" + ids.campaignId + "&productId=" + ids.productId + "&variantId=" + ids.variantId;
  if ([9, 10, 11].includes(idx)) return row.route + "?orderId=" + (orderId ?? "00000000-0000-4000-8000-000000000000");
  if ([14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25].includes(idx)) {
    return row.route + orgQuery + (idx === 23 ? "&campaignId=" + ids.campaignId : idx === 21 ? "&orderId=" + (orderId ?? "00000000-0000-4000-8000-000000000000") : "");
  }
  return row.route;
};
test.use({ trace: "off", video: "off", screenshot: "off" });

test("FE-UX-BASELINE: manifest remains exact and all actions are untested until proven", async () => {
  const baseline = JSON.parse(await readFile("quality-audit/coverage-baseline.json", "utf8"));
  expect(baseline.routeCount).toBe(28);
  expect(baseline.routeActionCount).toBe(207);
  expect(baseline.shellActionCount).toBe(50);
  expect(baseline.actions).toHaveLength(207);
  const all = [...baseline.actions, ...baseline.shellActions];
  expect(new Set(all.map(a => a.id)).size).toBe(all.length);
  expect(all.every(a => a.status === "NOT_TESTED" && a.evidence.length === 0)).toBe(true);
  expect(baseline.routes.reduce((n: number, r: Entry) => n + r.declaredActionCount, 0)).toBe(207);
});

test("FE-UX-GUARD: refuses non-local access, seed mutation and unowned fixture IDs", async () => {
  expect(() => assertLocalAuditTargets("https://example.com", "http://localhost:4000/api/v1")).toThrow();
  expect(() => assertLocalAuditTargets("http://localhost:3000", "https://api.example.com/api/v1")).toThrow();
  expect(() => assertLocalAuditTargets("http://127.0.0.1:3000", "http://localhost:4000/api/v1")).not.toThrow();
  const fixture = new FixtureRegistry();
  expect(() => fixture.requireOwned("order", ids.organizationId)).toThrow();
  expect(() => fixture.registerCreated("organization", ids.organizationId, fixture.label("org"))).toThrow();
  expect(() => fixture.registerCreated("order", randomUUID(), "old-order")).toThrow();
  const owned = randomUUID();
  fixture.registerCreated("order", owned, fixture.label("order"));
  assertOwnedMutation(fixture, "http://localhost:4000/api/v1/me/orders/" + owned + "/cancel", "POST", "order", owned);
  expect(() => assertOwnedMutation(fixture, "http://localhost:4000/api/v1/me/orders/" + ids.organizationId + "/cancel", "POST", "order", ids.organizationId)).toThrow();
  expect(() => assertOwnedMutation(fixture, "https://my-real-api.example/api/v1/me/orders/" + owned + "/cancel", "POST", "order", owned)).toThrow();
  expect(blockBrowserApiWrites("http://localhost:4000/api/v1")("http://localhost:4000/api/v1/organizations", "POST")).toBe(true);
  expect(blockBrowserApiWrites("http://localhost:4000/api/v1")("http://localhost:4000/api/v1/organizations", "GET")).toBe(false);
  fixture.recordTransition("order", owned, "simulated transition only");
  expect(fixture.journal).toHaveLength(2);
  expect(fixture.retainedRecords()).toHaveLength(1);
});

test("FE-UX-READONLY: 28 authorized route cases x two viewports with blocked browser mutations", async ({ browser, request }) => {
  test.setTimeout(240_000);
  const baseline = JSON.parse(await readFile("quality-audit/coverage-baseline.json", "utf8")) as { routes: Entry[]; sourceSha256: string };
  const { frontend, api } = localAuditTargets();
  const runId = "uxqa-" + randomUUID();
  const outputDir = join("test-results", "quality-audit", runId);
  await mkdir(outputDir, { recursive: true });

  const contexts = new Map<AuditRole, BrowserContext>();
  const entries: Array<Record<string, unknown>> = [];
  let blockedWrites = 0;
  let orderId: string | null = null;
  try {
    for (const role of ["guest", "customer", "staff", "organizationAdmin", "platformAdmin"] as const) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
      if (role !== "guest") await establishSeedRoleSession(context, request, role);
      // Fail closed: ALL browser-originating API mutations blocked (no exceptions).
      await context.route("**/*", async route => {
        const r = route.request();
        if (blockBrowserApiWrites(api)(r.url(), r.method())) {
          blockedWrites++;
          await route.abort("blockedbyclient");
        } else await route.continue();
      });
      contexts.set(role, context);
    }
    const customerPage = await contexts.get("customer")!.newPage();
    await customerPage.goto(frontend + "/my/orders/", { waitUntil: "domcontentloaded" });
    try {
      const link = customerPage.locator('a[href*="/my/order/"]').first();
      await link.waitFor({ state: "visible", timeout: 14000 });
      orderId = new URL((await link.getAttribute("href")) ?? "", frontend).searchParams.get("orderId");
    } catch { /* no owned existing order: keep read-only invalid ID sample, mark blocked */ }
    await customerPage.close();

    for (const row of baseline.routes) {
      const role = (row.index <= 6 ? "guest" : row.index <= 12 ? "customer" : [13, 20, 22, 24].includes(row.index) ? "staff" : row.index <= 25 ? "organizationAdmin" : "platformAdmin") as AuditRole;
      const context = contexts.get(role)!;
      const page = await context.newPage();
      const url = urlFor(row, orderId);
      const diagnostics: string[] = [];
      page.on("pageerror", error => diagnostics.push("pageerror: " + error.name));
      page.on("response", response => { if (response.status() >= 500) diagnostics.push("api5xx:" + response.status()); });
      let navigationError: string | null = null;
      try {
        await page.goto(frontend.replace(/\/$/, "") + url, { waitUntil: "domcontentloaded", timeout: 18000 });
        await page.waitForFunction(() => !((document.querySelector("main")?.textContent ?? "").includes("กำลังโหลด")), { timeout: 9500 }).catch(() => {});
        await page.waitForTimeout(350);
      } catch (e) { navigationError = e instanceof Error ? e.name : "navigation-error"; }
      for (const [width, height] of [[390, 844], [1440, 900]]) {
        await page.setViewportSize({ width, height });
        await page.waitForTimeout(120);
        const snapshot = await page.evaluate(() => {
          const main = document.querySelector("main");
          return {
            h1: main?.querySelector("h1")?.textContent?.trim() ?? null,
            controls: main?.querySelectorAll("button, a[href], input, select, textarea, summary").length ?? 0,
            dialogCount: document.querySelectorAll('[role="dialog"],[role="alertdialog"]').length,
            overflowPx: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
            loading: /กำลังโหลด|กำลังตรวจสอบ|กำลังเตรียม/.test(main?.textContent?.slice(0, 250) ?? ""),
          };
        }).catch(() => ({ h1: null, controls: 0, dialogCount: 0, overflowPx: -1, loading: true }));
        const captureName = "route-" + String(row.index).padStart(2, "0") + "-" + width + ".png";
        let screenshot: string | null = null;
        try {
          await page.screenshot({ path: join(outputDir, captureName), animations: "disabled", timeout: 12000 });
          screenshot = captureName;
        } catch { /* record capture failure explicitly */ }
        entries.push({
          routeIndex: row.index, route: row.route, role, viewport: width + "x" + height,
          visitStatus: navigationError ? "BLOCKED" : snapshot.loading || !snapshot.h1 ? "REVIEW_REQUIRED" : "CAPTURED",
          ...snapshot, navigationError, screenshot, diagnostics: [...new Set(diagnostics)],
          actionOutcomes: "NOT_TESTED", // page visit does not exercise 207 actions
          ...(orderId ? {} : [9, 10, 11, 21].includes(row.index) ? {fixtureGap:"NO_EXISTING_ORDER_ID"} : {}),
        });
      }
      await page.close();
    }
    await writeFile(join(outputDir, "read-only-route-matrix.json"), JSON.stringify({
      runId, sourceSha256: baseline.sourceSha256, visitCount: entries.length,
      distinctRoutes: new Set(entries.map(entry => entry.routeIndex)).size,
      blockedWrites, existingOrderFound: Boolean(orderId), entries,
      description: "DOM/screenshot evidence only; no action-level PASS claims",
    }, null, 2) + "\n");
    expect(entries).toHaveLength(56);
    expect(new Set(entries.map(x => x.routeIndex)).size).toBe(28);
    expect(blockedWrites).toBe(0);
  } finally {
    await Promise.all([...contexts.values()].map(c => c.close()));
  }
});
