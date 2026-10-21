import { installOrdinaryStorePreview } from "./campus-a-storefront-preview";
import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { blockBrowserApiWrites, localAuditTargets } from "./fixture-guard";

const { frontend, api } = localAuditTargets();
const dir = resolve(process.cwd(), "quality-audit/.evidence/campus-a-phase4");
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
