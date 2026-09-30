import { apiClient } from "@/services";
import type {
  ApiListData,
  EntityId,
  OrganizationDTO,
  PlatformSummaryDTO,
  UserDTO,
} from "@/types";

export interface PlatformAdminClient {
  get<T>(
    path: string,
    options?: {
      authenticated?: boolean;
      signal?: AbortSignal;
    },
  ): Promise<T>;
  getList<T>(
    path: string,
    options?: {
      authenticated?: boolean;
      signal?: AbortSignal;
    },
  ): Promise<ApiListData<T>>;
  post<T>(
    path: string,
    body?: unknown,
    options?: { authenticated?: boolean },
  ): Promise<T>;
}

export interface PlatformAdminService {
  getSummary(
    options?: { signal?: AbortSignal },
  ): Promise<PlatformSummaryDTO>;
  listOrganizations(
    options?: { signal?: AbortSignal },
  ): Promise<ApiListData<OrganizationDTO>>;
  approveOrganization(
    organizationId: EntityId,
  ): Promise<OrganizationDTO>;
  suspendOrganization(
    organizationId: EntityId,
  ): Promise<OrganizationDTO>;
  listUsers(
    options?: { signal?: AbortSignal },
  ): Promise<ApiListData<UserDTO>>;
}

export function createPlatformAdminService(
  client: PlatformAdminClient = apiClient,
): PlatformAdminService {
  return {
    getSummary(options = {}) {
      return client.get<PlatformSummaryDTO>(
        "/platform/summary",
        {
          authenticated: true,
          signal: options.signal,
        },
      );
    },

    listOrganizations(options = {}) {
      return client.getList<OrganizationDTO>(
        "/platform/organizations",
        {
          authenticated: true,
          signal: options.signal,
        },
      );
    },

    approveOrganization(organizationId) {
      return client.post<OrganizationDTO>(
        `/platform/organizations/${encodeURIComponent(organizationId)}/approve`,
        undefined,
        { authenticated: true },
      );
    },

    suspendOrganization(organizationId) {
      return client.post<OrganizationDTO>(
        `/platform/organizations/${encodeURIComponent(organizationId)}/suspend`,
        undefined,
        { authenticated: true },
      );
    },

    listUsers(options = {}) {
      return client.getList<UserDTO>(
        "/platform/users",
        {
          authenticated: true,
          signal: options.signal,
        },
      );
    },
  };
}

export const platformAdminService =
  createPlatformAdminService();
