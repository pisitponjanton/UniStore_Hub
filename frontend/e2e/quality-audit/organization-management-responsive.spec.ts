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
    { name: "selector", path: "/org/select/", h1: "หน่วยงานของฉัน" },
    { name: "dashboard", path: "/org/dashboard/" + org, h1: "ภาพรวมหน่วยงาน" },
    { name: "settings", path: "/org/settings/" + org, h1: "ข้อมูลหน่วยงาน" },
    { name: "staff", path: "/org/staff/" + org, h1: "บุคลากรและสิทธิ์", search: "staff-directory-search" },
    { name: "stores", path: "/org/stores/" + org, h1: "ร้านค้า", search: "stores-directory-search" },
    { name: "products", path: "/org/products/" + org, h1: "เลือกร้านค้าสำหรับจัดการสินค้า" },
    { name: "campaigns", path: "/org/campaigns/" + org, h1: "เลือกร้านค้าสำหรับจัดการแคมเปญ" },
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
        await expect(page.getByText(route.name === "staff" ? "ไม่พบสมาชิก" : /ไม่พบรายการที่ตรงคำค้นหา/)).toBeVisible();
        await input.fill("");
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      }
      const sidebar = page.locator('nav[aria-label="เมนูหลัก"]');
      await expect(sidebar).toHaveCount(1);
      await expect(sidebar).not.toContainText("คำสั่งซื้อของฉัน");
      for (const duplicate of ["พื้นที่จัดการหน่วยงาน", "จัดการการขายของหน่วยงาน", "ข้อมูลการดำเนินงานหน่วยงาน", "ทางลัดงานผู้ดูแลหน่วยงาน"]) {
        await expect(page.getByRole("navigation", { name: duplicate })).toHaveCount(0);
      }
      if (route.name !== "selector") {
        for (const link of await sidebar.locator('a[href*="organizationId"]').all()) {
          const href = (await link.getAttribute("href"))!;
          expect(new URL(href, frontend).searchParams.get("organizationId")).toBe(ids.organizationId);
        }
      }
      if (route.name === "production") {
        await expect(page.getByRole("link", { name: /จัดการรอบขาย/ }))
          .toHaveAttribute("href", /\/org\/campaigns\/\?organizationId=/);
      }
      if (route.name === "audit") {
        await expect(page.getByRole("button", { name: "ตัวกรอง" })).toBeVisible();
        await expect(page.getByRole("table")).toHaveCount(0);
      }
      if (route.name === "settings") {
        const reference = page.getByText("ข้อมูลทางเทคนิคและประวัติหน่วยงาน", { exact: true });
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
        const reset = page.getByRole("button", { name: "คืนค่า" });
        await expect(reset).toBeVisible();
        await reset.click();
        await expect(name).toHaveValue(prior);
      }
      for (const [width, height] of [[320, 700], [390, 844], [768, 1024], [1024, 773], [1440, 900]] as const) {
        await page.setViewportSize({ width, height });
        await page.waitForTimeout(100);
        await page.evaluate(() => window.scrollTo(0, 0));
        if (route.name === "staff" && width === 390) {
          const strip = page.getByLabel("สรุปบุคลากร");
          await expect(strip).toBeVisible();
          await expect(strip.getByText("ผู้ดูแล", { exact: false })).toBeVisible();
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
        await page.locator("article").getByRole("link", { name: "จัดการร้านค้า" }).first().click();
        const storeNav = page.getByRole("navigation", { name: "เมนูจัดการร้านค้า" });
        await expect(storeNav).toBeVisible();
        await storeNav.getByRole("link", { name: "สินค้า" }).click();
        await expect(page.getByRole("heading", { name: "สินค้าและตัวเลือก", level: 2 })).toBeVisible();
        expect(new URL(page.url()).searchParams.get("organizationId")).toBe(ids.organizationId);
        await storeNav.getByRole("link", { name: "แคมเปญ" }).click();
        await expect(page.getByRole("heading", { name: "แคมเปญ", level: 2, exact: true })).toBeVisible();
        expect(new URL(page.url()).searchParams.get("organizationId")).toBe(ids.organizationId);
      }
      if (route.name === "dashboard") {
        await expect(page.getByRole("button", { name: "ตัวกรอง", exact: true })).toHaveAttribute("aria-expanded", "false");
        await expect(page.locator("#dashboard-campaign-filter")).toHaveCount(0);
        await expect(page.getByRole("region", { name: "งานและตัวเลขสำคัญ" })).toBeVisible();
        await page.emulateMedia({ colorScheme: "dark" });
        for (const width of [390, 1440]) {
          await page.setViewportSize({ width, height: 900 });
          await expect(page.getByRole("heading", { name: "ภาพรวมหน่วยงาน" })).toBeVisible();
          const overflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth));
          expect(overflow, "dark dashboard " + width).toBeLessThanOrEqual(1);
          await page.screenshot({ path: join(dir, "dashboard-dark-" + width + ".png"), animations: "disabled" });
        }
        for (const colorScheme of ["light", "dark"] as const) {
          await page.emulateMedia({ colorScheme });
          for (const width of [320, 390, 768, 1440]) {
            await page.setViewportSize({ width, height: width < 500 ? 700 : 900 });
            const toggle = page.getByRole("button", { name: "ตัวกรอง", exact: true });
            await toggle.click();
            const popover = page.getByRole("dialog", { name: "กรองรายงาน" });
            await expect(popover).toBeVisible();
            const box = await popover.boundingBox();
            expect(box).not.toBeNull();
            expect(box!.x, "popover left " + colorScheme + width).toBeGreaterThanOrEqual(0);
            expect(box!.x + box!.width, "popover right " + colorScheme + width).toBeLessThanOrEqual(width + 1);
            expect(box!.y, "popover top " + colorScheme + width).toBeGreaterThanOrEqual(0);
            expect(box!.y + box!.height, "popover bottom " + colorScheme + width).toBeLessThanOrEqual((width < 500 ? 700 : 900) + 1);
            if (width === 390 || width === 1440) {
              await page.screenshot({ path: join(dir, "dashboard-filter-" + colorScheme + "-" + width + ".png"), animations: "disabled" });
            }
            await page.keyboard.press("Escape");
            await expect(popover).toHaveCount(0);
            await expect(toggle).toBeFocused();
            await expect(page.getByRole("button", { name: "ดูทุกสถานะ" })).toHaveCount(0);
          }
        }
        await page.emulateMedia({ colorScheme: "light" });
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.locator('nav[aria-label="เมนูหลัก"] a[href*="/org/staff/"]').click();
        await expect(page.getByRole("heading", { name: "บุคลากรและสิทธิ์", level: 1 })).toBeVisible();
        expect(new URL(page.url()).searchParams.get("organizationId")).toBe(ids.organizationId);
        await page.locator('nav[aria-label="เมนูหลัก"] a[href*="/org/settings/"]').click();
        await expect(page.getByRole("heading", { name: "ข้อมูลหน่วยงาน", level: 1 })).toBeVisible();
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
  expect(observations).toHaveLength(45);
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


