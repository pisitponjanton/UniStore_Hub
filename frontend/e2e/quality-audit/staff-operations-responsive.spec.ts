import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { establishSeedRoleSession, LOCAL_SEED_ENTITY_IDS as ids } from "../support/seed-auth";
import { localAuditTargets } from "./fixture-guard";

test("Staff Orders, Payments, Pickups read-only action queues and safe dialogs", async ({ browser, request }) => {
  test.setTimeout(210_000);
  const { frontend } = localAuditTargets();
  const evidenceDir = join("test-results", "quality-audit", "uxqa-" + randomUUID(), "staff-operations");
  await mkdir(evidenceDir, { recursive: true });
  const org = "?organizationId=" + encodeURIComponent(ids.organizationId);
  const orgParam = "organizationId=" + encodeURIComponent(ids.organizationId);
  const stages = [
    { name: "orders", path: "/org/orders/" + org, heading: "คำสั่งซื้อของหน่วยงาน", listId: "orders-list" },
    { name: "payments", path: "/org/payments/" + org, heading: "ตรวจสอบการชำระเงิน", listId: "payment-review-list" },
    { name: "pickups", path: "/org/pickups/" + org, heading: "จุดรับสินค้า", listId: "pickup-list" },
  ] as const;
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await establishSeedRoleSession(context, request, "staff");
  let blockedWrites = 0;
  await context.route("**/*", async route => {
    if (!["GET", "HEAD", "OPTIONS"].includes(route.request().method())) {
      blockedWrites++;
      await route.abort("blockedbyclient");
      return;
    }
    await route.continue();
  });

  const results: Array<Record<string, unknown>> = [];
  try {
    for (const stage of stages) {
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.goto(frontend.replace(/\/$/, "") + stage.path, { waitUntil: "domcontentloaded", timeout: 18000 });
      await expect(page.getByRole("heading", { name: stage.heading, level: 1 })).toBeVisible({ timeout: 20000 });
      const queue = page.locator("#" + stage.listId);
      await expect(queue).toBeVisible({ timeout: 20000 });
      await expect(page.getByRole("navigation", { name: "คิวงานเจ้าหน้าที่" })).toHaveCount(0);
      await page.getByRole("button", { name: "เปิดเมนูหลัก" }).click();
      const drawer = page.getByRole("dialog", { name: "เมนูหลัก" });
      const orgNav = drawer.getByRole("navigation", { name: "เมนูหลัก" });
      await expect(orgNav).toBeVisible();
      await expect(orgNav).not.toContainText("คำสั่งซื้อของฉัน");
      await drawer.getByRole("button", { name: "ปิดเมนูหลัก" }).click();
      await expect(page.getByRole("group", { name: "มุมมองรายการที่โหลดแล้ว" })).toBeVisible();
      await expect(page.getByRole("button", { name: "ตัวกรอง" })).toHaveAttribute("aria-expanded", "false");
      const controls = page.getByRole("group", { name: "มุมมองรายการที่โหลดแล้ว" });
      await expect(controls).toBeVisible({ timeout: 18000 });
      const all = controls.getByRole("button", { name: /^ทั้งหมด/ });
      const pending = controls.getByRole("button", { name: /^รอดำเนินการ/ });
      await expect(all).toHaveAttribute("aria-pressed", "true");
      await pending.click();
      await expect(pending).toHaveAttribute("aria-pressed", "true");
      await all.click();
      await expect(all).toHaveAttribute("aria-pressed", "true");

      for (const [width, height] of [[320, 700], [390, 844], [768, 1024], [1440, 900]] as const) {
        await page.setViewportSize({ width, height });
        await page.waitForTimeout(110);
        const details = await page.evaluate(() => ({
          heading: document.querySelector("main h1")?.textContent?.trim(),
          overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
          rowCount: document.querySelectorAll('main article[aria-label]').length,
          errors: [...document.querySelectorAll('[role="alert"]')].map(x => x.textContent?.slice(0, 80)),
        }));
        results.push({ stage: stage.name, width, height, ...details, pageErrors: [...errors] });
        expect(details.heading, stage.name + " h1").toBe(stage.heading);
        expect(details.overflow, stage.name + " width=" + width).toBeLessThanOrEqual(1);
        expect(errors, stage.name + " JS exceptions").toEqual([]);
        await page.screenshot({ path: join(evidenceDir, stage.name + "-" + width + ".png"), animations: "disabled" });
      }

      for (const scheme of ["light", "dark"] as const) {
        await page.emulateMedia({ colorScheme: scheme });
        for (const width of [390, 1440]) {
          await page.setViewportSize({ width, height: 900 });
          await expect(page.getByRole("heading", { name: stage.heading, level: 1 })).toBeVisible();
          const overflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth));
          expect(overflow, stage.name + " " + scheme + " width=" + width).toBeLessThanOrEqual(1);
          await page.screenshot({ path: join(evidenceDir, stage.name + "-" + scheme + "-" + width + ".png"), animations: "disabled" });
        }
      }
      await page.emulateMedia({ colorScheme: "light" });
      await page.setViewportSize({ width: 390, height: 844 });
      if (stage.name === "orders") {
        const detailLink = page.locator('article a[href*="/org/orders/view/"]').first();
        await expect(detailLink).toBeVisible();
        await detailLink.click();
        await expect(page.getByRole("heading", { name: "รายละเอียดคำสั่งซื้อ", level: 1 }))
          .toBeVisible({ timeout: 17000 });
        const nextTask = page.getByRole("complementary", { name: "แนวทางดำเนินการสำหรับสถานะนี้" });
        await expect(nextTask).toBeVisible();
        await expect(page.getByRole("navigation", { name: "คิวงานเจ้าหน้าที่" })
          .getByRole("link", { name: "คำสั่งซื้อ" })).toHaveAttribute("href", new RegExp(orgParam));
        await page.screenshot({ path: join(evidenceDir, "order-detail-390.png"), animations: "disabled" });
        await page.setViewportSize({ width: 1440, height: 900 });
        const detailOverflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth));
        expect(detailOverflow).toBeLessThanOrEqual(1);
        await page.screenshot({ path: join(evidenceDir, "order-detail-1440.png"), animations: "disabled" });
        await page.setViewportSize({ width: 390, height: 844 });
        await page.getByRole("link", { name: "กลับรายการคำสั่งซื้อ" }).click();
        await expect(page.getByRole("heading", { name: "คำสั่งซื้อของหน่วยงาน", level: 1 }))
          .toBeVisible({ timeout: 17000 });
      }
      if (stage.name === "payments") {
        const select = page.getByRole("button", { name: /^ตรวจสอบ การชำระเงิน/ }).first();
        await expect(select).toBeVisible();
        await select.click();
        const detail = page.locator("#staff-payment-detail");
        await expect(detail.getByRole("heading", { name: /^หลักฐานชำระเงิน / })).toBeVisible({ timeout: 20000 });
        await expect(detail).toBeFocused();
        const reject = page.getByRole("button", { name: "ปฏิเสธการชำระเงิน" });
        if (await reject.isVisible()) {
          await reject.click();
          const dialog = page.getByRole("dialog", { name: "ปฏิเสธการชำระเงิน" });
          await expect(dialog).toBeVisible();
          await page.screenshot({ path: join(evidenceDir, "payment-reject-dialog-390.png"), animations: "disabled" });
          await page.keyboard.press("Escape");
          await expect(dialog).not.toBeVisible();
        }
      }
      if (stage.name === "pickups") {
        const select = page.getByRole("button", { name: /^ดูรายละเอียด Pickup/ }).first();
        if (await select.count() === 0) {
          await expect(page.getByText("ยังไม่มีรายการรับสินค้า")).toBeVisible();
          await expect(page.locator("#staff-pickup-detail")).toHaveCount(0);
          results.push({ stage: "pickups", detailState: "BLOCKED", reason: "NO_LOCAL_PICKUP_FIXTURE" });
        } else {
        await expect(select).toBeVisible();
        await select.click();
        const detail = page.locator("#staff-pickup-detail");
        await expect(detail.getByText("Order ที่เกี่ยวข้อง")).toBeVisible({ timeout: 20000 });
        await expect(detail).toBeFocused();
        const confirm = detail.getByRole("button", { name: "ยืนยันรับสินค้า" });
        if (await confirm.isVisible()) {
          await confirm.click();
          const dialog = page.getByRole("dialog", { name: "ยืนยันการรับสินค้า" });
          await expect(dialog).toBeVisible();
          await page.screenshot({ path: join(evidenceDir, "pickup-confirm-dialog-390.png"), animations: "disabled" });
          await page.keyboard.press("Escape");
          await expect(dialog).not.toBeVisible();
        }
        }
      }
      await page.close();
    }
  } finally {
    await context.close();
  }
  await writeFile(join(evidenceDir, "staff-queue-matrix.json"), JSON.stringify({
    runType: "local-read-only", routeCount: stages.length, observations: results.length,
    blockedWrites, results,
    limits: "Existing local fixture state only. No approve/reject/confirm requests submitted.",
  }, null, 2) + "\n");
  expect(results.filter(row => typeof row.width === "number")).toHaveLength(12);
  expect(blockedWrites).toBe(0);
});
