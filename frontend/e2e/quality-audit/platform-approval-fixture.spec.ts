import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { establishSeedRoleSession } from "../support/seed-auth";
import { localAuditTargets } from "./fixture-guard";

test("GET-only synthetic PENDING organization allows approval dialog inspection without changing backend", async ({ browser, request }) => {
  test.setTimeout(85_000);
  const { frontend } = localAuditTargets();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await establishSeedRoleSession(ctx, request, "platformAdmin");
  const id = "uxqa-pending-" + randomUUID();
  const org = {
    organizationId: id, name: "UXQA Synthetic Pending Organization",
    description: "GET-only visual fixture; never submitted to API", status: "PENDING",
    createdBy: "uxqa-local", createdAt: "2026-10-17T01:00:00Z", updatedAt: "2026-10-17T02:00:00Z",
  };
  let interceptedGets = 0, writes = 0;
  await ctx.route("**/*", async route => {
    const req = route.request();
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method())) {
      writes++;
      await route.abort("blockedbyclient");
      return;
    }
    if (req.method() === "GET" && new URL(req.url()).pathname === "/api/v1/platform/organizations") {
      interceptedGets++;
      await route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({ success: true, data: { items: [org], nextCursor: null } }),
      });
      return;
    }
    await route.continue();
  });
  const page = await ctx.newPage();
  try {
    await page.goto(frontend + "/platform/organizations/", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "จัดการหน่วยงาน" })).toBeVisible();
    await expect(page.getByText(org.name)).toBeVisible({ timeout: 18000 });
    const trigger = page.getByRole("button", { name: "อนุมัติ", exact: true });
    await expect(trigger).toBeVisible();
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "อนุมัติ " + org.name + "?" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "ยืนยันอนุมัติ" })).toBeVisible();
    const evidenceDir = join("test-results", "quality-audit", "uxqa-" + randomUUID(), "phase5");
    await mkdir(evidenceDir, { recursive: true });
    await page.screenshot({ path: join(evidenceDir, "synthetic-pending-approval-390.png"), animations: "disabled" });
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
    expect(interceptedGets).toBeGreaterThanOrEqual(1);
    expect(writes).toBe(0);
  } finally {
    await ctx.close();
  }
});
