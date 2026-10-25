import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { establishSeedRoleSession, LOCAL_SEED_ENTITY_IDS as ids } from "../support/seed-auth";
import { localAuditTargets } from "./fixture-guard";

test("live Local organization management confirm dialogs open and cancel without mutations", async ({ browser, request }) => {
  test.setTimeout(140_000);
  const { frontend } = localAuditTargets();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await establishSeedRoleSession(context, request, "organizationAdmin");
  let writes = 0;
  await context.route("**/*", async route => {
    if (!["GET", "HEAD", "OPTIONS"].includes(route.request().method())) {
      writes++;
      await route.abort("blockedbyclient");
      return;
    }
    await route.continue();
  });
  const cases = [
    { name: "staff-remove", path: "/org/staff/", label: "นำออก", modal: "ยืนยันการนำสมาชิกออก" },
    { name: "stores-status", path: "/org/stores/", label: /^(ปิดใช้งาน|เปิดใช้งาน)$/, modal: /^ยืนยันการ(ปิด|เปิด)ใช้งานร้านค้า$/ },
    { name: "products-status", path: "/org/products/", label: "ปิดใช้งาน", modal: "ยืนยันการปิดใช้งานสินค้า" },
  ] as const;
  const evidence = join("test-results", "quality-audit", "uxqa-" + randomUUID(), "organization-dialogs");
  await mkdir(evidence, { recursive: true });
  const results: Array<{ name: string; result: string; reason?: string }> = [];
  try {
    for (const c of cases) {
      const page = await context.newPage();
      const path = c.name === "products-status"
        ? "/org/stores/view/?organizationId=" + encodeURIComponent(ids.organizationId) + "&storeId=" + encodeURIComponent(ids.storeId) + "&tab=products"
        : c.path + "?organizationId=" + encodeURIComponent(ids.organizationId);
      await page.goto(frontend + path, { waitUntil: "domcontentloaded" });
      const search = page.getByRole("searchbox", { name: /ค้นหา(สมาชิก|ร้านค้า|สินค้า)/ });
      await expect(search).toBeVisible({ timeout: 20000 });
      const buttons = page.getByRole("button", { name: c.label, exact: true });
      let trigger = null;
      for (const button of await buttons.all()) {
        if (await button.isEnabled()) { trigger = button; break; }
      }
      if (!trigger) {
        results.push({ name: c.name, result: "BLOCKED", reason: "NO_ELIGIBLE_LOCAL_RECORD" });
        await page.close();
        continue;
      }
      await trigger.click();
      const dialog = page.getByRole("dialog", { name: c.modal });
      await expect(dialog, c.name).toBeVisible({ timeout: 6000 });
      await page.screenshot({ path: join(evidence, c.name + "-390.png"), animations: "disabled" });
      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();
      await expect(trigger).toBeFocused();
      results.push({ name: c.name, result: "PASS" });
      await page.close();
    }
  } finally {
    await context.close();
  }
  await writeFile(join(evidence, "admin-modal-results.json"), JSON.stringify({ results, writes }, null, 2) + "\n");
  expect(writes).toBe(0);
  expect(results).toHaveLength(3);
});
