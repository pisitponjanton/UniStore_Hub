import type {
  APIRequestContext,
  BrowserContext,
} from "@playwright/test";

import {
  getSeedRoleToken,
  LOCAL_SEED_ENTITY_IDS,
  LOCAL_SEED_USERS,
} from "./seed-auth";

const apiBaseUrl = (
  process.env.E2E_API_BASE_URL ??
  "http://localhost:4000/api/v1"
).replace(/\/$/, "");

export const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZKxkAAAAASUVORK5CYII=",
  "base64",
);

type ApiOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  token?: string;
  data?: unknown;
  expectedStatus?: number;
};

export async function apiJson<T = unknown>(
  request: APIRequestContext,
  path: string,
  {
    method = "GET",
    token,
    data,
    expectedStatus,
  }: ApiOptions = {},
): Promise<T> {
  const response = await request.fetch(
    `${apiBaseUrl}${path}`,
    {
      method,
      headers: {
        Accept: "application/json",
        ...(token
          ? { Authorization: `Bearer ${token}` }
          : {}),
      },
      ...(data === undefined ? {} : { data }),
    },
  );

  const raw = await response.text();

  if (
    expectedStatus !== undefined &&
    response.status() !== expectedStatus
  ) {
    throw new Error(
      `${method} ${path} expected ${expectedStatus}, got ${response.status()}: ${raw}`,
    );
  }

  if (
    expectedStatus === undefined &&
    !response.ok()
  ) {
    throw new Error(
      `${method} ${path} failed with ${response.status()}: ${raw}`,
    );
  }

  if (response.status() === 204 || raw.length === 0) {
    return undefined as T;
  }

  const payload = JSON.parse(raw) as {
    success: boolean;
    data: T;
  };

  if (!payload.success) {
    throw new Error(
      `${method} ${path} returned an unsuccessful envelope: ${raw}`,
    );
  }

  return payload.data;
}

export async function establishTokenSession(
  context: BrowserContext,
  token: string,
): Promise<void> {
  await context.addInitScript(
    ({ value }) => {
      window.sessionStorage.setItem(
        "unistoreHub.accessToken",
        value,
      );
      window.sessionStorage.removeItem(
        "unistoreHub.activeOrganizationId",
      );
    },
    { value: token },
  );
}

export async function registerDisposableCustomer(
  request: APIRequestContext,
  runId: string,
): Promise<{ email: string; token: string }> {
  const email =
    `qa-commerce-${runId}@local.unistore.test`;
  const password = "qa-customer-commerce";

  const registered = await apiJson<{ token: string }>(
    request,
    "/auth/register",
    {
      method: "POST",
      data: {
        email,
        password,
        name: `QA Commerce ${runId}`,
      },
      expectedStatus: 201,
    },
  );

  return {
    email,
    token: registered.token,
  };
}

export async function createSeedPendingOrder(
  request: APIRequestContext,
  quantity = 1,
): Promise<{ orderId: string }> {
  const customerToken = await getSeedRoleToken(
    request,
    "customer",
  );

  return apiJson<{ orderId: string }>(
    request,
    `/organizations/${LOCAL_SEED_ENTITY_IDS.organizationId}/orders`,
    {
      method: "POST",
      token: customerToken,
      data: {
        campaignId: LOCAL_SEED_ENTITY_IDS.campaignId,
        items: [
          {
            productId: LOCAL_SEED_ENTITY_IDS.productId,
            variantId: LOCAL_SEED_ENTITY_IDS.variantId,
            quantity,
          },
        ],
      },
      expectedStatus: 201,
    },
  );
}

