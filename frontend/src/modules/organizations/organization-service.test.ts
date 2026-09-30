import { describe, expect, it } from "vitest";

import type { ApiListData, OrganizationDTO } from "@/types";

import {
  createOrganizationService,
  type OrganizationClient,
} from "./organization-service";

const organization: OrganizationDTO = {
  organizationId: "org-1",
  name: "IT Club Store",
  description: "Student club merchandise",
  status: "PENDING",
  createdBy: "user-1",
  createdAt: "2026-09-29T10:00:00.000Z",
  updatedAt: "2026-09-29T10:00:00.000Z",
};

function unsupportedClient(): OrganizationClient {
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

describe("organization service", () => {
  it("lists only through the authenticated organizations collection", async () => {
    const calls: Array<{
      path: string;
      authenticated?: boolean;
    }> = [];

    const client: OrganizationClient = {
      ...unsupportedClient(),
      async getList<T>(
        path: string,
        options?: {
          authenticated?: boolean;
          signal?: AbortSignal;
        },
      ): Promise<ApiListData<T>> {
        calls.push({
          path,
          authenticated: options?.authenticated,
        });

        return {
          items: [organization] as T[],
          nextCursor: null,
        };
      },
    };

    const result = await createOrganizationService(client).listAccessible();

    expect(result).toEqual([organization]);
    expect(calls).toEqual([
      {
        path: "/organizations",
        authenticated: true,
      },
    ]);
  });

  it("creates an organization with only name and description", async () => {
    const calls: Array<{
      path: string;
      body: unknown;
      authenticated?: boolean;
    }> = [];

    const client: OrganizationClient = {
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
        return organization as T;
      },
    };

    const result = await createOrganizationService(client).create({
      name: "IT Club Store",
      description: "Student club merchandise",
    });

    expect(result).toEqual(organization);
    expect(calls).toEqual([
      {
        path: "/organizations",
        body: {
          name: "IT Club Store",
          description: "Student club merchandise",
        },
        authenticated: true,
      },
    ]);
  });

  it("gets and updates a query-selected organization without putting permission in the query string", async () => {
    const calls: string[] = [];

    const client: OrganizationClient = {
      ...unsupportedClient(),
      async get<T>(path: string): Promise<T> {
        calls.push(`GET ${path}`);
        return organization as T;
      },
      async patch<T>(
        path: string,
        body?: unknown,
      ): Promise<T> {
        calls.push(`PATCH ${path} ${JSON.stringify(body)}`);
        return {
          ...organization,
          name: "Updated Store",
        } as T;
      },
    };

    const service = createOrganizationService(client);

    await service.get("org 1");
    const updated = await service.update("org 1", {
      name: "Updated Store",
      description: "Updated",
    });

    expect(updated.name).toBe("Updated Store");
    expect(calls).toEqual([
      "GET /organizations/org%201",
      'PATCH /organizations/org%201 {"name":"Updated Store","description":"Updated"}',
    ]);
  });
});
