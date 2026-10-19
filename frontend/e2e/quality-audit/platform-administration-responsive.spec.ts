import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { establishSeedRoleSession } from "../support/seed-auth";
import { localAuditTargets } from "./fixture-guard";

test("Platform Summary, organizations and users across responsive widths, search, filter and safe approval dialog", async ({ browser, request }) => {
  test.setTimeout(220_000);
  const { frontend } = localAuditTargets();
  const evidenceDir = join("test-results", "quality-audit", "uxqa-" + randomUUID(), "platform-governance");
  await mkdir(evidenceDir, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await establishSeedRoleSession(ctx, request, "platformAdmin");
  let blockedWrites = 0;
  await ctx.route("**/*", async route => {
    if (!["GET", "HEAD", "OPTIONS"].includes(route.request().method())) {
      blockedWrites++;
      await route.abort("blockedbyclient");
      return;
    }
    await route.continue();
  });

  const views = [
    { name: "summary", path: "/platform/summary/", h1: "ภาพรวม Platform" },
    { name: "organizations", path: "/platform/organizations/", h1: "จัดการหน่วยงาน" },
    { name: "users", path: "/platform/users/", h1: "ผู้ใช้ระดับ Platform" },
  ] as const;
  const captures: Array<Record<string, unknown>> = [];
  const interactions: Array<Record<string, unknown>> = [];
  try {
    for (const view of views) {
      const page = await ctx.newPage();
      const pageErrors: string[] = [];
      page.on("pageerror", error => pageErrors.push(error.message));
      await page.goto(frontend + view.path, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: view.h1, level: 1 })).toBeVisible({ timeout: 20000 });
      const workspaceNav = page.getByRole("navigation", { name: "ส่วนจัดการ Platform" });
      await expect(workspaceNav).toBeVisible();
      const activeLabels = { summary: "ภาพรวมระบบ", organizations: "หน่วยงาน", users: "ผู้ใช้" };
      await expect(workspaceNav.locator('[aria-current="page"]')).toHaveText(activeLabels[view.name]);
      await expect(workspaceNav.getByRole("link")).toHaveCount(2);
      if (view.name === "summary") {
        const nav = page.getByRole("navigation", { name: "งานระดับ Platform" });
        await expect(nav.getByRole("link", { name: /ตรวจสอบหน่วยงานรออนุมัติ/ })).toHaveAttribute("href", "/platform/organizations/");
        await expect(nav.getByRole("link", { name: "ค้นหารายชื่อผู้ใช้" })).toHaveAttribute("href", "/platform/users/");
      } else {
        const id = view.name === "organizations" ? "platform-organizations-search" : "platform-users-search";
        const input = page.locator("#" + id);
        await expect(input).toBeVisible({ timeout: 20000 });
        const filters = page.getByRole("group", { name: view.name === "organizations"
          ? "กรองหน่วยงานตามสถานะที่โหลดแล้ว" : "กรองผู้ใช้ตามสถานะและบทบาทที่โหลดแล้ว" });
        await expect(filters).toBeVisible();
        await input.fill("uxqa-query-not-found-in-any-loaded-entity-20261017");
        await expect(page.getByText("ไม่พบรายการที่ตรงคำค้นหา ลองเปลี่ยนคำหรือกดล้าง")).toBeVisible();
        await input.fill("");
        const filter = filters.getByRole("button", { name: view.name === "organizations" ? /^รออนุมัติ/ : /^Platform Admin/ });
        await filter.click();
        await expect(filter).toHaveAttribute("aria-pressed", "true");
        await filters.getByRole("button", { name: /^ทั้งหมด/ }).click();
        await expect(filters.getByRole("button", { name: /^ทั้งหมด/ })).toHaveAttribute("aria-pressed", "true");
      }

      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      for (const [width, height] of [[320, 700], [390, 844], [768, 1024], [1440, 900]] as const) {
        await page.setViewportSize({ width, height });
        await page.waitForTimeout(100);
        const data = await page.evaluate(() => ({
          heading: document.querySelector("main h1")?.textContent?.trim(),
          overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
          brokenImages: [...document.images].filter(img => img.complete && !img.naturalWidth).length,
          mainActions: document.querySelectorAll("main a[href],main button").length,
          visibleOrgCards: document.querySelectorAll('[aria-label="รายการหน่วยงานทั้งหมด"] > article').length,
          visibleUserRows: document.querySelectorAll('main tbody tr').length,
        }));
        expect(data.heading).toBe(view.h1);
        expect(data.overflow, view.name + " " + width).toBeLessThanOrEqual(1);
        expect(data.brokenImages).toBe(0);
        if (view.name !== "summary") expect(data.mainActions).toBeGreaterThan(0);
        if (view.name === "organizations") expect(data.visibleOrgCards).toBeLessThanOrEqual(24);
        if (view.name === "users") expect(data.visibleUserRows).toBeLessThanOrEqual(24);
        expect(pageErrors).toEqual([]);
        captures.push({ route: view.name, width, ...data, pageErrors: [...pageErrors] });
        await page.screenshot({ path: join(evidenceDir, view.name + "-" + width + ".png"), animations: "disabled" });
      }

      if (view.name === "users") {
        const firstUser = page.locator("main table tbody tr").first();
        await page.setViewportSize({ width: 390, height: 844 });
        await firstUser.scrollIntoViewIfNeeded();
        const cardLayout = await firstUser.evaluate(row => ({
          display: getComputedStyle(row).display,
          cell: getComputedStyle(row.querySelector("td")!).display,
          captionClipped: getComputedStyle(row.closest("table")!.querySelector("caption")!).clipPath,
          overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
        }));
        expect(cardLayout).toMatchObject({ display: "block", cell: "grid", captionClipped: "inset(50%)", overflow: 0 });
        await page.screenshot({ path: join(evidenceDir, "users-directory-390.png"), animations: "disabled" });
      }
      if (view.name === "summary") {
        const nav = page.getByRole("navigation", { name: "ส่วนจัดการ Platform" });
        await nav.getByRole("link", { name: "หน่วยงาน" }).click();
        await expect(page.getByRole("heading", { name: "จัดการหน่วยงาน", level: 1 })).toBeVisible();
        await page.getByRole("navigation", { name: "ส่วนจัดการ Platform" })
          .getByRole("link", { name: "ผู้ใช้" }).click();
        await expect(page.getByRole("heading", { name: "ผู้ใช้ระดับ Platform", level: 1 })).toBeVisible();
      }
      if (view.name === "organizations") {
        await page.setViewportSize({ width: 390, height: 844 });
        const list = page.getByLabel("รายการหน่วยงานทั้งหมด");
        const pending = list.locator("article").filter({ has: page.getByRole("button", { name: "อนุมัติ", exact: true }) }).first();
        if (await pending.count()) {
          const trigger = pending.getByRole("button", { name: "อนุมัติ", exact: true });
          await trigger.click();
          const dlg = page.getByRole("dialog");
          await expect(dlg).toBeVisible({ timeout: 6000 });
          await expect(dlg.getByRole("button", { name: "ยืนยันอนุมัติ" })).toBeVisible();
          await page.screenshot({ path: join(evidenceDir, "organization-approve-modal-390.png"), animations: "disabled" });
          await page.keyboard.press("Escape");
          await expect(dlg).not.toBeVisible();
          await expect(trigger).toBeFocused();
          interactions.push({ name: "approval", result: "PASS (open/Escape/focus restore)" });
        } else interactions.push({ name: "approval", result: "BLOCKED", reason: "NO_LOADED_PENDING_ORGANIZATION" });

        const suspend = list.locator("article").filter({ has: page.getByRole("button", { name: "ระงับหน่วยงาน", exact: true }) }).first();
        if (await suspend.count()) {
          const trigger = suspend.getByRole("button", { name: "ระงับหน่วยงาน", exact: true });
          await trigger.click();
          const dlg = page.getByRole("dialog");
          await expect(dlg).toBeVisible();
          await expect(dlg.getByRole("button", { name: "ยืนยันระงับ" })).toBeVisible();
          await page.screenshot({ path: join(evidenceDir, "organization-suspend-modal-390.png"), animations: "disabled" });
          await page.keyboard.press("Escape");
          await expect(dlg).not.toBeVisible();
          await expect(trigger).toBeFocused();
          interactions.push({ name: "suspend", result: "PASS (open/Escape/focus restore)" });
        } else interactions.push({ name: "suspend", result: "BLOCKED", reason: "NO_ELIGIBLE_LOADED_ORGANIZATION" });
      }
      await page.close();
    }
  } finally {
    await ctx.close();
  }
  await writeFile(join(evidenceDir, "platform-admin-matrix.json"), JSON.stringify({
    routes: views.length, captures, blockedWrites, interactions,
  }, null, 2) + "\n");
  expect(captures).toHaveLength(12);
  expect(blockedWrites).toBe(0);
});

test("Organization Admin cannot read Platform-only directories", async ({ browser, request }) => {
  test.setTimeout(90_000);
  const { frontend } = localAuditTargets();
  const ctx = await browser.newContext();
  await establishSeedRoleSession(ctx, request, "organizationAdmin");
  let writes = 0;
  await ctx.route("**/*", async route => {
    if (!["GET", "HEAD", "OPTIONS"].includes(route.request().method())) {
      writes++;
      await route.abort("blockedbyclient");
    } else await route.continue();
  });
  try {
    for (const route of ["/platform/summary/", "/platform/organizations/", "/platform/users/"]) {
      const page = await ctx.newPage();
      await page.goto(frontend + route, { waitUntil: "domcontentloaded" });
      await expect(page.getByText("ไม่มีสิทธิ์", { exact: false }).first()).toBeVisible({ timeout: 15000 });
      await expect(page.locator("#platform-organizations-search,#platform-users-search")).toHaveCount(0);
      await expect(page.getByRole("navigation", { name: "ส่วนจัดการ Platform" })).toHaveCount(0);
      await page.close();
    }
    expect(writes).toBe(0);
  } finally {
    await ctx.close();
  }
});