export async function createReadyForPickupFixture(
  request: APIRequestContext,
  runId: string,
): Promise<{
  organizationId: string;
  orderId: string;
  pickupId: string;
  pickupToken: string;
  notificationId: string;
  notificationTitle: string;
}> {
  const [
    platformToken,
    adminToken,
    staffToken,
    customerToken,
  ] = await Promise.all([
    getSeedRoleToken(request, "platformAdmin"),
    getSeedRoleToken(request, "organizationAdmin"),
    getSeedRoleToken(request, "staff"),
    getSeedRoleToken(request, "customer"),
  ]);

  const existingUnread = await apiJson<{
    items: Array<{
      notificationId: string;
      type: string;
    }>;
  }>(
    request,
    "/notifications?read=false",
    { token: customerToken },
  );

  for (const notification of existingUnread.items) {
    if (notification.type === "READY_FOR_PICKUP") {
      await apiJson(
        request,
        `/notifications/${notification.notificationId}/read`,
        {
          method: "PATCH",
          token: customerToken,
          expectedStatus: 200,
        },
      );
    }
  }

  const baselineNotifications = await apiJson<{
    items: Array<{ notificationId: string }>;
  }>(
    request,
    "/notifications?read=false",
    { token: customerToken },
  );
  const baselineIds = new Set(
    baselineNotifications.items.map(
      (item) => item.notificationId,
    ),
  );

  const organization = await apiJson<{
    organizationId: string;
    status: string;
  }>(
    request,
    "/organizations",
    {
      method: "POST",
      token: adminToken,
      data: {
        name: `QA Commerce Org ${runId}`,
        description:
          "Disposable frontend Customer commerce fixture",
      },
      expectedStatus: 201,
    },
  );

  if (organization.status === "PENDING") {
    await apiJson(
      request,
      `/platform/organizations/${organization.organizationId}/approve`,
      {
        method: "POST",
        token: platformToken,
        expectedStatus: 200,
      },
    );
  }

  await apiJson(
    request,
    `/organizations/${organization.organizationId}/members`,
    {
      method: "POST",
      token: adminToken,
      data: {
        email: LOCAL_SEED_USERS.staff,
        role: "STAFF",
      },
      expectedStatus: 201,
    },
  );

  const store = await apiJson<{ storeId: string }>(
    request,
    `/organizations/${organization.organizationId}/stores`,
    {
      method: "POST",
      token: adminToken,
      data: {
        name: `QA Commerce Store ${runId}`,
        description:
          "Disposable frontend Customer commerce Store",
      },
      expectedStatus: 201,
    },
  );

  const product = await apiJson<{ productId: string }>(
    request,
    `/organizations/${organization.organizationId}/products`,
    {
      method: "POST",
      token: adminToken,
      data: {
        storeId: store.storeId,
        name: `QA Commerce Product ${runId}`,
        description:
          "Disposable frontend Customer commerce Product",
      },
      expectedStatus: 201,
    },
  );

  const variant = await apiJson<{ variantId: string }>(
    request,
    `/organizations/${organization.organizationId}/products/${product.productId}/variants`,
    {
      method: "POST",
      token: adminToken,
      data: {
        name: "Pickup fixture",
        price: 12345,
      },
      expectedStatus: 201,
    },
  );

  const campaign = await apiJson<{ campaignId: string }>(
    request,
    `/organizations/${organization.organizationId}/campaigns`,
    {
      method: "POST",
      token: adminToken,
      data: {
        storeId: store.storeId,
        name: `QA Commerce Campaign ${runId}`,
        openAt: "2030-02-01T00:00:00.000Z",
        closeAt: "2030-02-10T23:59:59.000Z",
        paymentDeadline: "2030-02-11T23:59:59.000Z",
        pickupAt: "2030-02-25T09:00:00.000Z",
      },
      expectedStatus: 201,
    },
  );

  await apiJson(
    request,
    `/organizations/${organization.organizationId}/campaigns/${campaign.campaignId}/open`,
    {
      method: "POST",
      token: adminToken,
      expectedStatus: 200,
    },
  );

  const order = await apiJson<{
    orderId: string;
    status: string;
  }>(
    request,
    `/organizations/${organization.organizationId}/orders`,
    {
      method: "POST",
      token: customerToken,
      data: {
        campaignId: campaign.campaignId,
        items: [
          {
            productId: product.productId,
            variantId: variant.variantId,
            quantity: 1,
          },
        ],
      },
      expectedStatus: 201,
    },
  );

  const upload = await apiJson<{
    url: string;
    objectKey: string;
  }>(
    request,
    `/organizations/${organization.organizationId}/orders/${order.orderId}/payment-slip-upload-url`,
    {
      method: "POST",
      token: customerToken,
      data: { contentType: "image/png" },
      expectedStatus: 200,
    },
  );

  const uploadResponse = await request.put(upload.url, {
    headers: {
      "Content-Type": "image/png",
    },
    data: tinyPng,
  });

  if (!uploadResponse.ok()) {
    throw new Error(
      `Fixture Payment upload failed: ${uploadResponse.status()} ${await uploadResponse.text()}`,
    );
  }

  const payment = await apiJson<{
    paymentId: string;
  }>(
    request,
    `/organizations/${organization.organizationId}/orders/${order.orderId}/payment`,
    {
      method: "POST",
      token: customerToken,
      data: { slipKey: upload.objectKey },
      expectedStatus: 201,
    },
  );

  await apiJson(
    request,
    `/organizations/${organization.organizationId}/payments/${payment.paymentId}/approve`,
    {
      method: "POST",
      token: staffToken,
      expectedStatus: 200,
    },
  );

  await apiJson(
    request,
    `/organizations/${organization.organizationId}/campaigns/${campaign.campaignId}/close`,
    {
      method: "POST",
      token: adminToken,
      expectedStatus: 200,
    },
  );
  await apiJson(
    request,
    `/organizations/${organization.organizationId}/campaigns/${campaign.campaignId}/start-production`,
    {
      method: "POST",
      token: adminToken,
      expectedStatus: 200,
    },
  );
  await apiJson(
    request,
    `/organizations/${organization.organizationId}/campaigns/${campaign.campaignId}/ready-for-pickup`,
    {
      method: "POST",
      token: adminToken,
      expectedStatus: 200,
    },
  );

  const pickup = await apiJson<{
    pickupId: string;
    token: string;
    status: string;
  }>(
    request,
    `/me/orders/${order.orderId}/pickup`,
    {
      token: customerToken,
      expectedStatus: 200,
    },
  );

  let notificationId = "";
  let notificationTitle = "";
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const notifications = await apiJson<{
      items: Array<{
        notificationId: string;
        type: string;
        title: string;
      }>;
    }>(
      request,
      "/notifications?read=false",
      { token: customerToken },
    );

    const ready = notifications.items.find(
      (item) =>
        !baselineIds.has(item.notificationId) &&
        item.type === "READY_FOR_PICKUP",
    );

    if (ready) {
      notificationId = ready.notificationId;
      notificationTitle = ready.title;
      break;
    }

    await new Promise((resolve) =>
      setTimeout(resolve, 250),
    );
  }

  if (!notificationId || !notificationTitle) {
    throw new Error(
      "READY_FOR_PICKUP notification did not arrive for Customer fixture.",
    );
  }

  return {
    organizationId: organization.organizationId,
    orderId: order.orderId,
    pickupId: pickup.pickupId,
    pickupToken: pickup.token,
    notificationId,
    notificationTitle,
  };
}
