import { describe, expect, it } from "vitest";

import type { ApiListData, StoreDTO } from "@/types";

import {
  createStoreService,
  type StoreClient,
} from "./store-service";

const store: StoreDTO = {
  storeId: "store-1",
  organizationId: "org-1",
  name: "Main Store",
  description: "Faculty merchandise",
  status: "ACTIVE",
  createdAt: "2026-09-29T10:00:00.000Z",
  updatedAt: "2026-09-29T10:00:00.000Z",
};

function unsupportedClient(): StoreClient {
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

describe("store service", () => {
  it("uses documented organization-management Store endpoints", async () => {
    const calls: Array<{
      method: string;
      path: string;
      body?: unknown;
      authenticated?: boolean;
    }> = [];

    const client: StoreClient = {
      ...unsupportedClient(),
      async getList<T>(
        path: string,
        options?: {
          authenticated?: boolean;
          signal?: AbortSignal;
        },
      ): Promise<ApiListData<T>> {
        calls.push({
          method: "GET_LIST",
          path,
          authenticated: options?.authenticated,
        });
        return {
          items: [store] as T[],
          nextCursor: null,
        };
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
        return store as T;
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
        return store as T;
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
          ...store,
          status: "INACTIVE",
        } as T;
      },
    };

    const service = createStoreService(client);

    await service.list("org 1");
    await service.create("org 1", {
      name: "Main Store",
      description: "Faculty merchandise",
    });
    await service.get("org 1", "store 1");
    await service.update("org 1", "store 1", {
      status: "INACTIVE",
    });

    expect(calls).toEqual([
      {
        method: "GET_LIST",
        path: "/organizations/org%201/stores",
        authenticated: true,
      },
      {
        method: "POST",
        path: "/organizations/org%201/stores",
        body: {
          name: "Main Store",
          description: "Faculty merchandise",
        },
        authenticated: true,
      },
      {
        method: "GET",
        path: "/organizations/org%201/stores/store%201",
        authenticated: true,
      },
      {
        method: "PATCH",
        path: "/organizations/org%201/stores/store%201",
        body: {
          status: "INACTIVE",
        },
        authenticated: true,
      },
    ]);
  });
});
