import type { APIRequestContext } from "@playwright/test";

import {
  apiJson,
  registerDisposableCustomer,
  tinyPng,
} from "./customer-commerce-fixtures";
import { LOCAL_SEED_ENTITY_IDS } from "./seed-auth";

export interface StaffOrderFixture {
  customerId: string;
  customerToken: string;
  orderId: string;
}

export interface StaffPaymentReviewFixture
  extends StaffOrderFixture {
  paymentId: string;
}

export async function createStaffPendingOrderFixture(
  request: APIRequestContext,
  runId: string,
): Promise<StaffOrderFixture> {
  const customer = await registerDisposableCustomer(
    request,
    `staff-${runId}`,
  );

  const me = await apiJson<{
    user: { userId: string };
  }>(request, "/me", {
    token: customer.token,
    expectedStatus: 200,
  });

  const order = await apiJson<{
    orderId: string;
  }>(
    request,
    `/organizations/${LOCAL_SEED_ENTITY_IDS.organizationId}/orders`,
    {
      method: "POST",
      token: customer.token,
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
      expectedStatus: 201,
    },
  );

  return {
    customerId: me.user.userId,
    customerToken: customer.token,
    orderId: order.orderId,
  };
}

export async function createStaffPaymentReviewFixture(
  request: APIRequestContext,
  runId: string,
): Promise<StaffPaymentReviewFixture> {
  const order = await createStaffPendingOrderFixture(
    request,
    runId,
  );

  const upload = await apiJson<{
    url: string;
    objectKey: string;
  }>(
    request,
    `/organizations/${LOCAL_SEED_ENTITY_IDS.organizationId}/orders/${order.orderId}/payment-slip-upload-url`,
    {
      method: "POST",
      token: order.customerToken,
      data: { contentType: "image/png" },
      expectedStatus: 200,
    },
  );

  const put = await request.put(upload.url, {
    headers: { "Content-Type": "image/png" },
    data: tinyPng,
  });

  if (!put.ok()) {
    throw new Error(
      `Staff fixture Payment upload failed: ${put.status()} ${await put.text()}`,
    );
  }

  const payment = await apiJson<{
    paymentId: string;
  }>(
    request,
    `/organizations/${LOCAL_SEED_ENTITY_IDS.organizationId}/orders/${order.orderId}/payment`,
    {
      method: "POST",
      token: order.customerToken,
      data: { slipKey: upload.objectKey },
      expectedStatus: 201,
    },
  );

  return {
    ...order,
    paymentId: payment.paymentId,
  };
}
