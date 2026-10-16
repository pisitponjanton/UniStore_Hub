import axe from "axe-core";
import { expect, test } from "./support/qa-fixture";
import {
  apiJson,
  establishTokenSession,
} from "./support/customer-commerce-fixtures";
import { createStaffPendingOrderFixture } from "./support/staff-operational-fixtures";
import {
  establishSeedRoleSession,
  LOCAL_SEED_ENTITY_IDS as ids,
  type SeedRole,
} from "./support/seed-auth";

test.use({ trace: "off", video: "off", screenshot: "only-on-failure" });

const viewports = [
  [320, 568],
  [360, 800],
  [375, 667],
  [390, 844],
  [430, 932],
  [768, 1024],
  [820, 1180],
  [1024, 768],
  [1280, 800],
  [1440, 900],
  [1920, 1080],
] as const;

type MatrixGroup =
  | "guest"
  | "customer"
  | "staff"
  | "organization-a"
  | "organization-b-ops"
  | "organization-b-audit"
  | "platform-summary"
  | "platform-organizations"
  | "platform-users";
type MatrixRoute = { path: string; label: string };
type MatrixRecord = {
  group: MatrixGroup;
  path: string;
  viewport: string;
  heading: string;
  documentOverflow: number;
  controlsClipped: string[];
  nestedOverflow: string[];
  headingsClipped: string[];
  unnamedInputs: string[];
  tabFocus: string | null;
};

function routesFor(group: MatrixGroup, orderId?: string): MatrixRoute[] {
  const organization = `organizationId=${ids.organizationId}`;
  const order = `orderId=${orderId}`;
  switch (group) {
    case "guest":
      return [
        { path: "/", label: "Landing" },
        { path: "/login/", label: "Login" },
        { path: "/register/", label: "Register" },
        { path: `/stores/view/?${organization}&storeId=${ids.storeId}`, label: "Store" },
        { path: `/campaigns/view/?${organization}&campaignId=${ids.campaignId}`, label: "Campaign" },
        { path: `/products/view/?${organization}&productId=${ids.productId}&campaignId=${ids.campaignId}`, label: "Product" },
      ];
    case "customer":
      if (!orderId) throw new Error("Customer matrix requires disposable Order");
      return [
        { path: `/orders/new/?${organization}&campaignId=${ids.campaignId}&productId=${ids.productId}&variantId=${ids.variantId}`, label: "Checkout" },
        { path: "/my/orders/", label: "My orders" },
        { path: `/my/order/?${order}`, label: "Order detail" },
        { path: `/my/payment/?${order}`, label: "Payment" },
        { path: `/my/pickup/?${order}`, label: "Pickup not ready" },
        { path: "/notifications/", label: "Notifications" },
      ];
    case "staff":
      if (!orderId) throw new Error("Staff matrix requires disposable Order");
      return [
        { path: "/org/select/", label: "Staff organization selector" },
        { path: `/org/orders/?${organization}`, label: "Staff Orders" },
        { path: `/org/orders/view/?${organization}&${order}`, label: "Staff Order detail" },
        { path: `/org/payments/?${organization}`, label: "Staff Payments" },
        { path: `/org/pickups/?${organization}`, label: "Staff Pickups" },
      ];
    case "organization-a":
      if (!orderId) throw new Error("Org Admin matrix requires disposable Order");
      return [
        { path: "/org/select/", label: "Org selector" },
        { path: `/org/dashboard/?${organization}`, label: "Dashboard" },
        { path: `/org/settings/?${organization}`, label: "Settings" },
        { path: `/org/staff/?${organization}`, label: "Members" },
        { path: `/org/stores/?${organization}`, label: "Stores" },
        { path: `/org/products/?${organization}`, label: "Products" },
        { path: `/org/campaigns/?${organization}`, label: "Campaigns" },
      ];
    case "organization-b-ops":
      if (!orderId) throw new Error("Org Admin matrix requires disposable Order");
      return [
        { path: `/org/orders/?${organization}`, label: "Orders" },
        { path: `/org/orders/view/?${organization}&${order}`, label: "Order detail" },
        { path: `/org/payments/?${organization}`, label: "Payments" },
        { path: `/org/pickups/?${organization}`, label: "Pickups" },
        { path: `/org/production/?${organization}&campaignId=${ids.campaignId}`, label: "Production" },
      ];
    case "organization-b-audit":
      return [
        { path: `/org/audit/?${organization}`, label: "Audit" },
      ];
    case "platform-summary":
      return [{ path: "/platform/summary/", label: "Platform summary" }];
    case "platform-organizations":
      return [{ path: "/platform/organizations/", label: "Organizations" }];
    case "platform-users":
      return [{ path: "/platform/users/", label: "Users" }];
  }
}