test("single-column organization settings keeps editing and technical details accessible", async ({ browser, request }) => {
  const { frontend } = localAuditTargets();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  await establishSeedRoleSession(ctx, request, "organizationAdmin");
  let blockedWrites = 0;
  await ctx.route("**/*", async route => {
    if (!["GET", "HEAD", "OPTIONS"].includes(route.request().method())) {
      blockedWrites++;
      return route.abort("blockedbyclient");
    }
    return route.continue();
  });
  try {
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(frontend + "/org/settings/?organizationId=" + ids.organizationId);
    await expect(page.getByRole("heading", { name: "ข้อมูลหน่วยงาน", level: 1 })).toBeVisible();
    const save = page.getByRole("button", { name: "บันทึกข้อมูล" });
    await expect(save).toBeDisabled();
    await expect(page.getByText("ไม่มีการเปลี่ยนแปลง")).toBeVisible();
    await expect(page.getByRole("heading", { name: "สิ่งที่หน้านี้เปลี่ยนไม่ได้" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "บุคลากรและสิทธิ์" }))
      .toHaveAttribute("href", "/org/staff/?organizationId=" + ids.organizationId);
    const technical = page.getByText("ข้อมูลทางเทคนิคและประวัติหน่วยงาน", { exact: true });
    const reference = page.getByLabel("ข้อมูลอ้างอิงหน่วยงาน");
    await expect(reference.getByText(ids.organizationId, { exact: true })).toBeHidden();
    await technical.click();
    await expect(reference.getByText(ids.organizationId, { exact: true })).toBeVisible();
    await technical.click();
    await expect(reference.getByText(ids.organizationId, { exact: true })).toBeHidden();

    const name = page.locator("#organization-settings-name");
    const initial = await name.inputValue();
    await name.fill(initial + " temporary");
    await expect(save).toBeEnabled();
    await expect(page.getByText("มีการเปลี่ยนแปลงที่ยังไม่บันทึก")).toBeVisible();
    await page.getByRole("button", { name: "คืนค่า" }).click();
    await expect(name).toHaveValue(initial);
    await expect(save).toBeDisabled();

    for (const colorScheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme });
      for (const width of [320, 390, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        const geometry = await page.evaluate(() => {
          const main = document.querySelector("main");
          const header = main?.querySelector("header");
          const edit = main?.querySelector('section[aria-label="แก้ไขข้อมูลหน่วยงาน"]');
          const form = edit?.querySelector("form");
          if (!main || !header || !edit || !form) throw new Error("Settings layout incomplete");
          const m = main.getBoundingClientRect(), h = header.getBoundingClientRect(),
            e = edit.getBoundingClientRect(), f = form.getBoundingClientRect();
          return {
            horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
            headerLeft: h.left, editLeft: e.left,
            headerWidth: h.width, editWidth: e.width,
            mainWidth: m.width, formWidth: f.width,
          };
        });
        expect(geometry.horizontalOverflow, colorScheme + " overflow at " + width).toBeLessThanOrEqual(1);
        expect(Math.abs(geometry.headerLeft - geometry.editLeft), colorScheme + " left alignment " + width).toBeLessThanOrEqual(2);
        expect(Math.abs(geometry.headerWidth - geometry.editWidth), colorScheme + " width " + width).toBeLessThanOrEqual(2);
        expect(geometry.formWidth, colorScheme + " readable form width " + width).toBeLessThanOrEqual(841);
      }
    }
    expect(errors).toEqual([]);
    expect(blockedWrites).toBe(0);
  } finally {
    await ctx.close();
  }
});
