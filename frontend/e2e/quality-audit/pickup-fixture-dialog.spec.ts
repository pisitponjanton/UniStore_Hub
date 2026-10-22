import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { establishSeedRoleSession, LOCAL_SEED_ENTITY_IDS as ids } from "../support/seed-auth";
import { localAuditTargets } from "./fixture-guard";

test("synthetic GET-only READY pickup can open details and safely cancel modal", async ({ browser, request }) => {
  test.setTimeout(100_000);
  const { frontend } = localAuditTargets();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await establishSeedRoleSession(ctx, request, "staff");
  const prefix = "/api/v1/organizations/" + ids.organizationId;
  const pickupId = "uxqa-synthetic-pickup-" + randomUUID();
  const orderId = "uxqa-synthetic-order-" + randomUUID();
  const stamp = "2026-10-17T05:00:00.000Z";
  const pickup = {
    pickupId, organizationId: ids.organizationId, orderId, token: "UXQA-TEST-ONLY-TOKEN",
    status: "READY", receivedBy: null, receivedAt: null, createdAt: stamp, updatedAt: stamp,
  };
  const order = {
    orderId, organizationId: ids.organizationId, campaignId: ids.campaignId,
    customerId: "uxqa-synthetic-customer", status: "READY_FOR_PICKUP",
    subtotal: 19900, total: 19900, items: [], createdAt: stamp, updatedAt: stamp,
  };
  let interceptedGets = 0, blockedWrites = 0;
  await ctx.route("**/*", async route => {
    const req = route.request();
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method())) {
      blockedWrites++;
      await route.abort("blockedbyclient");
      return;
    }
    const path = new URL(req.url()).pathname;
    const data = path === prefix + "/pickups" ? { items: [pickup], nextCursor: null }
      : path === prefix + "/pickups/" + pickupId ? pickup
      : path === prefix + "/orders/" + orderId ? order : null;
    if (data !== null) {
      interceptedGets++;
      await route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({ success: true, data }),
      });
      return;
    }
    await route.continue();
  });
  const page = await ctx.newPage();
  try {
    await page.goto(frontend + "/org/pickups/?organizationId=" + encodeURIComponent(ids.organizationId), { waitUntil: "domcontentloaded" });
    const control = page.getByRole("group", { name: "มุมมองรายการที่โหลดแล้ว" });
    await expect(control.getByRole("button", { name: /^รอดำเนินการ/ })).toContainText("1");
    const select = page.getByRole("button", { name: "ดูรายละเอียด Pickup " + pickupId });
    await expect(select).toBeVisible({ timeout: 18000 });
    await select.click();
    const aside = page.locator("#staff-pickup-detail");
    await expect(aside).toContainText("Order ที่เกี่ยวข้อง", { timeout: 15000 });
    await expect(aside).toBeFocused();
    const trigger = aside.getByRole("button", { name: "ยืนยันรับสินค้า" });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "ยืนยันการรับสินค้า" });
    await expect(dialog).toBeVisible();
    const dir = join("test-results", "quality-audit", "uxqa-" + randomUUID(), "pickup-dialog");
    await mkdir(dir, { recursive: true });
    await page.screenshot({ path: join(dir, "synthetic-pickup-confirm-modal-390.png"), animations: "disabled" });
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
    expect(interceptedGets).toBeGreaterThanOrEqual(3);
    expect(blockedWrites).toBe(0);
  } finally {
    await ctx.close();
  }
});
