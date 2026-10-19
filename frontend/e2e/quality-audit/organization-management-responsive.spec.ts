import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { establishSeedRoleSession, LOCAL_SEED_ENTITY_IDS as ids } from "../support/seed-auth";
import { localAuditTargets } from "./fixture-guard";

test("nine Organization Admin routes and local search are responsive without writes", async ({ browser, request }) => {
  test.setTimeout(240_000);
  const { frontend } = localAuditTargets();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await establishSeedRoleSession(ctx, request, "organizationAdmin");
  let blockedWrites = 0;
  await ctx.route("**/*", async route => {
    if (!["GET", "HEAD", "OPTIONS"].includes(route.request().method())) {
      blockedWrites++;
      await route.abort("blockedbyclient");
      return;
    }
    await route.continue();
  });
  const org = "?organizationId=" + encodeURIComponent(ids.organizationId);
  const routes = [
    { name: "selector", path: "/org/select/", h1: "วันนี้จะทำงานกับหน่วยงานไหน?", search: "organization-directory-search" },
    { name: "dashboard", path: "/org/dashboard/" + org, h1: "ภาพรวมหน่วยงาน" },
    { name: "settings", path: "/org/settings/" + org, h1: "ตั้งค่าหน่วยงาน" },
    { name: "staff", path: "/org/staff/" + org, h1: "บุคลากรและสิทธิ์", search: "staff-directory-search" },
    { name: "stores", path: "/org/stores/" + org, h1: "ร้านค้า", search: "stores-directory-search" },
    { name: "products", path: "/org/products/" + org, h1: "สินค้าและตัวเลือก", search: "products-directory-search" },
    { name: "campaigns", path: "/org/campaigns/" + org, h1: "แคมเปญ", search: "campaigns-directory-search" },
    { name: "production", path: "/org/production/" + org, h1: "สรุปงานผลิต" },
    { name: "audit", path: "/org/audit/" + org, h1: "ประวัติการทำรายการ", search: "audit-directory-search" },
  ] as const;
  const dir = join("test-results", "quality-audit", "uxqa-" + randomUUID(), "organization-management");
  await mkdir(dir, { recursive: true });
  const observations: Array<Record<string, unknown>> = [];
  try {
    for (const route of routes) {
      const page = await ctx.newPage();
      const pageErrors: string[] = [];
      page.on("pageerror", error => pageErrors.push(error.message));
      await page.goto(frontend + route.path, { waitUntil: "domcontentloaded", timeout: 22000 });
      await expect(page.getByRole("heading", { name: route.h1, level: 1 })).toBeVisible({ timeout: 20000 });
      const searchId = "search" in route ? route.search : null;
      if (searchId) {
        const input = page.locator("#" + searchId);
        // The directory control appears only if organization selector has memberships,
        // and for managed lists only if the role can load them.
        await expect(input, route.name + " search control should load").toBeVisible({ timeout: 20000 });
        await input.fill("uxqa-string-absent-from-loaded-records-20261017");
        await expect(page.getByText(/ไม่พบรายการที่ตรงคำค้นหา/)).toBeVisible();
        await input.fill("");
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      }
      if (["production", "audit"].includes(route.name)) {
        const opsNav = page.getByRole("navigation", { name: "ข้อมูลการดำเนินงานหน่วยงาน" });
        await expect(opsNav).toBeVisible();
        await expect(opsNav.locator('[aria-current="page"]'))
          .toHaveText(route.name === "production" ? "สรุปงานผลิต" : "ประวัติรายการ");
        for (const link of await opsNav.getByRole("link").all()) {
          expect(new URL((await link.getAttribute("href"))!, frontend)
            .searchParams.get("organizationId")).toBe(ids.organizationId);
        }
      }
      if (route.name === "production") {
        await expect(page.getByRole("link", { name: /เปิดรายการรอบขายเพื่อดูรหัส/ }))
          .toHaveAttribute("href", /\/org\/campaigns\/\?organizationId=/);
      }
      if (route.name === "audit") {
        await expect(page.getByRole("navigation", { name: "การสำรวจ Audit Log" }).getByRole("link", { name: /ตัวกรองขั้นสูง/ })).toHaveAttribute("href", "#audit-filter-title");
      }
      if (route.name === "dashboard") {
        const shortcut = page.getByRole("navigation", { name: "ทางลัดงานผู้ดูแลหน่วยงาน" });
        await expect(shortcut).toBeVisible();
        await expect(shortcut.getByRole("link", { name: "สรุปงานผลิต" })).toHaveAttribute("href", /\/org\/production\/\?organizationId=/);
      }
      if (["dashboard", "settings", "staff"].includes(route.name)) {
        const managementNav = page.getByRole("navigation", { name: "พื้นที่จัดการหน่วยงาน" });
        await expect(managementNav).toBeVisible();
        const navLabels = { dashboard: "ภาพรวมงาน", settings: "ข้อมูลหน่วยงาน", staff: "สมาชิกและสิทธิ์" };
        await expect(managementNav.locator('[aria-current="page"]'))
          .toHaveText(navLabels[route.name as "dashboard" | "settings" | "staff"]);
        const links = managementNav.locator('a[href*="organizationId"]');
        await expect(links).toHaveCount(2);
        for (const link of await links.all()) {
          const href = await link.getAttribute("href");
          expect(new URL(href!, frontend).searchParams.get("organizationId"))
            .toBe(ids.organizationId);
        }
        await expect(managementNav.getByRole("link", { name: "เปลี่ยนหน่วยงาน" }))
          .toHaveAttribute("href", /\/org\/select/);
      }
      if (["stores", "products", "campaigns"].includes(route.name)) {
        const commerceNav = page.getByRole("navigation", { name: "จัดการการขายของหน่วยงาน" });
        await expect(commerceNav).toBeVisible();
        const expected = { stores: "ร้านค้า", products: "สินค้าและตัวเลือก", campaigns: "รอบการขาย" };
        await expect(commerceNav.locator('[aria-current="page"]'))
          .toHaveText(expected[route.name as "stores" | "products" | "campaigns"]);
        const links = commerceNav.getByRole("link");
        await expect(links).toHaveCount(2);
        for (const link of await links.all()) {
          const href = await link.getAttribute("href");
          expect(new URL(href!, frontend).searchParams.get("organizationId")).toBe(ids.organizationId);
        }
      }
      if (route.name === "settings") {
        const reference = page.getByText("ดูรหัสหน่วยงานและประวัติการอัปเดต", { exact: true });
        await expect(reference).toBeVisible();
        await expect(page.getByLabel("ข้อมูลอ้างอิงหน่วยงาน").getByText(ids.organizationId, { exact: true })).toBeHidden();
        await reference.click();
        await expect(page.getByLabel("ข้อมูลอ้างอิงหน่วยงาน").getByText(ids.organizationId, { exact: true })).toBeVisible();
        await reference.click();
        await expect(page.getByLabel("ข้อมูลอ้างอิงหน่วยงาน").getByText(ids.organizationId, { exact: true })).toBeHidden();
        const name = page.getByLabel("ชื่อหน่วยงาน");
        await expect(name).toBeVisible();
        const prior = await name.inputValue();
        await name.fill(prior + " unsaved-temp");
        const reset = page.getByRole("button", { name: "คืนค่าที่ยังไม่บันทึก" });
        await expect(reset).toBeVisible();
        await reset.click();
        await expect(name).toHaveValue(prior);
      }
      for (const [width, height] of [[320, 700], [390, 844], [768, 1024], [1440, 900]] as const) {
        await page.setViewportSize({ width, height });
        await page.waitForTimeout(100);
        await page.evaluate(() => window.scrollTo(0, 0));
        if (route.name === "staff" && width === 390) {
          const columns = await page.locator('main section[aria-label="สรุปบุคลากร"]')
            .evaluate(el => getComputedStyle(el).gridTemplateColumns.split(" ").filter(Boolean).length);
          expect(columns).toBe(2);
        }
        const result = await page.evaluate(() => ({
          heading: document.querySelector("main h1")?.textContent?.trim(),
          overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
          failedImages: [...document.images].filter(img => img.complete && !img.naturalWidth).length,
          mainActions: document.querySelectorAll("main a[href],main button").length,
        }));
        expect(result.heading, route.name).toBe(route.h1);
        expect(result.overflow, route.name + " " + width).toBeLessThanOrEqual(1);
        if (width === 390 && ["selector", "staff", "stores", "products", "campaigns"].includes(route.name)) {
          const bounds = await page.evaluate(() => {
            const container = document.querySelector('main [class*="workspaceGrid"],main [class*="grid"]');
            const children = [...(container?.children ?? [])];
            const first = children.find(node => node.tagName === "SECTION");
            const second = children.find(node => node.tagName === "ASIDE");
            return { first: first?.getBoundingClientRect().top, second: second?.getBoundingClientRect().top };
          });
          if (typeof bounds.first === "number" && typeof bounds.second === "number") {
            expect(bounds.first, route.name + " list before creation form").toBeLessThan(bounds.second);
          }
        }
        expect(pageErrors, route.name).toEqual([]);
        observations.push({ route: route.name, width, ...result, pageErrors: [...pageErrors] });
        await page.screenshot({ path: join(dir, route.name + "-" + width + ".png"), animations: "disabled" });
      }
      if (route.name === "stores") {
        const commerceNav = page.getByRole("navigation", { name: "จัดการการขายของหน่วยงาน" });
        await commerceNav.getByRole("link", { name: "สินค้าและตัวเลือก" }).click();
        await expect(page.getByRole("heading", { name: "สินค้าและตัวเลือก", level: 1 })).toBeVisible();
        expect(new URL(page.url()).searchParams.get("organizationId")).toBe(ids.organizationId);
        await page.getByRole("navigation", { name: "จัดการการขายของหน่วยงาน" })
          .getByRole("link", { name: "รอบการขาย" }).click();
        await expect(page.getByRole("heading", { name: "แคมเปญ", level: 1 })).toBeVisible();
        expect(new URL(page.url()).searchParams.get("organizationId")).toBe(ids.organizationId);
      }
      if (route.name === "dashboard") {
        const nav = page.getByRole("navigation", { name: "พื้นที่จัดการหน่วยงาน" });
        await nav.getByRole("link", { name: "สมาชิกและสิทธิ์" }).click();
        await expect(page.getByRole("heading", { name: "บุคลากรและสิทธิ์", level: 1 })).toBeVisible();
        expect(new URL(page.url()).searchParams.get("organizationId")).toBe(ids.organizationId);
        await page.getByRole("navigation", { name: "พื้นที่จัดการหน่วยงาน" })
          .getByRole("link", { name: "ข้อมูลหน่วยงาน" }).click();
        await expect(page.getByRole("heading", { name: "ตั้งค่าหน่วยงาน", level: 1 })).toBeVisible();
        expect(new URL(page.url()).searchParams.get("organizationId")).toBe(ids.organizationId);
      }
      await page.close();
    }
  } finally {
    await ctx.close();
  }
  await writeFile(join(dir, "organization-admin-matrix.json"), JSON.stringify({
    scope: "local read only",
    routes: routes.length, captures: observations.length, blockedWrites, observations,
  }, null, 2) + "\n");
  expect(observations).toHaveLength(36);
  expect(blockedWrites).toBe(0);
});


