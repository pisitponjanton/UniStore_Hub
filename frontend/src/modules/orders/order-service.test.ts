import { describe, expect, it } from "vitest";

import type { ApiListData, OrderDTO } from "@/types";

import {
  createOrderService,
  type CreateOrderRequest,
  type OrderClient,
} from "./order-service";

const createdOrder: OrderDTO = {
  orderId: "order-1",
  organizationId: "org 1",
  campaignId: "campaign-1",
  customerId: "user-1",
  status: "PENDING_PAYMENT",
  subtotal: 50000,
  total: 50000,
  items: [
    {
      orderItemId: "item-1",
      productId: "product-1",
      variantId: "variant-1",
      productName: "Faculty Shirt",
      variantName: "Size M",
      unitPrice: 25000,
      quantity: 2,
      totalPrice: 50000,
    },
  ],
  createdAt: "2026-09-29T15:00:00.000Z",
  updatedAt: "2026-09-29T15:00:00.000Z",
};

function unsupportedClient(): OrderClient {
  return {
    async get<T>(): Promise<T> {
      throw new Error("Unexpected GET");
    },
    async getList<T>(): Promise<ApiListData<T>> {
      throw new Error("Unexpected GET list");
    },
    async post<T>(): Promise<T> {
      throw new Error("Unexpected POST");
    },
  };
}

describe("order service", () => {
  it("posts the documented create payload to the organization order endpoint with authentication", async () => {
    const calls: Array<{
      path: string;
      body: unknown;
      authenticated?: boolean;
    }> = [];

    const client: OrderClient = {
      ...unsupportedClient(),
      async post<T>(
        path: string,
        body?: unknown,
        options?: { authenticated?: boolean },
      ): Promise<T> {
        calls.push({
          path,
          body,
          authenticated: options?.authenticated,
        });
        return createdOrder as T;
      },
    };

    const request: CreateOrderRequest = {
      campaignId: "campaign-1",
      items: [
        {
          productId: "product-1",
          variantId: "variant-1",
          quantity: 2,
        },
      ],
    };

    const result = await createOrderService(client).createOrder(
      "org 1",
      request,
    );

    expect(result).toEqual(createdOrder);
    expect(calls).toEqual([
      {
        path: "/organizations/org%201/orders",
        body: request,
        authenticated: true,
      },
    ]);
  });

  it("lists own orders using the opaque cursor and authenticated /me endpoint", async () => {
    const calls: Array<{
      path: string;
      cursor?: unknown;
      authenticated?: boolean;
    }> = [];

    const client: OrderClient = {
      ...unsupportedClient(),
      async getList<T>(
        path: string,
        options?: {
          authenticated?: boolean;
          query?: Record<
            string,
            string | number | boolean | null | undefined
          >;
          signal?: AbortSignal;
        },
      ): Promise<ApiListData<T>> {
        calls.push({
          path,
          cursor: options?.query?.cursor,
          authenticated: options?.authenticated,
        });

        return {
          items: [createdOrder] as T[],
          nextCursor: "opaque-next",
        };
      },
    };

    const result = await createOrderService(client).listMyOrders({
      cursor: "opaque-current",
    });

    expect(result.nextCursor).toBe("opaque-next");
    expect(calls).toEqual([
      {
        path: "/me/orders",
        cursor: "opaque-current",
        authenticated: true,
      },
    ]);
  });

  it("loads and cancels only through customer-owned /me order routes", async () => {
    const calls: string[] = [];

    const client: OrderClient = {
      ...unsupportedClient(),
      async get<T>(path: string): Promise<T> {
        calls.push(`GET ${path}`);
        return createdOrder as T;
      },
      async post<T>(path: string): Promise<T> {
        calls.push(`POST ${path}`);
        return undefined as T;
      },
    };

    const service = createOrderService(client);

    await service.getMyOrder("order 1");
    await service.cancelMyOrder("order 1");

    expect(calls).toEqual([
      "GET /me/orders/order%201",
      "POST /me/orders/order%201/cancel",
    ]);
  });

  it("lists, gets, and cancels organization Orders through Staff/Admin endpoints", async () => {
    const calls: Array<{
      method: string;
      path: string;
      query?: unknown;
      body?: unknown;
      authenticated?: boolean;
    }> = [];
    const cancelled: OrderDTO = {
      ...createdOrder,
      status: "CANCELLED",
    };

    const client: OrderClient = {
      ...unsupportedClient(),
      async getList<T>(
        path: string,
        options?: {
          authenticated?: boolean;
          query?: Record<
            string,
            string | number | boolean | null | undefined
          >;
          signal?: AbortSignal;
        },
      ): Promise<ApiListData<T>> {
        calls.push({
          method: "GET_LIST",
          path,
          query: options?.query,
          authenticated: options?.authenticated,
        });

        return {
          items: [createdOrder] as T[],
          nextCursor: "opaque-next",
        };
      },
      async get<T>(
        path: string,
        options?: {
          authenticated?: boolean;
          query?: Record<
            string,
            string | number | boolean | null | undefined
          >;
          signal?: AbortSignal;
        },
      ): Promise<T> {
        calls.push({
          method: "GET",
          path,
          authenticated: options?.authenticated,
        });
        return createdOrder as T;
      },
      async post<T>(
        path: string,
        body?: unknown,
        options?: { authenticated?: boolean },
      ): Promise<T> {
        calls.push({
          method: "POST",
          path,
          body,
          authenticated: options?.authenticated,
        });
        return cancelled as T;
      },
    };

    const service = createOrderService(client);

    const result = await service.listOrganizationOrders(
      "org 1",
      {
        campaignId: "campaign 1",
        status: "PAYMENT_REJECTED",
        customerId: "customer 1",
        cursor: "opaque-current",
      },
    );
    await service.getOrganizationOrder("org 1", "order 1");
    const cancelledResult =
      await service.cancelOrganizationOrder(
        "org 1",
        "order 1",
      );

    expect(result.nextCursor).toBe("opaque-next");
    expect(cancelledResult.status).toBe("CANCELLED");
    expect(calls).toEqual([
      {
        method: "GET_LIST",
        path: "/organizations/org%201/orders",
        query: {
          campaignId: "campaign 1",
          status: "PAYMENT_REJECTED",
          customerId: "customer 1",
          cursor: "opaque-current",
        },
        authenticated: true,
      },
      {
        method: "GET",
        path: "/organizations/org%201/orders/order%201",
        authenticated: true,
      },
      {
        method: "POST",
        path: "/organizations/org%201/orders/order%201/cancel",
        body: undefined,
        authenticated: true,
      },
    ]);
  });
});
