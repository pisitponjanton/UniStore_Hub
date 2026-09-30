import { apiClient } from "@/services";
import type {
  EntityId,
  ProductionSummaryDTO,
} from "@/types";

export interface ProductionClient {
  get<T>(
    path: string,
    options?: {
      authenticated?: boolean;
      query?: Record<
        string,
        string | number | boolean | null | undefined
      >;
      signal?: AbortSignal;
    },
  ): Promise<T>;
}

export interface ProductionService {
  getSummary(
    organizationId: EntityId,
    campaignId: EntityId,
    options?: { signal?: AbortSignal },
  ): Promise<ProductionSummaryDTO>;
}

export function createProductionService(
  client: ProductionClient = apiClient,
): ProductionService {
  return {
    getSummary(organizationId, campaignId, options = {}) {
      return client.get<ProductionSummaryDTO>(
        `/organizations/${encodeURIComponent(organizationId)}/production`,
        {
          authenticated: true,
          query: {
            campaignId,
          },
          signal: options.signal,
        },
      );
    },
  };
}

export const productionService = createProductionService();