for (const group of [
  "guest",
  "customer",
  "staff",
  "organization-a",
  "organization-b-ops",
  "organization-b-audit",
  "platform-summary",
  "platform-organizations",
  "platform-users",
] as const) {
  test(`role-aware responsive matrix ${group}: all 11 viewport pairs`, async ({
    browser,
    request,
  }, testInfo) => {
    test.setTimeout(115_000);
    let order: Awaited<ReturnType<typeof createStaffPendingOrderFixture>> | null = null;
    const context = await browser.newContext();
    const matrix: MatrixRecord[] = [];
    const diagnostics: Array<{ path: string; message: string; type: string }> = [];
    const axeFindings: Array<{
      path: string;
      viewport: string;
      violations: Array<{ id: string; impact: string | null; elements: string[][] }>;
    }> = [];
    let activeRoute = "";
    try {
      if (group === "customer" || group === "staff" || group.startsWith("organization")) {
        order = await createStaffPendingOrderFixture(
          request,
          `matrix-${group}-${Date.now()}-${testInfo.workerIndex}`,
        );
      }
      if (group === "customer" && order) {
        await establishTokenSession(context, order.customerToken);
      } else if (group !== "guest") {
        const role: SeedRole = group.startsWith("organization")
          ? "organizationAdmin"
          : group.startsWith("platform")
            ? "platformAdmin"
            : group === "staff"
              ? "staff"
              : "customer";
        await establishSeedRoleSession(context, request, role);
      }

      const page = await context.newPage();
      page.on("pageerror", (error) => {
        diagnostics.push({ path: activeRoute, type: "pageerror", message: error.message });
      });
      page.on("console", (message) => {
        if (message.type() === "error") {
          diagnostics.push({ path: activeRoute, type: "console", message: message.text() });
        }
      });
      page.on("response", (response) => {
        if (response.status() >= 500) {
          diagnostics.push({
            path: activeRoute,
            type: "http",
            message: `${response.status()} ${new URL(response.url()).pathname}`,
          });
        }
      });
      for (const route of routesFor(group, order?.orderId)) {
        activeRoute = route.path;
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto(route.path, { waitUntil: "domcontentloaded" });
        const routeMain = page.locator("main").first();
        await expect(routeMain).toBeVisible({ timeout: 20_000 });
        // Check a real page heading rather than shared navigation or shell text.
        const routeHeading = routeMain.getByRole("heading", { level: 1 }).first();
        await expect(routeHeading).toBeVisible({ timeout: 20_000 });
        if (group === "guest") {
          await expect(routeHeading).not.toContainText(/^(กำลังโหลด|กำลังตรวจสอบบัญชี|loading)/i, {
            timeout: 20_000,
          });
        }
        // The existing apps use async data fetching. Settle before matrix reads;
        // each viewport thereafter reuses the rendered route and role session.
        await page.waitForTimeout(320);
        await page.evaluate(axe.source);
        for (const [width, height] of viewports) {
          await page.setViewportSize({ width, height });
          const measurements = await page.evaluate(() => {
            const viewportWidth = document.documentElement.clientWidth;
            const allElements = Array.from(document.querySelectorAll<HTMLElement>("*"));
            const usable = (e: HTMLElement) => {
              const style = getComputedStyle(e);
              const b = e.getBoundingClientRect();
              if (style.display === "none" || style.visibility !== "visible") return false;
              if (b.width < 1 || b.height < 1) return false;
              if (e.closest('[aria-hidden="true"],[inert]')) return false;
              const drawer = e.closest("#application-navigation");
              // The mobile drawer is intentionally translated offscreen while
              // closed. Its CSS visibility transition can lag resize by a
              // frame; it is not a clipped interactive control.
              if (drawer && getComputedStyle(drawer).position === "fixed" &&
                  drawer.getAttribute("role") !== "dialog") return false;
              // Offscreen vertical content is valid; horizontal clipping is not.
              return b.bottom > 0 && b.top < innerHeight;
            };
            const clipped = (e: HTMLElement) => {
              const b = e.getBoundingClientRect();
              return b.left < -1 || b.right > viewportWidth + 1;
            };
            const label = (e: HTMLElement) =>
              (e.getAttribute("aria-label") ||
                e.getAttribute("title") ||
                e.getAttribute("id") ||
                (e.textContent ?? "").trim().slice(0, 32) ||
                e.tagName).slice(0, 80);
            const formControls = allElements.filter((e) =>
              e.matches("a[href],button,input:not([type=hidden]),select,textarea,[role=button]"),
            );
            const headings = allElements.filter(e => e.matches("h1,h2,h3"));
            const nested = allElements.filter((e) => {
              if (e === document.body || e === document.documentElement) return false;
              if (!usable(e) || e.clientWidth < 30) return false;
              if (e.scrollWidth <= e.clientWidth + 2) return false;
              const style = getComputedStyle(e);
              if (["auto", "scroll", "hidden", "clip"].includes(style.overflowX)) return false;
              // A wide table is valid inside a focusable, horizontally
              // scrollable table frame; the table itself must not be flagged.
              let ancestor = e.parentElement;
              while (ancestor) {
                const x = getComputedStyle(ancestor).overflowX;
                if (["auto", "scroll"].includes(x) &&
                    ancestor.scrollWidth > ancestor.clientWidth + 2) {
                  return false;
                }
                ancestor = ancestor.parentElement;
              }
              return true;
            });
            return {
              heading: document.querySelector("h1")?.textContent?.trim().slice(0, 96) ?? "",
              documentOverflow: Math.max(
                document.documentElement.scrollWidth, document.body.scrollWidth,
              ) - viewportWidth,
              controlsClipped: formControls.filter(e => usable(e) && clipped(e)).map(label).slice(0, 7),
              nestedOverflow: nested.map(label).slice(0, 7),
              headingsClipped: headings.filter(e => usable(e) && clipped(e)).map(label).slice(0, 7),
              unnamedInputs: formControls.filter(e => {
                if (!usable(e) || !e.matches("input,select,textarea")) return false;
                const ctrl = e as HTMLInputElement;
                return !e.getAttribute("aria-label") &&
                  !e.getAttribute("aria-labelledby") &&
                  !e.getAttribute("title") &&
                  !(ctrl.labels && ctrl.labels.length);
              }).map(label).slice(0, 7),
            };
          });
          matrix.push({
            group, path: route.path, viewport: `${width}x${height}`,
            ...measurements, tabFocus: null,
          });
          // Sample WCAG A/AA semantics on mobile and desktop for EVERY
          // authorized route. This is automated evidence, not a screen-reader
          // user test or a complete WCAG conformance claim.
          if (width === 390 || width === 1440) {
            const violations = await page.evaluate(async (boundedAudit) => {
              const engine = (window as unknown as {
                axe: {
                  run: (root: Document | object, config: object) => Promise<{
                    violations: Array<{
                      id: string;
                      impact: string | null;
                      nodes: Array<{ target: string[] }>;
                    }>;
                  }>;
                };
              }).axe;
              // On large, accumulated Audit and Platform User tables, inspect
              // the page chrome,
              // filters and first three records. Other records share table markup;
              // exclude the remainder so axe doesn't stall on old E2E fixtures.
              const scope = boundedAudit
                ? { exclude: [["tbody tr:nth-child(n+4)"]] }
                : document;
              const result = await engine.run(scope, {
                runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
              });
              return result.violations.map(v => ({
                id: v.id,
                impact: v.impact,
                elements: v.nodes.map(n => n.target).slice(0, 8),
              }));
            }, group === "organization-b-audit" || group === "platform-users");
            if (violations.length) {
              axeFindings.push({
                path: route.path, viewport: `${width}x${height}`, violations,
              });
            }
          }
          // Navigate with the keyboard in both compact and desktop modes.
          if (width === 390 || width === 1440) {
            await page.keyboard.press("Tab");
            const focused = await page.evaluate(() => {
              const el = document.activeElement as HTMLElement | null;
              if (!el || el === document.body) return null;
              return el.getAttribute("aria-label") || el.tagName + ":" + (el.textContent ?? "").trim().slice(0, 30);
            });
            matrix[matrix.length - 1].tabFocus = focused;
          }
        }
      }
    } finally {
      await context.close();
      if (order) {
        try {
          await apiJson(request, `/me/orders/${order.orderId}/cancel`, {
            method: "POST", token: order.customerToken, expectedStatus: 200,
          });
        } catch (error) {
          diagnostics.push({
            path: "cleanup", type: "cleanup",
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    await testInfo.attach(`responsive-matrix-${group}.json`, {
      body: Buffer.from(JSON.stringify({ group, viewports, matrix, diagnostics, axeFindings }, null, 2)),
      contentType: "application/json",
    });

    const failures = matrix.filter(r =>
      r.documentOverflow > 1 ||
      r.controlsClipped.length > 0 ||
      r.headingsClipped.length > 0 ||
      r.unnamedInputs.length > 0,
    );
    // For a newly created PENDING_PAYMENT order, GET /payment is expected
    // to return 404 until proof is uploaded; the UI presents the upload form.
    const unexpectedErrors = diagnostics.filter(d =>
      !(group === "customer" && d.path.startsWith("/my/payment/") &&
        d.type === "console" && d.message.includes("404")),
    );
    const paths = new Set(matrix.map(r => r.path));
    console.log(
      `MATRIX_RESULT ${group}: routes=${paths.size} viewports=${matrix.length} failedMeasurements=${failures.length} nestedOverflow=${matrix.filter(x => x.nestedOverflow.length).length} diagnosticEvents=${diagnostics.length}`,
    );
    if (failures.length) {
      console.log("MATRIX_FINDINGS", JSON.stringify(failures.slice(0, 12)));
    }
    const nestedFindings = matrix.filter(x => x.nestedOverflow.length);
    if (nestedFindings.length) {
      console.log("MATRIX_NESTED", JSON.stringify(nestedFindings.slice(0, 6).map(
        x => ({ path: x.path, viewport: x.viewport, nested: x.nestedOverflow }),
      )));
    }
    if (unexpectedErrors.length) {
      console.log("MATRIX_DIAGNOSTICS", JSON.stringify(unexpectedErrors.slice(0, 12)));
    }
    if (axeFindings.length) {
      console.log("MATRIX_AXE", JSON.stringify(axeFindings.slice(0, 8)));
    }
    expect(matrix).toHaveLength(routesFor(group, order?.orderId).length * viewports.length);
    expect(failures.length, `Visible UI clipped in ${group}`).toBe(0);
    expect(unexpectedErrors.length, `Unexpected page/API/cleanup errors in ${group}`).toBe(0);
    expect(axeFindings.length, `Automated WCAG A/AA violations in ${group}`).toBe(0);
  });
}
