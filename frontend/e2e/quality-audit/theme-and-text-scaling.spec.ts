import axe from "axe-core";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test, expect } from "@playwright/test";
import { establishSeedRoleSession, LOCAL_SEED_ENTITY_IDS as ids } from "../support/seed-auth";
import { localAuditTargets } from "./fixture-guard";

test("five representative routes in dark theme and 200% root text scale", async ({ browser, request }) => {
  test.setTimeout(165_000);
  const { frontend } = localAuditTargets();
  const dir = join("test-results", "quality-audit", "uxqa-" + randomUUID(), "design-quality-theme");
  await mkdir(dir, { recursive: true });
  const runs: Array<Record<string, unknown>> = [];
  const stages = [
    { role: "guest", name: "landing", url: "/" },
    { role: "customer", name: "customer-orders", url: "/my/orders/" },
    { role: "staff", name: "staff-payment", url: "/org/payments/?organizationId="+ids.organizationId },
    { role: "organizationAdmin", name: "org-staff", url: "/org/staff/?organizationId="+ids.organizationId },
    { role: "platformAdmin", name: "platform-org", url: "/platform/organizations/" },
  ] as const;
  for (const c of stages) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "dark", reducedMotion: "reduce" });
    if (c.role !== "guest") await establishSeedRoleSession(ctx, request, c.role);
    let writes = 0;
    await ctx.route("**/*", async route => {
      if (!["GET","HEAD","OPTIONS"].includes(route.request().method())) {
        writes++;
        await route.abort("blockedbyclient");
      } else await route.continue();
    });
    try {
      const page = await ctx.newPage();
      const errors: string[] = [];
      page.on("pageerror", e => errors.push(e.message));
      await page.goto(frontend + c.url, { waitUntil: "domcontentloaded" });
      await expect(page.locator("main h1")).toBeVisible({ timeout: 16000 });
      await page.waitForFunction(() => !/กำลังโหลด|กำลังตรวจสอบ|กำลังเตรียม/.test(document.querySelector("main")?.textContent?.slice(0,180)??""), { timeout: 7000 }).catch(() => {});
      for (const mode of ["normal", "root-text-200"] as const) {
        await page.evaluate(mode => {
          document.documentElement.style.fontSize = mode === "root-text-200" ? "200%" : "";
        }, mode);
        await page.waitForTimeout(120);
        const state = await page.evaluate(() => ({
          overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
          h1: document.querySelector("main h1")?.textContent?.trim() ?? null,
          images: [...document.images].filter(x => x.complete && !x.naturalWidth).length,
          rootFont: getComputedStyle(document.documentElement).fontSize,
        }));
        await page.screenshot({ path: join(dir, c.name+"-"+mode+".png"), animations: "disabled" });
        let axeViolations: Array<{id: string; nodes: number; evidence: Array<{targets: string[]; summary: string}>}> = [];
        if (mode === "normal") {
          await page.addScriptTag({ content: axe.source });
          axeViolations = await page.evaluate(async () => {
            const a=(window as unknown as {axe: typeof axe}).axe;
            const result=await a.run(document, { runOnly: {type:"rule",values:["color-contrast","button-name","label"]} });
            return result.violations.map(x=>({id:x.id,nodes:x.nodes.length,
              evidence:x.nodes.slice(0,8).map(n=>({targets:n.target.map(String),
                summary:(n.failureSummary??"").slice(0,500)}))}));
          });
        }
        expect(axeViolations, c.name + " dark-theme color contrast, button-name and labels").toEqual([]);
        runs.push({ role:c.role, name:c.name, mode, ...state, axeViolations, pageErrors:[...errors], blockedWrites:writes });
        expect(state.overflow, c.name + " " + mode + " must not overflow horizontally").toBeLessThanOrEqual(1);
        expect(state.h1).toBeTruthy();
        expect(errors).toEqual([]);
        expect(writes).toBe(0);
      }
      await page.close();
    } finally {
      await ctx.close();
    }
  }
  await writeFile(join(dir,"theme-textscale-matrix.json"),JSON.stringify({cases:runs.length,runs},null,2)+"\n");
  expect(runs).toHaveLength(10);
});