test("Staff cannot open Organization Admin management or commerce routes via direct URL", async ({ browser, request }) => {
  test.setTimeout(100_000);
  const { frontend } = localAuditTargets();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await establishSeedRoleSession(ctx, request, "staff");
  let attemptedWrites = 0;
  await ctx.route("**/*", async route => {
    if (!["GET", "HEAD", "OPTIONS"].includes(route.request().method())) {
      attemptedWrites++;
      await route.abort("blockedbyclient");
      return;
    }
    await route.continue();
  });
  try {
    for (const pageName of ["dashboard", "staff", "settings", "stores", "products", "campaigns", "production", "audit"]) {
      const page = await ctx.newPage();
      await page.goto(frontend + "/org/" + pageName + "/?organizationId=" + encodeURIComponent(ids.organizationId),
        { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "ไม่มีสิทธิ์เข้าถึง" })).toBeVisible({ timeout: 17000 });
      await expect(page.getByRole("navigation", { name: "พื้นที่จัดการหน่วยงาน" })).toHaveCount(0);
      await expect(page.getByRole("navigation", { name: "จัดการการขายของหน่วยงาน" })).toHaveCount(0);
      await expect(page.getByRole("navigation", { name: "ข้อมูลการดำเนินงานหน่วยงาน" })).toHaveCount(0);
      await page.close();
    }
    expect(attemptedWrites).toBe(0);
  } finally {
    await ctx.close();
  }
});
