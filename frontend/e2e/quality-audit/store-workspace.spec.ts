import { expect, test } from "@playwright/test";
import { establishSeedRoleSession, LOCAL_SEED_ENTITY_IDS as ids } from "../support/seed-auth";
import { localAuditTargets } from "./fixture-guard";

test("Store workspace scopes tabs, forms, legacy links and responsive states", async ({ browser, request }) => {
  test.setTimeout(150_000);
  const { frontend } = localAuditTargets();
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 }, reducedMotion: "reduce" });
  await establishSeedRoleSession(context, request, "organizationAdmin");
  const queries: string[] = [];
  let writes = 0;
  await context.route("**/*", async route => {
    const req = route.request();
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method())) {
      writes++;
      await route.abort("blockedbyclient");
      return;
    }
    const url = new URL(req.url());
    if (/\/organizations\/[^/]+\/(products|campaigns)$/.test(url.pathname)) {
      queries.push(url.pathname.split("/").pop() + ":" + url.searchParams.get("storeId"));
    }
    await route.continue();
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const org = encodeURIComponent(ids.organizationId);
  const path = "/org/stores/view/?organizationId=" + org + "&storeId=" + ids.storeId + "&tab=products";
  try {
    await page.goto(frontend + path);
    await expect(page.getByRole("navigation", { name: "เมนูจัดการร้านค้า" })).toBeVisible();
    const nav = page.getByRole("navigation", { name: "เมนูจัดการร้านค้า" });
    await expect(nav.getByRole("link", { name: "สินค้า" })).toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("link", { name: "ภาพรวม" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "เปลี่ยนร้านค้า" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "ร้านค้าทั้งหมด" })).toBeVisible();
    await page.setViewportSize({ width: 1440, height: 768 });
    const sidebar = page.getByRole("navigation", { name: "เมนูหลัก" });
    await expect(sidebar.getByRole("link", { name: "ร้านค้า", exact: true })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "สินค้า", exact: true })).toHaveCount(0);
    await expect(sidebar.getByRole("link", { name: "แคมเปญ", exact: true })).toHaveCount(0);
    for (const colorScheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme });
      for (const width of [320,390,768,1024,1440]) {
        await page.setViewportSize({ width, height: 768 });
        expect(await page.evaluate(() => Math.max(0,document.documentElement.scrollWidth-innerWidth)), colorScheme+" "+width).toBeLessThanOrEqual(1);
      }
    }
    await page.setViewportSize({ width: 1024, height: 768 });
    await nav.getByRole("link", { name: "สินค้า" }).click();
    await expect(nav.getByRole("link", { name: "สินค้า" })).toHaveAttribute("aria-current", "page");
    await expect(page).toHaveURL(/tab=products/);
    await expect(page.getByRole("button", { name: "+ เพิ่มสินค้า" })).toBeVisible();
    await page.getByRole("button", { name: "+ เพิ่มสินค้า" }).click();
    const productModal = page.getByRole("dialog", { name: "สร้างสินค้าใหม่" });
    await expect(productModal).toBeVisible();
    await expect(productModal.locator("#product-create-store")).toHaveCount(0);
    await expect(productModal.getByText(/เพิ่มสินค้าในร้าน/)).toBeVisible();
    await productModal.getByRole("button", { name: "ยกเลิก" }).click();
    await expect(productModal).toHaveCount(0);

    await nav.getByRole("link", { name: "แคมเปญ" }).click();
    await expect(page).toHaveURL(/tab=campaigns/);
    await expect(page.getByRole("button", { name: "+ สร้างแคมเปญ" })).toBeVisible();
    await page.getByRole("button", { name: "+ สร้างแคมเปญ" }).click();
    const campaignModal = page.getByRole("dialog", { name: "สร้างแคมเปญ" });
    await expect(campaignModal).toBeVisible();
    await expect(campaignModal.locator("#campaign-create-store")).toHaveCount(0);
    await expect(campaignModal.getByText(/สร้างแคมเปญในร้าน/)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(campaignModal).toHaveCount(0);

    await nav.getByRole("link", { name: "ตั้งค่า" }).click();
    await expect(page.locator("#workspace-store-name")).toBeVisible();
    const storeNameField = page.locator("#workspace-store-name");
    const originalName = await storeNameField.inputValue();
    await storeNameField.fill(originalName + " unsaved draft");
    page.once("dialog", dialog => dialog.dismiss());
    await nav.getByRole("link", { name: "สินค้า" }).click();
    await expect(page).toHaveURL(/tab=settings/);
    await expect(storeNameField).toHaveValue(originalName + " unsaved draft");
    await page.setViewportSize({ width: 1440, height: 768 });
    page.once("dialog", dialog => dialog.dismiss());
    await sidebar.getByRole("link", { name: "ร้านค้า", exact: true }).click();
    await expect(page).toHaveURL(/tab=settings/);
    await expect(storeNameField).toHaveValue(originalName + " unsaved draft");
    await storeNameField.fill(originalName);
    await page.reload();
    await expect(nav.getByRole("link", { name: "ตั้งค่า" })).toHaveAttribute("aria-current", "page");
    await expect(page.locator("#workspace-store-name")).toBeVisible();

    expect(queries).toContain("products:"+ids.storeId);
    expect(queries).toContain("campaigns:"+ids.storeId);

    await page.goto(frontend + "/org/products/?organizationId=" + org);
    await expect(page.getByRole("heading", { name: /เลือกร้านค้าสำหรับจัดการสินค้า/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /กลับหน้าร้านค้า/ })).toBeVisible();
    await page.goto(frontend + "/org/campaigns/?organizationId=" + org + "&storeId=" + ids.storeId);
    await expect(page).toHaveURL(/\/org\/stores\/view\/.*tab=campaigns/);
    expect(errors).toEqual([]);
    expect(writes).toBe(0);
  } finally {
    await context.close();
  }
});


