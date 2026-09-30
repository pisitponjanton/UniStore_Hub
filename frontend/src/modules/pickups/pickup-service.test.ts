import { describe, expect, it } from "vitest";

import type {
  ApiListData,
  PickupDTO,
} from "@/types";

import {
  createPickupService,
  type PickupClient,
} from "./pickup-service";

const pickup: PickupDTO = {
  pickupId: "pickup-1",
  organizationId: "org-1",
  orderId: "order-1",
  token: "abcdefghijklmnopqrstuv",
  status: "READY",
  receivedBy: null,
  receivedAt: null,
  createdAt: "2026-09-29T12:00:00.000Z",
  updatedAt: "2026-09-29T12:00:00.000Z",
};

function unsupportedClient(): PickupClient {
  return {
    async get<T>(): Promise<T> {
      throw new Error("unexpected get");
    },
    async getList<T>(): Promise<ApiListData<T>> {
      throw new Error("unexpected getList");
    },
    async post<T>(): Promise<T> {
      throw new Error("unexpected post");
    },
  };
}

describe("pickup service", () => {
  it("loads only the current customer's pickup through the documented own-order endpoint", async () => {
    const calls: Array<{
      path: string;
      authenticated?: boolean;
      signal?: AbortSignal;
    }> = [];
    const controller = new AbortController();

    const client: PickupClient = {
      ...unsupportedClient(),
      async get<T>(
        path: string,
        options?: {
          authenticated?: boolean;
          signal?: AbortSignal;
        },
      ): Promise<T> {
        calls.push({
          path,
          authenticated: options?.authenticated,
          signal: options?.signal,
        });
        return pickup as T;
      },
    };

    const result = await createPickupService(client).getMyPickup(
      "order 1",
      { signal: controller.signal },
    );

    expect(result).toEqual(pickup);
    expect(calls).toEqual([
      {
        path: "/me/orders/order%201/pickup",
        authenticated: true,
        signal: controller.signal,
      },
    ]);
  });

  it("uses documented organization pickup search filters and opaque cursor", async () => {
    const calls: Array<{
      path: string;
      query?: unknown;
      authenticated?: boolean;
    }> = [];

    const client: PickupClient = {
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
          query: options?.query,
          authenticated: options?.authenticated,
        });
        return {
          items: [pickup] as T[],
          nextCursor: "opaque-next",
        };
      },
    };

    const result =
      await createPickupService(client).listOrganizationPickups(
        "org 1",
        {
          campaignId: "campaign 1",
          status: "READY",
          token: "token value",
          orderId: "order 1",
          cursor: "opaque-current",
        },
      );

    expect(result.nextCursor).toBe("opaque-next");
    expect(calls).toEqual([
      {
        path: "/organizations/org%201/pickups",
        query: {
          campaignId: "campaign 1",
          status: "READY",
          token: "token value",
          orderId: "order 1",
          cursor: "opaque-current",
        },
        authenticated: true,
      },
    ]);
  });

  it("gets and confirms organization Pickup through tenant-scoped endpoints", async () => {
    const calls: Array<{
      method: string;
      path: string;
      body?: unknown;
      authenticated?: boolean;
    }> = [];
    const received: PickupDTO = {
      ...pickup,
      status: "RECEIVED",
      receivedBy: "staff-1",
      receivedAt: "2026-09-30T02:00:00.000Z",
    };

    const client: PickupClient = {
      ...unsupportedClient(),
      async get<T>(
        path: string,
        options?: {
          authenticated?: boolean;
          signal?: AbortSignal;
        },
      ): Promise<T> {
        calls.push({
          method: "GET",
          path,
          authenticated: options?.authenticated,
        });
        return pickup as T;
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
        return received as T;
      },
    };

    const service = createPickupService(client);
    await service.getOrganizationPickup("org 1", "pickup 1");
    const result = await service.confirmOrganizationPickup(
      "org 1",
      "pickup 1",
    );

    expect(result.status).toBe("RECEIVED");
    expect(calls).toEqual([
      {
        method: "GET",
        path: "/organizations/org%201/pickups/pickup%201",
        authenticated: true,
      },
      {
        method: "POST",
        path: "/organizations/org%201/pickups/pickup%201/confirm",
        body: undefined,
        authenticated: true,
      },
    ]);
  });
});
