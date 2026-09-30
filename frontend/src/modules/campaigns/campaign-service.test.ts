import { describe, expect, it } from "vitest";

import type {
  ApiListData,
  CampaignDTO,
} from "@/types";

import {
  createCampaignService,
  type CampaignClient,
} from "./campaign-service";

const campaign: CampaignDTO = {
  campaignId: "campaign-1",
  organizationId: "org-1",
  storeId: "store-1",
  name: "Faculty Shirt Pre-order",
  openAt: "2026-10-01T00:00:00.000Z",
  closeAt: "2026-10-10T23:59:59.000Z",
  paymentDeadline: "2026-10-11T23:59:59.000Z",
  pickupAt: "2026-10-25T09:00:00.000Z",
  status: "DRAFT",
  createdAt: "2026-09-29T10:00:00.000Z",
  updatedAt: "2026-09-29T10:00:00.000Z",
};

function unsupportedClient(): CampaignClient {
  return {
    async get<T>(): Promise<T> {
      throw new Error("unexpected get");
    },
    async getList<T>(): Promise<ApiListData<T>> {
      throw new Error("unexpected list");
    },
    async post<T>(): Promise<T> {
      throw new Error("unexpected post");
    },
    async patch<T>(): Promise<T> {
      throw new Error("unexpected patch");
    },
  };
}

describe("campaign service", () => {
  it("uses documented list filters and opaque cursor", async () => {
    const calls: Array<{
      path: string;
      query?: unknown;
      authenticated?: boolean;
    }> = [];

    const client: CampaignClient = {
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
          items: [campaign] as T[],
          nextCursor: "opaque-next",
        };
      },
    };

    const result = await createCampaignService(client).list(
      "org 1",
      {
        storeId: "store 1",
        status: "DRAFT",
        cursor: "opaque-current",
      },
    );

    expect(result.nextCursor).toBe("opaque-next");
    expect(calls).toEqual([
      {
        path: "/organizations/org%201/campaigns",
        query: {
          storeId: "store 1",
          status: "DRAFT",
          cursor: "opaque-current",
        },
        authenticated: true,
      },
    ]);
  });

  it("creates, gets, and updates through management endpoints", async () => {
    const calls: Array<{
      method: string;
      path: string;
      body?: unknown;
      authenticated?: boolean;
    }> = [];

    const client: CampaignClient = {
      ...unsupportedClient(),
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
        return campaign as T;
      },
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
        return campaign as T;
      },
      async patch<T>(
        path: string,
        body?: unknown,
        options?: { authenticated?: boolean },
      ): Promise<T> {
        calls.push({
          method: "PATCH",
          path,
          body,
          authenticated: options?.authenticated,
        });
        return {
          ...campaign,
          name: "Updated Campaign",
        } as T;
      },
    };

    const service = createCampaignService(client);
    const input = {
      storeId: "store-1",
      name: "Faculty Shirt Pre-order",
      openAt: "2026-10-01T00:00:00.000Z",
      closeAt: "2026-10-10T23:59:59.000Z",
      paymentDeadline: "2026-10-11T23:59:59.000Z",
      pickupAt: "2026-10-25T09:00:00.000Z",
    };

    await service.create("org 1", input);
    await service.get("org 1", "campaign 1");
    await service.update("org 1", "campaign 1", {
      ...input,
      name: "Updated Campaign",
    });

    expect(calls).toEqual([
      {
        method: "POST",
        path: "/organizations/org%201/campaigns",
        body: input,
        authenticated: true,
      },
      {
        method: "GET",
        path: "/organizations/org%201/campaigns/campaign%201",
        authenticated: true,
      },
      {
        method: "PATCH",
        path: "/organizations/org%201/campaigns/campaign%201",
        body: {
          ...input,
          name: "Updated Campaign",
        },
        authenticated: true,
      },
    ]);
  });

  it("uses explicit lifecycle POST endpoints with no request body", async () => {
    const calls: Array<{
      path: string;
      body?: unknown;
      authenticated?: boolean;
    }> = [];

    const client: CampaignClient = {
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

        return {
          ...campaign,
          status: "OPEN",
        } as T;
      },
    };

    const result = await createCampaignService(client).transition(
      "org 1",
      "campaign 1",
      "open",
    );

    expect(result.status).toBe("OPEN");
    expect(calls).toEqual([
      {
        path: "/organizations/org%201/campaigns/campaign%201/open",
        body: undefined,
        authenticated: true,
      },
    ]);
  });
});
