import axe from "axe-core";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { establishSeedRoleSession, LOCAL_SEED_ENTITY_IDS as ids } from "../support/seed-auth";
import { localAuditTargets } from "./fixture-guard";
import { writeActionLedger, type ActionOutcome } from "./result-ledger";

type Scenario = "customer-order" | "staff-payment" | "staff-pickup";
const orgRoot = "/api/v1/organizations/" + ids.organizationId;
const at = "2026-10-17T12:00:00.000Z";
const sizes = [[320, 700], [390, 844], [768, 1024], [1440, 900]] as const;

async function exerciseDialog(page: Page, scenario: Scenario) {
  if (scenario === "customer-order") {
    const trigger = page.getByRole("button", { name: "ยกเลิกคำสั่งซื้อ", exact: true });
    await expect(trigger).toBeVisible();
    await trigger.click();
    return {
      trigger,
      dialog: page.getByRole("dialog", { name: "ยืนยันการยกเลิกคำสั่งซื้อ" }),
    };
  }
  if (scenario === "staff-payment") {
    const trigger = page.getByRole("button", { name: "ปฏิเสธการชำระเงิน" });
    await expect(trigger).toBeVisible();
    await trigger.click();
    return {
      trigger,
      dialog: page.getByRole("dialog", { name: "ปฏิเสธการชำระเงิน" }),
    };
  }
  const trigger = page.getByRole("button", { name: "ยืนยันรับสินค้า", exact: true }).first();
  await expect(trigger).toBeVisible();
  await trigger.click();
  return {
    trigger,
    dialog: page.getByRole("dialog", { name: "ยืนยันการรับสินค้า" }),
  };
}

