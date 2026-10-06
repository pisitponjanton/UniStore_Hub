import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  expect,
  test,
  type QaDiagnosticEvent,
} from "./support/qa-fixture";
import {
  establishSeedRoleSession,
  getSeedRoleToken,
  LOCAL_SEED_ENTITY_IDS,
  type SeedRole,
} from "./support/seed-auth";

test.use({ trace: "off", video: "off", screenshot: "off" });

type InventoryRole = "anonymous" | SeedRole;

type RouteCase = {
  route: string;
  role: InventoryRole;
  label: string;
};

type ControlSnapshot = {
  tag: string;
  type: string | null;
  role: string | null;
  name: string;
  href: string | null;
  disabled: boolean;
};

type RouteSnapshot = RouteCase & {
  title: string;
  finalUrl: string;
  controls: ControlSnapshot[];
  diagnostics: QaDiagnosticEvent[];
};

const apiBaseUrl = (
  process.env.E2E_API_BASE_URL ??
  "http://localhost:4000/api/v1"
).replace(/\/$/, "");

async function createPendingOrder(
  request: Parameters<typeof getSeedRoleToken>[0],
): Promise<string> {
  const token = await getSeedRoleToken(request, "customer");
  const response = await request.post(
    `${apiBaseUrl}/organizations/${LOCAL_SEED_ENTITY_IDS.organizationId}/orders`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      data: {
        campaignId: LOCAL_SEED_ENTITY_IDS.campaignId,
        items: [
          {
            productId: LOCAL_SEED_ENTITY_IDS.productId,
            variantId: LOCAL_SEED_ENTITY_IDS.variantId,
            quantity: 1,
          },
        ],
      },
    },
  );

  if (!response.ok()) {
    throw new Error(
      `Unable to create disposable inventory order: ${response.status()} ${await response.text()}`,
    );
  }

  const payload = (await response.json()) as {
    success: true;
    data: { orderId: string };
  };

  return payload.data.orderId;
}

async function cancelPendingOrder(
  request: Parameters<typeof getSeedRoleToken>[0],
  orderId: string,
): Promise<void> {
  const token = await getSeedRoleToken(request, "customer");
  const response = await request.post(
    `${apiBaseUrl}/me/orders/${encodeURIComponent(orderId)}/cancel`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok()) {
    throw new Error(
      `Unable to clean up disposable inventory order: ${response.status()} ${await response.text()}`,
    );
  }
}

async function readControls(page: import("@playwright/test").Page) {
  return page.locator(
    [
      "a[href]",
      "button",
      "input:not([type=hidden])",
      "select",
      "textarea",
      "[role=button]",
      "[role=checkbox]",
      "[role=switch]",
      "[role=tab]",
    ].join(","),
  ).evaluateAll((elements) =>
    elements
      .filter((element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();

        return (
          style.visibility !== "hidden" &&
          style.display !== "none" &&
          rect.width > 0 &&
          rect.height > 0
        );
      })
      .map((element) => {
        const htmlElement = element as HTMLElement;
        const input = element as HTMLInputElement;
        const anchor = element as HTMLAnchorElement;
        const labels =
          "labels" in input && input.labels
            ? Array.from(input.labels)
                .map((label) => label.textContent?.trim() ?? "")
                .filter(Boolean)
                .join(" ")
            : "";
        const name =
          element.getAttribute("aria-label")?.trim() ||
          labels ||
          htmlElement.innerText?.trim().replace(/\s+/g, " ") ||
          element.getAttribute("placeholder")?.trim() ||
          element.getAttribute("name")?.trim() ||
          element.getAttribute("title")?.trim() ||
          "(unnamed)";

        return {
          tag: element.tagName.toLowerCase(),
          type: element.getAttribute("type"),
          role: element.getAttribute("role"),
          name,
          href:
            element.tagName.toLowerCase() === "a"
              ? anchor.getAttribute("href")
              : null,
          disabled:
            "disabled" in input
              ? Boolean(input.disabled)
              : element.getAttribute("aria-disabled") === "true",
        };
      })
      .filter((control) => control.name !== "Open Next.js Dev Tools"),
  );
}