test("Store workspace never exposes another tenant's store even when GET returns a mismatched DTO", async ({ browser, request }) => {
  const { frontend } = localAuditTargets();
  const ctx = await browser.newContext();
  await establishSeedRoleSession(ctx, request, "organizationAdmin");
  const org = ids.organizationId;
  let scopedQueries = 0;
  await ctx.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (/\/organizations\/[^/]+\/(products|campaigns)$/.test(url.pathname)) scopedQueries++;
    await route.continue();
  });
  await ctx.route("**/organizations/" + org + "/stores/" + ids.storeId, async route => {
    await route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ success: true, data: {
        storeId: ids.storeId, organizationId: "another-organization",
        name: "Other Tenant Store", description: "Private",
        status: "ACTIVE", createdAt: "2026-10-24T10:00:00.000Z", updatedAt: "2026-10-24T10:00:00.000Z"
      } })
    });
  });
  const page = await ctx.newPage();
  try {
    await page.goto(frontend + "/org/stores/view/?organizationId=" + org + "&storeId=" + ids.storeId + "&tab=products");
    await expect(page.getByRole("alert").filter({hasText:"ไม่ได้อยู่ในหน่วยงาน"})).toBeVisible();
    await expect(page.getByText("Other Tenant Store")).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "เมนูจัดการร้านค้า" })).toHaveCount(0);
    expect(scopedQueries).toBe(0);
  } finally {
    await ctx.close();
  }
});

test("Inactive Store is visibly inactive but keeps internal Product and Campaign management", async ({ browser, request }) => {
  test.setTimeout(90000);
  const { frontend } = localAuditTargets();
  const ctx = await browser.newContext();
  await establishSeedRoleSession(ctx, request, "organizationAdmin");
  const org = ids.organizationId;
  await ctx.route("**/organizations/" + org + "/stores/" + ids.storeId, async route => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      success: true, data: { storeId: ids.storeId, organizationId: org,
        name: "Temporarily Closed Shop", description: "Inactive display only",
        status: "INACTIVE", createdAt: "2026-10-24T10:00:00.000Z", updatedAt: "2026-10-24T10:00:00.000Z"
      }
    })});
  });
  const page = await ctx.newPage();
  try {
    await page.goto(frontend + "/org/stores/view/?organizationId=" + org + "&storeId=" + ids.storeId + "&tab=products");
    await expect(page.getByText("ร้านค้านี้ปิดการแสดงผลสำหรับลูกค้า")).toBeVisible();
    const nav = page.getByRole("navigation", { name: "เมนูจัดการร้านค้า" });
    await nav.getByRole("link", { name: "สินค้า" }).click();
    await expect(page.getByRole("button", { name: "+ เพิ่มสินค้า" })).toBeEnabled();
    await page.getByRole("button", { name: "+ เพิ่มสินค้า" }).click();
    const productModal = page.getByRole("dialog", { name: "สร้างสินค้าใหม่" });
    await expect(productModal.getByRole("button", { name: "สร้างสินค้า", exact: true })).toBeEnabled();
    await expect(productModal.getByText("สามารถเตรียมข้อมูลภายในร้านได้")).toBeVisible();
    await productModal.getByRole("button", { name: "ยกเลิก" }).click();
    await nav.getByRole("link", { name: "แคมเปญ" }).click();
    await expect(page.getByRole("button", { name: "+ สร้างแคมเปญ" })).toBeEnabled();
    await page.getByRole("button", { name: "+ สร้างแคมเปญ" }).click();
    const campaignModal = page.getByRole("dialog", { name: "สร้างแคมเปญ" });
    await expect(campaignModal.getByRole("button", { name: "สร้างแคมเปญ", exact: true })).toBeEnabled();
    await campaignModal.getByRole("button", { name: "ยกเลิก" }).click();
  } finally { await ctx.close(); }
});


