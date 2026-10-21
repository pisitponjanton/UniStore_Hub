import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { blockBrowserApiWrites, localAuditTargets } from "./fixture-guard";

const { frontend, api } = localAuditTargets();
const directory = resolve(process.cwd(), "quality-audit/.evidence/campus-a-phase3");
mkdirSync(directory, { recursive: true });

test("Phase 3: 200% text scaling on public and auth surfaces, reduced-motion, read-only", async ({ browser }) => {
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
