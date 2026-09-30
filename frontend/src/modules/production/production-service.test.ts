import { describe, expect, it } from "vitest";

import type { ProductionSummaryDTO } from "@/types";

import {
  createProductionService,
  type ProductionClient,
} from "./production-service";

const summary: ProductionSummaryDTO = {
  campaignId: "campaign-1",
  products: [
    {
      productId: "product-1",
      productName: "Faculty Shirt",
      variants: [
        {
          variantId: "variant-1",
          variantName: "Size M",
          quantity: 24,
        },
      ],
    },
  ],
};

describe("production service", () => {
  it("uses the documented Organization Admin summary endpoint with required campaignId", async () => {
    const calls: Array<{
      path: string;
      query?: unknown;
      authenticated?: boolean;
      signal?: AbortSignal;
    }> = [];
    const controller = new AbortController();

    const client: ProductionClient = {
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

    const result = await createProductionService(client).getSummary(
      "org 1",
      "campaign 1",
      { signal: controller.signal },
    );

    expect(result).toEqual(summary);
    expect(calls).toEqual([
      {
        path: "/organizations/org%201/production",
        query: {
          campaignId: "campaign 1",
        },
        authenticated: true,
        signal: controller.signal,
      },
    ]);
  });
});