for (const scenario of ["customer-order", "staff-payment", "staff-pickup"] as const) {
  test("multi-role no-write modal accessibility matrix: " + scenario, async ({ browser, request }) => {
    test.setTimeout(210_000);
    const { frontend } = localAuditTargets();
    const runId = "uxqa-" + randomUUID();
    const evidenceRoot = "quality-audit/.evidence/multi-role-modals-20261018";
    const dir = join(evidenceRoot, runId, "multi-role-modals");
    await mkdir(dir, { recursive: true });
    const results: Array<Record<string, unknown>> = [];
    let unexpectedWrites = 0;

    for (const scheme of ["light", "dark"] as const) {
      const ctx = await browser.newContext({
        viewport: { width: 390, height: 844 },
        colorScheme: scheme,
        reducedMotion: "reduce",
      });
      await establishSeedRoleSession(ctx, request, scenario === "customer-order" ? "customer" : "staff");
      await ctx.route("**/*", async route => {
        const req = route.request();
        const pathname = new URL(req.url()).pathname;
        const method = req.method();
        const respond = async (data: unknown) =>
          route.fulfill({ status: 200, contentType: "application/json",
            body: JSON.stringify({ success: true, data }) });
        if (method === "GET" && scenario === "customer-order" && pathname === "/api/v1/me/orders/uxqa-modal-order") {
          return respond({
            orderId: "uxqa-modal-order", organizationId: "uxqa-modal-organization",
            campaignId: "uxqa-modal-campaign", customerId: "uxqa-modal-customer",
            status: "PENDING_PAYMENT", subtotal: 12000, total: 12000,
            items: [{ orderItemId: "uxqa-modal-line", productId: "uxqa-modal-product",
              variantId: "uxqa-modal-variant", productName: "UXQA Item",
              variantName: "One", quantity: 1, unitPrice: 12000, totalPrice: 12000 }],
            createdAt: at, updatedAt: at,
          });
        }
        if (method === "GET" && scenario === "staff-payment" && pathname === orgRoot + "/payments") {
          return respond({ items: [{
            paymentId: "uxqa-modal-payment", organizationId: ids.organizationId,
            orderId: "uxqa-modal-payment-order", customerId: "uxqa-modal-customer",
            status: "PENDING_REVIEW", slipKey: "uxqa/preview", rejectReason: null,
            reviewedBy: null, reviewedAt: null, createdAt: at, updatedAt: at,
          }], nextCursor: null });
        }
        if (method === "GET" && scenario === "staff-payment" && pathname === orgRoot + "/payments/uxqa-modal-payment") {
          return respond({
            paymentId: "uxqa-modal-payment", organizationId: ids.organizationId,
            orderId: "uxqa-modal-payment-order", customerId: "uxqa-modal-customer",
            status: "PENDING_REVIEW", slipKey: "uxqa/preview", rejectReason: null,
            reviewedBy: null, reviewedAt: null, createdAt: at, updatedAt: at,
          });
        }
        if (method === "GET" && scenario === "staff-payment" && pathname === orgRoot + "/orders/uxqa-modal-payment-order") {
          return respond({
            orderId: "uxqa-modal-payment-order", organizationId: ids.organizationId,
            campaignId: "uxqa-modal-campaign", customerId: "uxqa-modal-customer",
            status: "PAYMENT_REVIEW", subtotal: 12000, total: 12000,
            items: [], createdAt: at, updatedAt: at,
          });
        }
        if (method === "GET" && scenario === "staff-pickup" && pathname === orgRoot + "/pickups") {
          return respond({ items: [{
            pickupId: "uxqa-modal-pickup", organizationId: ids.organizationId,
            orderId: "uxqa-modal-pickup-order", token: "UXQATESTTOKEN123456789",
            status: "READY", receivedBy: null, receivedAt: null,
            createdAt: at, updatedAt: at,
          }], nextCursor: null });
        }
        if (method === "GET" && scenario === "staff-pickup" && pathname === orgRoot + "/pickups/uxqa-modal-pickup") {
          return respond({
            pickupId: "uxqa-modal-pickup", organizationId: ids.organizationId,
            orderId: "uxqa-modal-pickup-order", token: "UXQATESTTOKEN123456789",
            status: "READY", receivedBy: null, receivedAt: null,
            createdAt: at, updatedAt: at,
          });
        }
        if (method === "GET" && scenario === "staff-pickup" && pathname === orgRoot + "/orders/uxqa-modal-pickup-order") {
          return respond({
            orderId: "uxqa-modal-pickup-order", organizationId: ids.organizationId,
            campaignId: "uxqa-modal-campaign", customerId: "uxqa-modal-customer",
            status: "READY_FOR_PICKUP", subtotal: 12000, total: 12000,
            items: [], createdAt: at, updatedAt: at,
          });
        }
        if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
          unexpectedWrites++;
          await route.abort("blockedbyclient");
          return;
        }
        return route.continue();
      });

      try {
        const page = await ctx.newPage();
        const url = scenario === "customer-order"
          ? "/my/order/?orderId=uxqa-modal-order"
          : scenario === "staff-payment"
            ? "/org/payments/?organizationId=" + ids.organizationId
            : "/org/pickups/?organizationId=" + ids.organizationId;
        await page.goto(frontend + url, { waitUntil: "domcontentloaded" });
        if (scenario === "staff-payment") {
          await page.getByRole("button", { name: "ตรวจสอบ การชำระเงิน uxqa-modal-payment" }).click();
          await expect(page.getByLabel("รายละเอียดการชำระเงิน")).toBeVisible();
        } else if (scenario === "staff-pickup") {
          const item = page.getByRole("article", { name: /Pickup uxqa-modal-pickup/ });
          await expect(item).toBeVisible();
          await item.getByRole("button", { name: /ดูรายละเอียด Pickup uxqa-modal-pickup/ }).click();
          await expect(page.getByRole("complementary", { name: "รายละเอียด Pickup" })).toBeVisible();
        }

        await page.addScriptTag({ content: axe.source });
        for (const [width, height] of sizes) {
          await page.setViewportSize({ width, height });
          const { trigger, dialog } = await exerciseDialog(page, scenario);
          await expect(dialog).toBeVisible();
          await expect(dialog).toHaveAttribute("aria-modal", "true");
          await expect.poll(() => page.evaluate(() =>
            Boolean(document.querySelector('[role="dialog"]')?.contains(document.activeElement))
          )).toBe(true);

          const focusWithin: boolean[] = [];
          for (let n = 0; n < 10; n++) {
            await page.keyboard.press(n % 2 === 0 ? "Tab" : "Shift+Tab");
            focusWithin.push(await page.evaluate(() =>
              Boolean(document.querySelector('[role="dialog"]')?.contains(document.activeElement))
            ));
          }
          const geometry = await dialog.evaluate(element => {
            const rect = element.getBoundingClientRect();
            return {
              left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
              width: window.innerWidth, height: window.innerHeight,
              contentOverflow: element.scrollHeight > element.clientHeight,
              scrollable: getComputedStyle(element).overflowY,
            };
          });
          const violations = await page.evaluate(async () => {
            const a = (window as unknown as { axe: typeof axe }).axe;
            const result = await a.run(document.querySelector('[role="dialog"]')!, {
              runOnly: { type: "rule",
                values: ["aria-dialog-name", "aria-required-attr", "button-name", "color-contrast"] },
            });
            return result.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) }));
          });
          await page.screenshot({
            path: join(dir, scenario + "-" + scheme + "-" + width + ".png"),
            animations: "disabled",
          });
          expect(focusWithin.every(Boolean), scenario + " focus trap " + scheme + " " + width).toBe(true);
          expect(geometry.left, "dialog left " + scenario).toBeGreaterThanOrEqual(-2);
          expect(geometry.right, "dialog right " + scenario).toBeLessThanOrEqual(width + 2);
          expect(geometry.top, "dialog top " + scenario).toBeGreaterThanOrEqual(-2);
          expect(geometry.bottom, "dialog bottom " + scenario).toBeLessThanOrEqual(height + 2);
          expect(violations, "axe dialog " + scenario + " " + scheme + " " + width).toEqual([]);
          await page.keyboard.press("Escape");
          await expect(dialog).not.toBeVisible();
          await expect(trigger).toBeFocused();
          results.push({ scenario, scheme, width, height,
            focusWithin, geometry, violations, status: "PASS" });
        }
        await page.close();
      } finally {
        await ctx.close();
      }
    }
    expect(unexpectedWrites).toBe(0);
    expect(results).toHaveLength(8);
    await writeFile(join(dir, scenario + "-dialog-matrix.json"),
      JSON.stringify({ scenario, results, unexpectedWrites,
        limitation: "GET-only synthetic fixtures; no confirm POST or actual business mutation was executed" }, null, 2) + "\n");

    // Evidence is scoped to real interactions under a nonmutating synthetic GET fixture.
    // The full source-declared action matrix deliberately remains NOT_TESTED.
    const baseline = JSON.parse(await readFile("quality-audit/coverage-baseline.json", "utf8")) as {
      actions: Array<{ id: string; roles: string[]; statesToTest: string[] }>;
      shellActions: Array<{ id: string; roles: string[]; statesToTest: string[] }>;
    };
    const entries: ActionOutcome[] = [...baseline.actions, ...baseline.shellActions].map(a => ({
      actionId: a.id, role: a.roles[0]!, state: "all-declared-states", viewport: "not-executed",
      status: "NOT_TESTED", testRunId: runId, evidence: [],
      notes: "Exhaustive combinations not yet verified: " + a.statesToTest.join(", "),
    }));
    const actionId = scenario === "customer-order" ? "FE-UX-09-05"
      : scenario === "staff-payment" ? "FE-UX-22-12" : "FE-UX-24-09";
    const role = scenario === "customer-order" ? "customer" : "staff";
    for (const outcome of results) {
      const scheme = String(outcome.scheme);
      const width = Number(outcome.width);
      entries.push({
        actionId, role, state: "modal-" + scheme + "-" + width + "-escape-focus-a11y",
        viewport: width + "x" + Number(outcome.height), status: "PASS", testRunId: runId,
        evidence: ["multi-role-modals/" + scenario + "-" + scheme + "-" + width + ".png"],
        notes: "Direct open, focus trap, keyboard Escape/return, geometry, aria-modal and scoped axe rules. No confirm submitted.",
      });
    }
    await writeActionLedger(runId, entries, evidenceRoot);
  });
}
