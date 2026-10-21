import { installOrdinaryStorePreview } from "./campus-a-storefront-preview";
import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { establishSeedRoleSession, LOCAL_SEED_ENTITY_IDS, type SeedRole } from "../support/seed-auth";
import { blockBrowserApiWrites, localAuditTargets } from "./fixture-guard";

const { frontend, api } = localAuditTargets();
const viewports = [320, 390, 768, 1024, 1440, 1920, 2560, 3840] as const;
const evidenceDir = resolve(process.cwd(), "quality-audit/.evidence/campus-a-phase3");
const observations: Array<Record<string, string | number | boolean | null>> = [];
mkdirSync(evidenceDir, { recursive: true });

function saveObservations() {
  writeFileSync(resolve(evidenceDir, "responsive-metrics.json"), JSON.stringify({
    checkedAt: new Date().toISOString(),
    descriptions: "Scoped read-only local browser measurements, not exhaustive action or usability coverage.",
    observations,
  }, null, 2) + "\n");
}
async function readonly(context: import("@playwright/test").BrowserContext) {
  await context.route("**/*", async (route) => {
    if (blockBrowserApiWrites(api)(route.request().url(), route.request().method())) {
      await route.abort("blockedbyclient");
    } else {
      await route.continue();
    }
  });
}

for (const scheme of ["light", "dark"] as const) {
  test("Phase 3 marketplace adaptive 320–3840 / " + scheme, async ({ browser }) => {
    test.setTimeout(120_000);
    const context = await browser.newContext({ colorScheme: scheme, viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
    await readonly(context);
    try {
      const page = await context.newPage();
      await installOrdinaryStorePreview(page);
      await page.goto(frontend + "/", { waitUntil: "domcontentloaded" });
      await expect(page.locator("main section[class*='hero']").first()).toBeVisible({ timeout: 15000 });
      await expect(page.locator('a[class*="storeCard"]').first()).toBeVisible({ timeout: 15000 });
      for (const width of viewports) {
        await page.setViewportSize({ width, height: 900 });
        await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
        const metrics = await page.evaluate(() => {
          const hero = document.querySelector<HTMLElement>("main section[class*='hero']");
          const catalog = document.querySelector<HTMLElement>("main section[class*='catalog']");
          const finder = document.querySelector<HTMLElement>("main [class*='finder']");
          const grid = document.querySelector<HTMLElement>("main [class*='storeGrid']");
          const rect = (n: HTMLElement | null) => n?.getBoundingClientRect();
          return {
            heroWidth: Math.round(rect(hero)?.width ?? 0),
            heroX: Math.round(rect(hero)?.left ?? -1),
            catalogWidth: Math.round(rect(catalog)?.width ?? 0),
            catalogX: Math.round(rect(catalog)?.left ?? -1),
            finderX: Math.round(rect(finder)?.left ?? -1),
            columns: grid ? getComputedStyle(grid).gridTemplateColumns.split(" ").length : 0,
            overflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
          };
        });
        expect(metrics.overflow, scheme + " horizontal overflow at " + width).toBeLessThanOrEqual(1);
        expect(metrics.heroWidth, "hero missing").toBeGreaterThan(0);
        expect(Math.abs(metrics.catalogX - metrics.heroX), "misaligned content edge").toBeLessThanOrEqual(2);
        if (width === 1920) expect(metrics.heroWidth).toBeGreaterThan(1750);
        if (width === 2560) expect(metrics.heroWidth).toBeGreaterThan(2300);
        if (width === 3840) expect(metrics.heroWidth).toBeGreaterThan(3100);
        if (width === 3840) expect(metrics.columns, "wide organization layout columns").toBeGreaterThanOrEqual(3);
        observations.push({ scheme, scope: "marketplace", width, ...metrics });
        if ([390, 1440, 2560, 3840].includes(width)) {
          await page.screenshot({ path: resolve(evidenceDir, "marketplace-" + scheme + "-" + width + ".png") });
        }
      }
      saveObservations();
    } finally { await context.close(); }
  });

  test("Phase 3 role workspace responsive / " + scheme, async ({ browser, request }) => {
    test.setTimeout(180_000);
    const org = LOCAL_SEED_ENTITY_IDS.organizationId;
    const cases: Array<{ role: SeedRole; path: string; minMainAt3840: number }> = [
      { role: "customer", path: "/my/orders/", minMainAt3840: 1700 },
      { role: "staff", path: "/org/orders/?organizationId=" + org, minMainAt3840: 2400 },
      { role: "organizationAdmin", path: "/org/dashboard/?organizationId=" + org, minMainAt3840: 2300 },
      { role: "platformAdmin", path: "/platform/organizations/", minMainAt3840: 2600 },
    ];
    for (const entry of cases) {
      const context = await browser.newContext({ colorScheme: scheme, viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
      try {
        await establishSeedRoleSession(context, request, entry.role);
        await readonly(context);
        const page = await context.newPage();
        await page.goto(frontend + entry.path, { waitUntil: "domcontentloaded" });
        await expect(page.getByRole("link", { name: "UniStore Hub", exact: true }).first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('main[class*="main"]').first(), entry.role + " content loaded").toBeVisible({ timeout: 15000 });
        for (const width of [390, 1024, 1920, 2560, 3840]) {
          await page.setViewportSize({ width, height: 900 });
        await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
          const metrics = await page.evaluate(() => {
            const main = document.querySelector<HTMLElement>("main[class*='main']") ?? document.querySelector<HTMLElement>("main");
            return {
              mainWidth: Math.round(main?.getBoundingClientRect().width ?? 0),
              mainX: Math.round(main?.getBoundingClientRect().left ?? 0),
              overflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
            };
          });
          expect(metrics.overflow, entry.role + " overflow at " + width).toBeLessThanOrEqual(1);
          expect(metrics.mainWidth).toBeGreaterThan(0);
          if (width === 3840) expect(metrics.mainWidth, entry.role + " 4K main").toBeGreaterThan(entry.minMainAt3840);
          observations.push({ scheme, scope: entry.role, width, ...metrics });
          if ([390, 3840].includes(width)) {
            await page.screenshot({ path: resolve(evidenceDir, entry.role + "-" + scheme + "-" + width + ".png") });
          }
        }
      } finally { await context.close(); }
    }
    saveObservations();
  });
}
