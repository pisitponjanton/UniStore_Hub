import { expect, test } from "./support/qa-fixture";
import {
  createStaffPendingOrderFixture,
} from "./support/staff-operational-fixtures";
import {
  registerDisposableCustomer,
} from "./support/customer-commerce-fixtures";
import {
  createApprovedAdminOrganization,
} from "./support/organization-admin-fixtures";
import {
  establishSeedRoleSession,
  getSeedRoleToken,
} from "./support/seed-auth";

const apiBase = (
  process.env.E2E_API_BASE_URL ?? "http://localhost:4000/api/v1"
).replace(/\/$/, "");

test("real API denies Staff access to another organization's orders, payments and pickups", async ({
  context,
  page,
  request,
}, testInfo) => {
  const isolatedOrganization = await createApprovedAdminOrganization(
    request,
    `tenant-isolation-${Date.now()}-${testInfo.workerIndex}`,
  );
  const staffToken = await getSeedRoleToken(request, "staff");

  for (const resource of ["orders", "payments", "pickups"]) {
    const response = await request.get(
      `${apiBase}/organizations/${isolatedOrganization.organizationId}/${resource}`,
      {
        headers: {
          Authorization: `Bearer ${staffToken}`,
          // Client role assertions must never grant server-side privileges.
          "X-Organization-Role": "ORGANIZATION_ADMIN",
        },
      },
    );
    expect([403, 404], `Staff ${resource} must fail closed`).toContain(
      response.status(),
    );
    const body = (await response.json()) as { success: boolean };
    expect(body.success).toBe(false);
  }

  await establishSeedRoleSession(context, request, "staff");
  await page.goto(
    `/org/orders/?organizationId=${isolatedOrganization.organizationId}`,
  );
  await expect(
    page.getByRole("heading", { name: "ไม่มีสิทธิ์เข้าถึง", level: 1 }),
  ).toBeVisible();
});

test("real API rejects another Customer's order, payment and pickup lookups", async ({
  request,
}, testInfo) => {
  const owned = await createStaffPendingOrderFixture(
    request,
    `tenant-owner-${Date.now()}-${testInfo.workerIndex}`,
  );
  const stranger = await registerDisposableCustomer(
    request,
    `tenant-other-user-${Date.now()}-${testInfo.workerIndex}`,
  );

  const ownResponse = await request.get(
    `${apiBase}/me/orders/${owned.orderId}`,
    { headers: { Authorization: `Bearer ${owned.customerToken}` } },
  );
  expect(ownResponse.status()).toBe(200);

  for (const suffix of ["", "/payment", "/pickup"]) {
    const response = await request.get(
      `${apiBase}/me/orders/${owned.orderId}${suffix}`,
      { headers: { Authorization: `Bearer ${stranger.token}` } },
    );
    expect(response.status(), `Unexpected visibility: ${suffix}`).toBe(404);
    const json = (await response.json()) as {
      success: boolean;
      data?: unknown;
      error?: { code: string; message: string };
    };
    expect(json.success).toBe(false);
    expect(json.data).toBeUndefined();
    expect(json.error?.code).toBe("ORDER_NOT_FOUND");
  }
});
