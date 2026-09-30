import { describe, expect, it } from "vitest";

import type {
  ApiListData,
  OrganizationDTO,
  PlatformSummaryDTO,
  UserDTO,
} from "@/types";

import {
  createPlatformAdminService,
  type PlatformAdminClient,
} from "./platform-admin-service";

const organization: OrganizationDTO = {
  organizationId: "org-1",
  name: "Student Store",
  description: "Campus goods",
  status: "PENDING",
  createdBy: "user-1",
  createdAt: "2026-09-30T01:00:00.000Z",
  updatedAt: "2026-09-30T01:00:00.000Z",
};

const user: UserDTO = {
  userId: "user-1",
  email: "user@example.com",
  name: "User One",
  status: "ACTIVE",
  platformRole: "PLATFORM_ADMIN",
  createdAt: "2026-09-30T01:00:00.000Z",
  updatedAt: "2026-09-30T01:00:00.000Z",
};

const summary: PlatformSummaryDTO = {
  organizationsByStatus: {
    PENDING: 1,
    ACTIVE: 2,
    SUSPENDED: 3,
  },
  usersByStatus: {
    ACTIVE: 4,
    DISABLED: 1,
  },
};

function unsupportedClient(): PlatformAdminClient {
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

describe("platform admin service", () => {
  it("uses only documented /platform endpoints", async () => {
    const calls: Array<{
      method: string;
      path: string;
      body?: unknown;
      authenticated?: boolean;
    }> = [];

    const client: PlatformAdminClient = {
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
        return summary as T;
      },
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
          items:
            path.endsWith("/organizations")
              ? ([organization] as T[])
              : ([user] as T[]),
          nextCursor: null,
        };
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

        return {
          ...organization,
          status: path.endsWith("/approve")
            ? "ACTIVE"
            : "SUSPENDED",
        } as T;
      },
    };

    const service = createPlatformAdminService(client);

    await service.getSummary();
    await service.listOrganizations();
    await service.approveOrganization("org 1");
    await service.suspendOrganization("org 1");
    await service.listUsers();

    expect(calls).toEqual([
      {
        method: "GET",
        path: "/platform/summary",
        authenticated: true,
      },
      {
        method: "GET_LIST",
        path: "/platform/organizations",
        authenticated: true,
      },
      {
        method: "POST",
        path: "/platform/organizations/org%201/approve",
        body: undefined,
        authenticated: true,
      },
      {
        method: "POST",
        path: "/platform/organizations/org%201/suspend",
        body: undefined,
        authenticated: true,
      },
      {
        method: "GET_LIST",
        path: "/platform/users",
        authenticated: true,
      },
    ]);
  });
});
