import { describe, expect, it } from "vitest";

import type {
  ApiListData,
  AuditLogDTO,
} from "@/types";

import {
  createAuditService,
  type AuditClient,
} from "./audit-service";

const item: AuditLogDTO = {
  auditId: "audit-1",
  organizationId: "org-1",
  actorId: "user-1",
  action: "PAYMENT_APPROVED",
  resourceType: "PAYMENT",
  resourceId: "payment-1",
  metadata: {
    orderId: "order-1",
  },
  createdAt: "2026-09-30T02:00:00.000Z",
};

describe("audit service", () => {
  it("uses only the documented read-only filters and opaque cursor", async () => {
    const calls: Array<{
      path: string;
      query?: unknown;
      authenticated?: boolean;
    }> = [];

    const client: AuditClient = {
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
          items: [item] as T[],
          nextCursor: "opaque-next",
        };
      },
    };

    const result = await createAuditService(client).list(
      "org 1",
      {
        actorId: "actor 1",
        action: "PAYMENT_APPROVED",
        resourceType: "PAYMENT",
        resourceId: "payment 1",
        cursor: "opaque-current",
      },
    );

    expect(result.nextCursor).toBe("opaque-next");
    expect(calls).toEqual([
      {
        path: "/organizations/org%201/audit-logs",
        query: {
          actorId: "actor 1",
          action: "PAYMENT_APPROVED",
          resourceType: "PAYMENT",
          resourceId: "payment 1",
          cursor: "opaque-current",
        },
        authenticated: true,
      },
    ]);
  });
});
