import { describe, expect, it } from "vitest";

import type { OrganizationReportDTO } from "@/types";

import {
  createDashboardService,
  type DashboardClient,
} from "./dashboard-service";

const summary: OrganizationReportDTO = {
  totalStores: 2,
  totalProducts: 12,
  campaignsByStatus: {
    OPEN: 1,
    CLOSED: 2,
  },
  ordersByStatus: {
    PAID: 5,
    RECEIVED: 3,
  },
  pendingPaymentReviews: 4,
  paidOrderCount: 8,
  paidRevenueSatang: 2500000,
};

describe("dashboard service", () => {
  it("uses the contracted report endpoint and optional campaign/store filters", async () => {
    const calls: Array<{
      path: string;
      query?: unknown;
      authenticated?: boolean;
      signal?: AbortSignal;
    }> = [];
    const controller = new AbortController();

    const client: DashboardClient = {
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
          path,
          query: options?.query,
          authenticated: options?.authenticated,
          signal: options?.signal,
        });
        return summary as T;
      },
    };

    const result = await createDashboardService(client).getSummary(
      "org 1",
      {
        campaignId: "campaign 1",
        storeId: "store 1",
        signal: controller.signal,
      },
    );

    expect(result).toEqual(summary);
    expect(calls).toEqual([
      {
        path: "/organizations/org%201/reports",
        query: {
          campaignId: "campaign 1",
          storeId: "store 1",
        },
        authenticated: true,
        signal: controller.signal,
      },
    ]);
  });
});
