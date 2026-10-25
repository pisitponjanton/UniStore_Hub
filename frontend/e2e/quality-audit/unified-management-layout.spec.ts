import { expect, test } from "@playwright/test";
import { establishSeedRoleSession, LOCAL_SEED_ENTITY_IDS as ids } from "../support/seed-auth";
import { localAuditTargets } from "./fixture-guard";

const pages = [
  { slug: "stores", title: "ร้านค้า", create: "+ สร้างร้านค้า", dialog: "สร้างร้านค้าใหม่", input: "#store-create-name" },
  { slug: "products", title: "สินค้าและตัวเลือก", create: "+ เพิ่มสินค้า", dialog: "สร้างสินค้าใหม่", input: "#product-create-name" },
  { slug: "campaigns", title: "แคมเปญ", create: "+ สร้างแคมเปญ", dialog: "สร้างแคมเปญ", input: "#campaign-create-name" },
  { slug: "production", title: "สรุปงานผลิต" },
] as const;

test("shared management layout stays inside 320–1440px viewports and forms open on demand", async ({ browser, request }) => {
  test.setTimeout(180_000);
  const { frontend } = localAuditTargets();
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 773 }, reducedMotion: "reduce" });
  await establishSeedRoleSession(ctx, request, "organizationAdmin");
  let unexpectedWrites = 0;
  await ctx.route("**/*", async route => {
    if (!["GET", "HEAD", "OPTIONS"].includes(route.request().method())) {
      unexpectedWrites++;
      await route.abort("blockedbyclient");
      return;
    }
    await route.continue();
  });
  try {
    for (const mode of ["light", "dark"] as const) {
      for (const item of pages) {
        const page = await ctx.newPage();
        const errors: string[] = [];
        page.on("pageerror", error => errors.push(error.message));
        await page.emulateMedia({ colorScheme: mode });
        const scoped = item.slug === "products" || item.slug === "campaigns";
        const url = scoped
          ? "/org/stores/view/?organizationId=" + ids.organizationId + "&storeId=" + ids.storeId + "&tab=" + item.slug
          : "/org/" + item.slug + "/?organizationId=" + ids.organizationId;
        await page.goto(frontend + url, { waitUntil: "domcontentloaded" });
        if (scoped) {
          await expect(page.getByRole("navigation", { name: "เมนูจัดการร้านค้า" })).toBeVisible({ timeout: 20000 });
        } else {
          await expect(page.getByRole("heading", { name: item.title, level: 1 })).toBeVisible({ timeout: 20000 });
        }
        for (const width of [320, 390, 768, 1024, 1279, 1280, 1440]) {
          await page.setViewportSize({ width, height: 773 });
          const geometry = await page.evaluate(() => {
            const main = document.querySelector("main");
            const rect = main?.getBoundingClientRect();
            return {
              overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
              mainLeft: rect?.left ?? -1,
              mainRight: rect?.right ?? -1,
            };
          });
          expect(geometry.overflow, item.slug + " " + mode + " " + width).toBeLessThanOrEqual(1);
          expect(geometry.mainLeft, item.slug + " left").toBeGreaterThanOrEqual(-1);
          expect(geometry.mainRight, item.slug + " right").toBeLessThanOrEqual(width + 1);
          if (width === 1024) {
            const menu = page.getByRole("button", { name: "เปิดเมนูหลัก" });
            await expect(menu).toBeVisible();
            expect(geometry.mainLeft).toBeLessThan(90);
            await menu.click();
            await expect(page.getByRole("dialog", { name: "เมนูหลัก" })).toBeVisible();
            await page.keyboard.press("Escape");
            await expect(page.getByRole("dialog", { name: "เมนูหลัก" })).not.toBeVisible();
          }
        }
        await page.setViewportSize({ width: 1024, height: 773 });
        if ("create" in item) {
          await page.getByRole("button", { name: item.create }).click();
          const modal = page.getByRole("dialog", { name: item.dialog });
          await expect(modal).toBeVisible();
          await expect(page.locator(item.input)).toBeVisible();
          const bounds = await modal.boundingBox();
          expect(bounds).not.toBeNull();
          expect(Math.abs(bounds!.x + bounds!.width / 2 - 512), "centered " + item.slug).toBeLessThan(3);
          await page.keyboard.press("Escape");
          await expect(modal).toHaveCount(0);
          await expect(page.getByRole("button", { name: item.create })).toBeFocused();

          await page.setViewportSize({ width: 390, height: 844 });
          await page.getByRole("button", { name: item.create }).click();
          const mobileModal = page.getByRole("dialog", { name: item.dialog });
          await expect(mobileModal).toBeVisible();
          const mobileBox = await mobileModal.boundingBox();
          expect(mobileBox?.x).toBe(0);
          expect(mobileBox?.width).toBe(390);
          expect(mobileBox?.height).toBe(844);
          await page.locator(item.input).fill("temporary draft");
          await page.getByRole("button", { name: "ยกเลิก", exact: true }).click();
          await expect(page.getByRole("alertdialog", { name: "ยืนยันการทิ้งข้อมูล" })).toBeVisible();
          await page.getByRole("button", { name: "กลับไปแก้ไข" }).click();
          await expect(page.locator(item.input)).toHaveValue("temporary draft");
          await page.getByRole("button", { name: "ปิดหน้าต่าง" }).click();
          await page.getByRole("button", { name: "ทิ้งข้อมูล" }).click();
          await expect(mobileModal).toHaveCount(0);
        }
        expect(errors, item.slug + " console").toEqual([]);
        await page.close();
      }
    }
    expect(unexpectedWrites).toBe(0);
  } finally {
    await ctx.close();
  }
});
