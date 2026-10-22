import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { establishSeedRoleSession, LOCAL_SEED_ENTITY_IDS as ids } from "../support/seed-auth";
import { localAuditTargets } from "./fixture-guard";

test("safe customer journey, actionable orders and visual breakpoints", async ({ browser, request }) => {
  test.setTimeout(210_000);
  const { frontend } = localAuditTargets();
  const evidenceDir = join("test-results", "quality-audit", "uxqa-" + randomUUID(), "customer-responsive");
  await mkdir(evidenceDir, { recursive: true });
  const org = "?organizationId=" + ids.organizationId;
  const stages = [
    { role: "guest", name: "home", url: "/" },
    { role: "guest", name: "store", url: "/stores/view/" + org + "&storeId=" + ids.storeId },
    { role: "guest", name: "campaign", url: "/campaigns/view/" + org + "&campaignId=" + ids.campaignId },
    { role: "guest", name: "product", url: "/products/view/" + org + "&productId=" + ids.productId + "&campaignId=" + ids.campaignId },
    { role: "customer", name: "checkout", url: "/orders/new/" + org + "&campaignId=" + ids.campaignId + "&productId=" + ids.productId + "&variantId=" + ids.variantId },
    { role: "customer", name: "my-orders", url: "/my/orders/" },
    { role: "customer", name: "notifications", url: "/notifications/" },
  ] as const;
  const captures: Array<Record<string, unknown>> = [];
  for (const role of ["guest", "customer"] as const) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
    if (role !== "guest") await establishSeedRoleSession(ctx, request, "customer");
    await ctx.route("**/*", async route => {
      if (!["GET", "HEAD", "OPTIONS"].includes(route.request().method())) {
        await route.abort("blockedbyclient");
        return;
      }
      await route.continue();
    });
    const candidates: Array<{ name: string; url: string }> = stages.filter(x => x.role === role);
    if (role === "customer") {
      const list = await ctx.newPage();
      await list.goto(frontend + "/my/orders/", { waitUntil: "domcontentloaded" });
      await expect(list.locator('main a[href*="orderId="]').first()).toBeVisible({ timeout: 18000 });
      const href = await list.locator('main a[href*="orderId="]').first().getAttribute("href");
      const orderId = new URL(href ?? "", frontend).searchParams.get("orderId");
      expect(orderId).toBeTruthy();
      for (const [name, prefix] of [["order-detail", "/my/order/"], ["payment", "/my/payment/"], ["pickup", "/my/pickup/"]] as const) {
        candidates.push({ name, url: prefix + "?orderId=" + encodeURIComponent(orderId ?? "") });
      }
      await list.close();
    }
    for (const c of candidates) {
      const page = await ctx.newPage();
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message.slice(0, 140)));
      await page.goto(frontend + c.url, { waitUntil: "domcontentloaded" });
      await expect(page.locator("main h1")).toBeVisible({ timeout: 18000 });
      if (["checkout", "my-orders", "notifications", "order-detail", "payment", "pickup"].includes(c.name)) {
        const customerNav = page.getByRole("navigation", { name: "เส้นทางผู้ซื้อ" });
        await expect(customerNav).toBeVisible();
        if (c.name === "checkout") {
          await expect(customerNav.getByRole("link", { name: "ค้นหาร้านค้า" })).toHaveAttribute("href", "/");
        } else {
          await expect(customerNav.getByRole("link", { name: "ค้นหาร้านค้า" })).toHaveAttribute("href", "/");
        }
        if (c.name === "notifications") {
          await expect(customerNav.getByRole("link", { name: "คำสั่งซื้อ" })).toHaveAttribute("href", "/my/orders/");
        }
        if (c.name === "payment" || c.name === "pickup") {
          await expect(customerNav.locator('a[href*="/my/order/"]').first())
            .toHaveAttribute("href", /\/my\/order\/\?orderId=/);
        }
      }
      if (c.name === "my-orders") {
        await expect(page.getByRole("group", { name: "กรองคำสั่งซื้อที่โหลดแล้ว" })).toBeVisible({ timeout: 18000 });
        await expect(page.getByRole("button", { name: /^ต้องทำต่อ/ })).toHaveAttribute("aria-pressed", "true");
        await expect(page.getByRole("link", { name: /ชำระเงิน คำสั่งซื้อ|เปิดข้อมูลรับสินค้า คำสั่งซื้อ/ }).first()).toBeVisible();
        await page.getByRole("button", { name: /^ทั้งหมด/ }).click();
        await expect(page.getByRole("button", { name: /^ทั้งหมด/ })).toHaveAttribute("aria-pressed", "true");
      }
      if (c.name === "product") {
        await expect(page.getByRole("heading", { name: "เลือกรายละเอียดที่ต้องการ" })).toBeVisible({ timeout: 18000 });
      }
      for (const [width, height] of [[320, 700], [390, 844], [768, 1024], [1440, 900]] as const) {
        await page.setViewportSize({ width, height });
        await page.waitForTimeout(125);
        const metric = await page.evaluate(() => {
          const main = document.querySelector("main");
          return {
            heading: main?.querySelector("h1")?.textContent?.trim() ?? null,
            overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
            actionCount: main?.querySelectorAll("a[href],button").length ?? 0,
            failedImages: [...document.images].filter(img => img.complete && !img.naturalWidth).length,
          };
        });
        captures.push({ name: c.name, role, width, ...metric, errors: [...errors] });
        expect(metric.heading, c.name).toBeTruthy();
        expect(metric.overflow, c.name + " " + width).toBeLessThanOrEqual(1);
        await page.screenshot({ path: join(evidenceDir, c.name + "-" + width + ".png"), animations: "disabled" });
      }
      if (c.name === "notifications") {
        await page.getByRole("navigation", { name: "เส้นทางผู้ซื้อ" })
          .getByRole("link", { name: "คำสั่งซื้อ" }).click();
        await expect(page).toHaveURL(frontend + "/my/orders/");
        await expect(page.getByRole("heading", { name: "คำสั่งซื้อของฉัน" })).toBeVisible();
      }
      await page.close();
    }
    await ctx.close();
  }
  await writeFile(join(evidenceDir, "matrix.json"), JSON.stringify({ routes: stages.length + 3, views: 4, captures }, null, 2) + "\n");
  expect(captures).toHaveLength(40);
});
