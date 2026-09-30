import { describe, expect, it } from "vitest";

import type {
  ApiListData,
  OrganizationMemberDTO,
} from "@/types";

import {
  createStaffService,
  type StaffClient,
} from "./staff-service";

const member: OrganizationMemberDTO = {
  organizationId: "org-1",
  userId: "user-1",
  role: "STAFF",
  status: "ACTIVE",
  user: {
    userId: "user-1",
    email: "staff@example.com",
    name: "Staff User",
  },
  createdAt: "2026-09-29T10:00:00.000Z",
  updatedAt: "2026-09-29T10:00:00.000Z",
};

function unsupportedClient(): StaffClient {
  return {
    async getList<T>(): Promise<ApiListData<T>> {
      throw new Error("unexpected list");
    },
    async post<T>(): Promise<T> {
      throw new Error("unexpected post");
    },
    async patch<T>(): Promise<T> {
      throw new Error("unexpected patch");
    },
    async delete(): Promise<void> {
      throw new Error("unexpected delete");
    },
  };
}

describe("staff service", () => {
  it("uses documented member endpoints and authenticated requests", async () => {
    const calls: Array<{
      method: string;
      path: string;
      body?: unknown;
      authenticated?: boolean;
    }> = [];

    const client: StaffClient = {
      ...unsupportedClient(),
      async getList<T>(
        path: string,
        options?: {
          authenticated?: boolean;
          signal?: AbortSignal;
        },
      ): Promise<ApiListData<T>> {
        calls.push({
          method: "GET",
          path,
          authenticated: options?.authenticated,
        });

        return {
          items: [member] as T[],
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
        return member as T;
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
          ...member,
          role: "ORGANIZATION_ADMIN",
        } as T;
      },
      async delete(
        path: string,
        options?: { authenticated?: boolean },
      ): Promise<void> {
        calls.push({
          method: "DELETE",
          path,
          authenticated: options?.authenticated,
        });
      },
    };

    const service = createStaffService(client);

    await service.list("org 1");
    await service.add("org 1", {
      email: "staff@example.com",
      role: "STAFF",
    });
    await service.updateRole(
      "org 1",
      "user 1",
      "ORGANIZATION_ADMIN",
    );
    await service.remove("org 1", "user 1");

    expect(calls).toEqual([
      {
        method: "GET",
        path: "/organizations/org%201/members",
        authenticated: true,
      },
      {
        method: "POST",
        path: "/organizations/org%201/members",
        body: {
          email: "staff@example.com",
          role: "STAFF",
        },
        authenticated: true,
      },
      {
        method: "PATCH",
        path: "/organizations/org%201/members/user%201",
        body: {
          role: "ORGANIZATION_ADMIN",
        },
        authenticated: true,
      },
      {
        method: "DELETE",
        path: "/organizations/org%201/members/user%201",
        authenticated: true,
      },
    ]);
  });
});
