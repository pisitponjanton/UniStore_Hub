import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { establishSeedRoleSession, LOCAL_SEED_ENTITY_IDS, type SeedRole } from "../support/seed-auth";
import { blockBrowserApiWrites, localAuditTargets } from "./fixture-guard";

const { frontend, api } = localAuditTargets();
const evidence = resolve(process.cwd(), "quality-audit/.evidence/campus-a-phase5");
mkdirSync(evidence, { recursive: true });

async function readonly(context: import("@playwright/test").BrowserContext) {
  await context.route("**/*", async route => {
    if (blockBrowserApiWrites(api)(route.request().url(), route.request().method()))
      await route.abort("blockedbyclient");
    else await route.continue();
  });
}

for (const theme of ["light", "dark"] as const) {
  test("text-only public wordmark and real Lucide CTA arrows / " + theme, async ({ browser }) => {
    test.setTimeout(75000);
    const context = await browser.newContext({ colorScheme: theme, viewport: { width: 1440, height: 900 } });
    await readonly(context);
    try {
      const page = await context.newPage();
      for (const width of [390, 1440, 3840]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(frontend + "/", { waitUntil: "domcontentloaded" });
        const brand = page.getByRole("link", { name: "UniStore Hub หน้าร้าน" });
        await expect(brand).toBeVisible();
        await expect(brand).toHaveText("UniStore Hub");
        expect(await brand.locator("svg, img").count()).toBe(0);

        const action = page.getByRole("link", { name: /เลือกดูร้านค้า/ }).first();
        await expect(action).toBeVisible();
        await expect(action.locator("svg.lucide-arrow-up-right")).toHaveCount(1);
        expect(await action.locator("svg").first().getAttribute("aria-hidden")).toBe("true");
        expect(await page.getByRole("button", { name: "", exact: true }).count()).toBe(0);
        expect(await page.getByRole("link", { name: "", exact: true }).count()).toBe(0);
        const glyphs = await page.evaluate(() => (document.body.innerText.match(/[↗→]/gu) || []).length);
        expect(glyphs, "no Unicode arrow masquerading as an icon").toBe(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
        if (width !== 1440) {
          await page.screenshot({ path: resolve(evidence, "public-" + theme + "-" + width + ".png") });
        }
      }
    } finally { await context.close(); }
  });

  test("text-only authenticated wordmark and unified navigation glyphs / " + theme, async ({ browser, request }) => {
    test.setTimeout(150000);
    const org = LOCAL_SEED_ENTITY_IDS.organizationId;
    const roles: Array<{ role: SeedRole; url: string }> = [
      { role: "customer", url: "/my/orders/" },
      { role: "staff", url: "/org/orders/?organizationId=" + org },
      { role: "organizationAdmin", url: "/org/dashboard/?organizationId=" + org },
      { role: "platformAdmin", url: "/platform/summary/" },
    ];
    for (const entry of roles) {
      const context = await browser.newContext({ colorScheme: theme, viewport: { width: 1440, height: 900 } });
      try {
        await establishSeedRoleSession(context, request, entry.role);
        await readonly(context);
        const page = await context.newPage();
        await page.goto(frontend + entry.url, { waitUntil: "domcontentloaded" });
        const brand = page.getByRole("link", { name: "UniStore Hub", exact: true }).first();
        await expect(brand).toBeVisible({ timeout: 15000 });
        await expect(brand).toHaveText("UniStore Hub");
        expect(await brand.locator("svg, img").count()).toBe(0);
        const navigationIcons = page.locator('nav svg.lucide');
        await expect(navigationIcons.first()).toBeVisible({ timeout: 15000 });
        const count = await navigationIcons.count();
        expect(count, entry.role + " navigation Lucide count").toBeGreaterThanOrEqual(1);
        expect(await navigationIcons.evaluateAll(icons =>
          icons.every(icon => icon.getAttribute("aria-hidden") === "true" && icon.getAttribute("focusable") === "false")
        )).toBe(true);
        expect(await page.getByRole("button", { name: "", exact: true }).count(), entry.role + " unnamed buttons").toBe(0);
        expect(await page.getByRole("link", { name: "", exact: true }).count(), entry.role + " unnamed links").toBe(0);
        await page.screenshot({ path: resolve(evidence, entry.role + "-" + theme + "-1440.png") });
      } finally { await context.close(); }
    }
  });
}