test("Store grid and Product/Campaign detail links open dedicated pages without writes", async ({ browser, request }) => {
  test.setTimeout(90000);
  const { frontend } = localAuditTargets();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await establishSeedRoleSession(context, request, "organizationAdmin");
  const page = await context.newPage();
  const org = encodeURIComponent(ids.organizationId);
  const store = encodeURIComponent(ids.storeId);
  const base = "/org/stores/view/?organizationId=" + org + "&storeId=" + store;
  try {
    await page.goto(frontend + "/org/stores/?organizationId=" + org);
    const storesGrid = page.getByRole("heading", { name: "ร้านค้าในหน่วยงาน" });
    await expect(storesGrid).toBeVisible();
    const storeCards = page.locator('a[href*="/org/stores/view/"]');
    await expect(storeCards.first()).toBeVisible();
    const storeCard = storeCards.first().locator("xpath=ancestor::article");
    await expect(storeCard).toBeVisible();
    expect(await storeCard.evaluate(el => getComputedStyle(el.parentElement!).gridTemplateColumns.split(" ").length)).toBeGreaterThanOrEqual(2);

    await page.goto(frontend + base);
    await expect(page.getByRole("navigation", { name: "เมนูจัดการร้านค้า" })
      .getByRole("link", { name: "สินค้า" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("navigation", { name: "เมนูจัดการร้านค้า" })
      .getByRole("link", { name: "ภาพรวม" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "แก้ไขสินค้า" }).first()).toBeVisible();
    const productGrid = page.locator('a[href*="/org/stores/product/"]').first().locator("xpath=ancestor::article");
    expect(await productGrid.evaluate(el => getComputedStyle(el.parentElement!).gridTemplateColumns.split(" ").length)).toBeGreaterThanOrEqual(2);
    await page.getByRole("link", { name: "แก้ไขสินค้า" }).first().click();
    await expect(page).toHaveURL(/\/org\/stores\/product\/.*productId=/);
    await expect(page.locator("#product-edit-name")).toBeVisible();
    await expect(page.getByText("รหัสสินค้า:", {exact:false})).toBeVisible();
    await expect(page.getByText("อัปเดตล่าสุด", {exact:false})).toBeVisible();
    await expect(page.getByText("ข้อมูลระบบ", {exact:true})).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "ตัวเลือกสินค้าและราคา" })).toBeVisible();
    await expect(page.getByRole("navigation", {name:"เมนูจัดการร้านค้า"})).toHaveCount(0);
    await expect(page.getByRole("link", { name: /กลับไปรายการสินค้า/ })).toBeVisible();
    if (await page.getByRole("button", {name:"ปิดใช้งาน", exact:true}).count() > 0) {
      await page.getByRole("button", {name:"ปิดใช้งาน", exact:true}).first().click();
      await expect(page.getByRole("dialog", {name:"ยืนยันการปิดใช้งานสินค้า"})).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog", {name:"ยืนยันการปิดใช้งานสินค้า"})).toHaveCount(0);
    }
    for (const theme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: theme });
      for (const width of [320,390,768,1440]) {
        await page.setViewportSize({width,height:900});
        expect(await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth)), "product "+theme+" "+width).toBeLessThanOrEqual(1);
      }
    }
    await page.reload();
    await expect(page.locator("#product-edit-name")).toBeVisible();

    await page.goto(frontend + base + "&tab=campaigns");
    const detailLink = page.locator('a[href*="/org/stores/campaign/"]').first();
    await expect(detailLink).toBeVisible();
    await detailLink.click();
    await expect(page).toHaveURL(/\/org\/stores\/campaign\/.*campaignId=/);
    await expect(page.locator('[data-detail-page="campaign"] h1')).toBeVisible();
    await expect(page.getByRole("navigation", {name:"เมนูจัดการร้านค้า"})).toHaveCount(0);
    await expect(page.getByRole("link", { name: /กลับไปรายการแคมเปญ/ })).toBeVisible();
    for (const theme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: theme });
      for (const width of [320,390,768,1440]) {
        await page.setViewportSize({width,height:900});
        expect(await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth)), "campaign "+theme+" "+width).toBeLessThanOrEqual(1);
      }
    }
    await page.reload();
    await expect(page.getByRole("link", { name: /กลับไปรายการแคมเปญ/ })).toBeVisible();
  } finally { await context.close(); }
});