test("inventory every user-facing route and role surface", async ({
  browser,
  request,
}) => {
  test.setTimeout(55_000);
  const orderId = await createPendingOrder(request);
  const {
    organizationId,
    storeId,
    productId,
    variantId,
    campaignId,
  } = LOCAL_SEED_ENTITY_IDS;

  const routes: RouteCase[] = [
    { route: "/", role: "anonymous", label: "Storefront landing" },
    { route: "/login/", role: "anonymous", label: "Login" },
    { route: "/register/", role: "anonymous", label: "Register" },
    {
      route: `/stores/view/?organizationId=${organizationId}&storeId=${storeId}`,
      role: "anonymous",
      label: "Store detail",
    },
    {
      route: `/products/view/?organizationId=${organizationId}&productId=${productId}&campaignId=${campaignId}`,
      role: "anonymous",
      label: "Product detail - anonymous",
    },
    {
      route: `/products/view/?organizationId=${organizationId}&productId=${productId}&campaignId=${campaignId}`,
      role: "customer",
      label: "Product detail - Customer",
    },
    {
      route: `/campaigns/view/?organizationId=${organizationId}&campaignId=${campaignId}`,
      role: "anonymous",
      label: "Campaign detail",
    },
    {
      route: `/orders/new/?organizationId=${organizationId}&campaignId=${campaignId}&productId=${productId}&variantId=${variantId}`,
      role: "customer",
      label: "Create order",
    },
    { route: "/my/orders/", role: "customer", label: "My orders" },
    {
      route: `/my/order/?orderId=${orderId}`,
      role: "customer",
      label: "My order detail",
    },
    {
      route: `/my/payment/?orderId=${orderId}`,
      role: "customer",
      label: "My payment",
    },
    {
      route: `/my/pickup/?orderId=${orderId}`,
      role: "customer",
      label: "My pickup - not ready state",
    },
    {
      route: "/notifications/",
      role: "customer",
      label: "Notifications",
    },
    { route: "/org/select/", role: "organizationAdmin", label: "Organization select" },
    {
      route: `/org/dashboard/?organizationId=${organizationId}`,
      role: "organizationAdmin",
      label: "Organization dashboard",
    },
    {
      route: `/org/settings/?organizationId=${organizationId}`,
      role: "organizationAdmin",
      label: "Organization settings",
    },
    {
      route: `/org/staff/?organizationId=${organizationId}`,
      role: "organizationAdmin",
      label: "Staff management",
    },
    {
      route: `/org/stores/?organizationId=${organizationId}`,
      role: "organizationAdmin",
      label: "Store management",
    },
    {
      route: `/org/products/?organizationId=${organizationId}`,
      role: "organizationAdmin",
      label: "Product management",
    },
    {
      route: `/org/campaigns/?organizationId=${organizationId}`,
      role: "organizationAdmin",
      label: "Campaign management",
    },
    {
      route: `/org/orders/?organizationId=${organizationId}`,
      role: "organizationAdmin",
      label: "Organization orders - Admin",
    },
    {
      route: `/org/orders/?organizationId=${organizationId}`,
      role: "staff",
      label: "Organization orders - Staff",
    },
    {
      route: `/org/orders/view/?organizationId=${organizationId}&orderId=${orderId}`,
      role: "organizationAdmin",
      label: "Organization order detail - Admin",
    },
    {
      route: `/org/orders/view/?organizationId=${organizationId}&orderId=${orderId}`,
      role: "staff",
      label: "Organization order detail - Staff",
    },
    {
      route: `/org/payments/?organizationId=${organizationId}`,
      role: "organizationAdmin",
      label: "Payment review - Admin",
    },
    {
      route: `/org/payments/?organizationId=${organizationId}`,
      role: "staff",
      label: "Payment review - Staff",
    },
    {
      route: `/org/production/?organizationId=${organizationId}&campaignId=${campaignId}`,
      role: "organizationAdmin",
      label: "Production summary",
    },
    {
      route: `/org/pickups/?organizationId=${organizationId}`,
      role: "organizationAdmin",
      label: "Pickup operations - Admin",
    },
    {
      route: `/org/pickups/?organizationId=${organizationId}`,
      role: "staff",
      label: "Pickup operations - Staff",
    },
    {
      route: `/org/audit/?organizationId=${organizationId}`,
      role: "organizationAdmin",
      label: "Audit log",
    },
    {
      route: "/platform/summary/",
      role: "platformAdmin",
      label: "Platform summary",
    },
    {
      route: "/platform/organizations/",
      role: "platformAdmin",
      label: "Platform organizations",
    },
    {
      route: "/platform/users/",
      role: "platformAdmin",
      label: "Platform users",
    },
  ];

  const snapshots: RouteSnapshot[] = [];
  const contexts = new Map<
    InventoryRole,
    Awaited<ReturnType<typeof browser.newContext>>
  >();

  try {
    for (const routeCase of routes) {
      let context = contexts.get(routeCase.role);

      if (!context) {
        context = await browser.newContext();

        if (routeCase.role !== "anonymous") {
          await establishSeedRoleSession(
            context,
            request,
            routeCase.role,
          );
        }

        contexts.set(routeCase.role, context);
      }

      const page = await context.newPage();
      const diagnostics: QaDiagnosticEvent[] = [];

      page.on("console", (message) => {
        if (message.type() === "error") {
          diagnostics.push({
            kind: "console-error",
            message: message.text(),
          });
        }
      });
      page.on("pageerror", (error) => {
        diagnostics.push({
          kind: "page-error",
          message: error.message,
        });
      });
      page.on("requestfailed", (failedRequest) => {
        const errorText =
          failedRequest.failure()?.errorText ?? "unknown request failure";

        diagnostics.push({
          kind:
            errorText === "net::ERR_ABORTED"
              ? "request-aborted"
              : "request-failed",
          method: failedRequest.method(),
          url: failedRequest.url(),
          errorText,
        });
      });
      page.on("response", (response) => {
        if (response.status() >= 400) {
          diagnostics.push({
            kind: "http-error",
            method: response.request().method(),
            url: response.url(),
            status: response.status(),
          });
        }
      });

      await page.goto(routeCase.route, {
        waitUntil: "domcontentloaded",
      });
      await expect(page.locator("body")).toBeVisible();
      await page.waitForTimeout(600);

      snapshots.push({
        ...routeCase,
        title: await page.title(),
        finalUrl: page.url(),
        controls: await readControls(page),
        diagnostics,
      });

      await page.close();
    }
  } finally {
    for (const context of contexts.values()) {
      try {
        await context.close();
      } catch {
        // Inventory cleanup must not prevent disposable order cleanup.
      }
    }

    await cancelPendingOrder(request, orderId);
  }

  await mkdir("test-results", { recursive: true });
  await writeFile(
    join("test-results", "interaction-inventory.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        canonicalUserFacingRouteCount: 28,
        snapshotCount: snapshots.length,
        orderIdUsed: orderId,
        snapshots,
      },
      null,
      2,
    ),
  );

  expect(
    new Set(
      snapshots.map((snapshot) =>
        new URL(snapshot.finalUrl).pathname,
      ),
    ).size,
  ).toBe(28);
});
