/**
 * Campus Commerce A — behavior-focused browser regression suite.
 * Consolidated from historical work-item files; all test cases and mock guards retained.
 * Add related cases here; never introduce milestone-numbered spec files.
 */
import { installOrdinaryStorePreview } from "./campus-a-storefront-preview";
import { test, expect } from "@playwright/test";
import { establishSeedRoleSession, LOCAL_SEED_ENTITY_IDS, type SeedRole } from "../support/seed-auth";
import { localAuditTargets, blockBrowserApiWrites } from "./fixture-guard";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

test.describe("Foundation", () => {
const { frontend, api } = localAuditTargets();

function rgb(value: string): number[] {
  const numbers = value.match(/[0-9.]+/g)?.slice(0, 3).map(Number);
  if (!numbers || numbers.length !== 3) throw new Error("Unrecognized rgb: " + value);
  return numbers;
}
function luminance(value: string): number {
  const [r, g, b] = rgb(value).map((n) => {
    const s = n / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return r * 0.2126 + g * 0.7152 + b * 0.0722;
}
function contrast(a: string, b: string): number {
  const [lo, hi] = [luminance(a), luminance(b)].sort((x, y) => x - y);
  return (hi + 0.05) / (lo + 0.05);
}

for (const scheme of ["light", "dark"] as const) {
  test("Campus A text-only brand & readable store row in " + scheme, async ({ browser }) => {
    const ctx = await browser.newContext({ colorScheme: scheme, viewport: { width: 1440, height: 900 } });
    await ctx.route("**/*", async (route) => {
      if (blockBrowserApiWrites(api)(route.request().url(), route.request().method()))
        await route.abort("blockedbyclient");
      else await route.continue();
    });
    try {
      const page = await ctx.newPage();
      await installOrdinaryStorePreview(page);
      for (const path of ["/", "/login/", "/register/"]) {
        await page.goto(frontend + path, { waitUntil: "domcontentloaded" });
        const brand = page.getByRole("link", { name: "UniStore Hub หน้าร้าน" });
        await expect(brand).toBeVisible();
        await expect(brand).toHaveText("UniStore Hub");
        expect(await brand.locator("svg, img, [class*='brandMark']").count()).toBe(0);
      }
      await page.goto(frontend + "/", { waitUntil: "domcontentloaded" });
      const row = page.locator("a[class*='storeCard']").first();
      await expect(row).toBeVisible({ timeout: 14000 });
      await row.hover();
      const pair = await row.evaluate((element) => ({
        foreground: getComputedStyle(element.querySelector('[class*="storeName"]')!).color,
        background: getComputedStyle(element).backgroundColor,
      }));
      expect(contrast(pair.foreground, pair.background), scheme + " hovered store row").toBeGreaterThanOrEqual(4.5);
      for (const width of [390, 1440, 3840]) {
        await page.setViewportSize({ width, height: 900 });
        const compactBrand = page.getByRole("link", { name: "UniStore Hub หน้าร้าน" });
        await expect(compactBrand).toBeVisible();
        await expect(compactBrand).toHaveText("UniStore Hub");
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      }
    } finally { await ctx.close(); }
  });

  test("Campus A text-only app shell for every authenticated role in " + scheme, async ({ browser, request }) => {
    const org = LOCAL_SEED_ENTITY_IDS.organizationId;
    for (const [role, path] of [
      ["customer", "/my/orders/"],
      ["staff", "/org/select/"],
      ["organizationAdmin", "/org/dashboard/?organizationId=" + org],
      ["platformAdmin", "/platform/summary/"],
    ] as const) {
      const context = await browser.newContext({ colorScheme: scheme, viewport: { width: 1440, height: 900 } });
      try {
        await establishSeedRoleSession(context, request, role);
        await context.route("**/*", async (route) => {
          if (blockBrowserApiWrites(api)(route.request().url(), route.request().method()))
            await route.abort("blockedbyclient");
          else await route.continue();
        });
        const page = await context.newPage();
        await page.goto(frontend + path, { waitUntil: "domcontentloaded" });
        const brand = page.getByRole("link", { name: "UniStore Hub", exact: true }).first();
        await expect(brand, role).toBeVisible({ timeout: 15000 });
        await expect(brand).toHaveText("UniStore Hub");
        expect(await brand.locator("svg, img, [class*='brandMark']").count()).toBe(0);
      } finally { await context.close(); }
    }
  });
}
});

test.describe("Responsive", () => {
const { frontend, api } = localAuditTargets();
const viewports = [320, 390, 768, 1024, 1440, 1920, 2560, 3840] as const;
const evidenceDir = resolve(process.cwd(), "quality-audit/.evidence/campus-commerce-responsive");
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
  test("marketplace adaptive 320–3840 / " + scheme, async ({ browser }) => {
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

  test("role workspace responsive / " + scheme, async ({ browser, request }) => {
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
});

test.describe("Interaction", () => {
const { frontend, api } = localAuditTargets();
const dir = resolve(process.cwd(), "quality-audit/.evidence/campus-commerce-interaction");
mkdirSync(dir, { recursive: true });

function luminance(value: string): number {
  const channels = (value.match(/[0-9.]+/g) || []).slice(0, 3).map(Number);
  if (channels.length !== 3) throw new Error("Unsupported computed color " + value);
  const [r, g, b] = channels.map(n => {
    const v = n / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return .2126 * r + .7152 * g + .0722 * b;
}
function contrast(a: string, b: string): number {
  const [lo, hi] = [luminance(a), luminance(b)].sort((x, y) => x - y);
  return (hi + .05) / (lo + .05);
}

for (const theme of ["light", "dark"] as const) {
  test("Campus A controls and hover/focus contrasts " + theme, async ({ browser }) => {
    test.setTimeout(75000);
    const context = await browser.newContext({ colorScheme: theme, viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
    await context.route("**/*", async route => {
      if (blockBrowserApiWrites(api)(route.request().url(), route.request().method())) await route.abort("blockedbyclient");
      else await route.continue();
    });
    const report: Record<string, unknown> = { theme, measurements: [] };
    const records: Record<string, unknown>[] = [];
    try {
      const page = await context.newPage();
      await installOrdinaryStorePreview(page);
      await page.goto(frontend + "/", { waitUntil: "domcontentloaded" });
      const row = page.locator('a[class*="storeCard"]').first();
      await expect(row).toBeVisible({ timeout: 16000 });
      await row.hover();
      await page.waitForTimeout(200);
      const rowColors = await row.evaluate(el => ({
        background: getComputedStyle(el).backgroundColor,
        foreground: getComputedStyle(el.querySelector('[class*="storeName"]') ?? el).color,
      }));
      const rowContrast = contrast(rowColors.foreground, rowColors.background);
      expect(rowContrast, theme + " store hover").toBeGreaterThanOrEqual(4.5);
      records.push({ element: "storeCard:hover", ...rowColors, contrast: rowContrast });

      const selection = page.locator("select").first();
      await expect(selection).toBeVisible();
      const selected = await selection.evaluate(el => ({
        background: getComputedStyle(el).backgroundColor,
        foreground: getComputedStyle(el).color,
        nativeScheme: getComputedStyle(el).colorScheme,
        optionBg: getComputedStyle(el.querySelector("option")!).backgroundColor,
        optionFg: getComputedStyle(el.querySelector("option")!).color,
      }));
      expect(selected.nativeScheme).toBe(theme);
      expect(contrast(selected.foreground, selected.background), theme + " select field").toBeGreaterThanOrEqual(4.5);
      expect(contrast(selected.optionFg, selected.optionBg), theme + " native option").toBeGreaterThanOrEqual(4.5);
      records.push({ element: "select", ...selected, contrast: contrast(selected.foreground, selected.background) });
      await selection.focus();
      const focus = await selection.evaluate(el => ({ visible: el.matches(":focus-visible"), outline: getComputedStyle(el).outlineStyle }));
      expect(focus.visible).toBe(true);
      expect(focus.outline).not.toBe("none");
      records.push({ element: "select:focus-visible", ...focus });

      const featureCard = page.locator('a[class*="discoveryCard"]').first();
      if (await featureCard.count() > 0 && await featureCard.isVisible()) {
        await featureCard.hover();
        await page.waitForTimeout(160);
        const pair = await featureCard.evaluate(el => ({
          background: getComputedStyle(el).backgroundColor,
          foreground: getComputedStyle(el.querySelector('[class*="discoveryStoreName"]') ?? el).color,
        }));
        expect(contrast(pair.foreground, pair.background), theme + " discovery hover").toBeGreaterThanOrEqual(4.5);
        records.push({ element: "discoveryCard:hover", ...pair, contrast: contrast(pair.foreground, pair.background) });
      } else records.push({ element: "discoveryCard", status: "NOT_TESTED: no featured store present" });

      await page.screenshot({ path: resolve(dir, theme + "-storefront-control-hover.png") });
      await page.goto(frontend + "/login/", { waitUntil: "domcontentloaded" });
      const email = page.locator('input[type="email"]').first();
      await expect(email).toBeVisible();
      await email.focus();
      const field = await email.evaluate(el => ({
        visible: el.matches(":focus-visible"),
        outline: getComputedStyle(el).outlineStyle,
        color: getComputedStyle(el).color,
        background: getComputedStyle(el).backgroundColor,
      }));
      expect(field.visible).toBe(true);
      expect(field.outline).not.toBe("none");
      expect(contrast(field.color, field.background), theme + " login email input").toBeGreaterThanOrEqual(4.5);
      records.push({ element: "login input:focus-visible", ...field });
      await page.screenshot({ path: resolve(dir, theme + "-login-field-focused.png") });

      report.measurements = records;
      writeFileSync(resolve(dir, theme + "-controls.json"), JSON.stringify(report, null, 2) + "\n");
    } finally { await context.close(); }
  });
}
});

test.describe("Icons", () => {
const { frontend, api } = localAuditTargets();
const evidence = resolve(process.cwd(), "quality-audit/.evidence/campus-commerce-icons");
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
});