test("Anonymous organization pages redirect to login and retain the exact return URL", async ({ browser }) => {
  const { frontend } = localAuditTargets();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const route = "/org/stores/view/?organizationId=" + ids.organizationId +
    "&storeId=" + ids.storeId + "&tab=products";
  try {
    await page.goto(frontend + route);
    await expect(page).toHaveURL(/\/login\/?\?/);
    const url = new URL(page.url());
    expect(url.searchParams.get("returnTo")).toBe(route);
    await expect(page.getByRole("heading", { name: "เข้าสู่ระบบ" })).toBeVisible();
  } finally { await ctx.close(); }
});


test("Store Profile settings uses a full-width 16:9 cover above its form across viewports", async ({ browser, request }) => {
  const { frontend } = localAuditTargets();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  await establishSeedRoleSession(context, request, "organizationAdmin");
  const page = await context.newPage();
  try {
    await page.goto(frontend + "/org/stores/view/?organizationId=" + ids.organizationId
      + "&storeId=" + ids.storeId + "&tab=settings");
    const cover = page.locator("#workspace-store-cover").locator("xpath=parent::label");
    const formName = page.locator("#workspace-store-name");
    const status = page.getByRole("region", { name: "สถานะร้านค้า" });
    await expect(cover).toBeVisible();
    await expect(page.getByRole("heading", { name: "รูปหน้าร้าน" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "ข้อมูลร้านค้า" })).toBeVisible();
    await expect(formName).toBeVisible();
    await expect(status).toBeVisible();

    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const geometry = await page.evaluate(() => {
        const cover = document.querySelector("#workspace-store-cover")?.closest("label");
        const section = cover?.closest("section");
        const settings = section?.parentElement;
        const content = settings?.parentElement;
        const tabs = document.querySelector('nav[aria-label="เมนูจัดการร้านค้า"]');
        const name = document.querySelector("#workspace-store-name");
        const status = document.querySelector('[aria-label="สถานะร้านค้า"]');
        if (!cover || !section || !settings || !content || !tabs || !name || !status)
          throw new Error("Settings layout incomplete");
        const c = cover.getBoundingClientRect(), s = section.getBoundingClientRect();
        const settingsRect = settings.getBoundingClientRect();
        const contentRect = content.getBoundingClientRect();
        const tabsRect = tabs.getBoundingClientRect();
        const n = name.getBoundingClientRect(), st = status.getBoundingClientRect();
        return { ratio: c.width / c.height, width: c.width,
          parentWidth: s.width, coverEnd: c.bottom, nameTop: n.top,
          statusTop: st.top, settingsWidth: settingsRect.width,
          contentWidth: contentRect.width, settingsLeft: settingsRect.left, tabsLeft: tabsRect.left,
          over: Math.max(0, document.documentElement.scrollWidth - innerWidth) };
      });
      expect(geometry.ratio, "16:9 cover at " + width).toBeCloseTo(16 / 9, 2);
      expect(geometry.width / geometry.parentWidth, "full-width cover at " + width).toBeGreaterThan(.98);
      expect(Math.abs(geometry.settingsWidth - geometry.contentWidth),
        "settings uses the same available width as the other tabs at " + width).toBeLessThanOrEqual(2);
      expect(Math.abs(geometry.settingsLeft - geometry.tabsLeft),
        "settings aligns with other tab content at " + width).toBeLessThanOrEqual(2);
      expect(geometry.nameTop, "form after cover at " + width).toBeGreaterThan(geometry.coverEnd);
      expect(geometry.statusTop, "status after cover at " + width).toBeGreaterThan(geometry.nameTop);
      expect(geometry.over, "horizontal overflow at " + width).toBeLessThanOrEqual(2);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    expect(await cover.evaluate(el => el.getBoundingClientRect().width)).toBeGreaterThan(1000);
    const uploader = page.locator("#workspace-store-cover");
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y2A2SYAAAAASUVORK5CYII=", "base64");
    await uploader.setInputFiles({ name: "preview.png", mimeType: "image/png", buffer: png });
    const preview = page.getByRole("img", { name: "ตัวอย่างรูปหน้าร้านที่เลือก" });
    await expect(preview).toBeVisible();
    await expect.poll(() => preview.evaluate(el => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await expect(page.getByRole("button", { name: "บันทึกรูปหน้าร้าน" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "บันทึกข้อมูล" })).toBeDisabled();
    await expect(status.getByRole("button", { name: /ปิดใช้งานร้าน|เปิดใช้งานร้าน/ })).toBeDisabled();
  } finally {
    await context.close();
  }
});
