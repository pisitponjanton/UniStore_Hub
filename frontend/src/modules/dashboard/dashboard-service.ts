import { apiClient } from "@/services";
import type {
  EntityId,
  OrganizationReportDTO,
} from "@/types";

export interface DashboardClient {
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

export interface DashboardService {
  getSummary(
    organizationId: EntityId,
    options?: {
      campaignId?: EntityId | null;
      storeId?: EntityId | null;
      signal?: AbortSignal;
    },
  ): Promise<OrganizationReportDTO>;
}

export function createDashboardService(
  client: DashboardClient = apiClient,
): DashboardService {
  return {
    getSummary(organizationId, options = {}) {
      return client.get<OrganizationReportDTO>(
        `/organizations/${encodeURIComponent(organizationId)}/reports`,
        {
          authenticated: true,
          query: {
            campaignId: options.campaignId ?? undefined,
            storeId: options.storeId ?? undefined,
          },
          signal: options.signal,
        },
      );
    },
  };
}

export const dashboardService = createDashboardService();
