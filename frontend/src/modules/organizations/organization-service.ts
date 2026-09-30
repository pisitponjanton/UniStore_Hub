import { apiClient } from "@/services";
import type { ApiListData, EntityId, OrganizationDTO } from "@/types";

export interface OrganizationClient {
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
  patch<T>(
    path: string,
    body?: unknown,
    options?: { authenticated?: boolean },
  ): Promise<T>;
}

export interface CreateOrganizationInput {
  name: string;
  description: string;
}

export interface UpdateOrganizationInput {
  name?: string;
  description?: string;
}

export interface OrganizationService {
  listAccessible(options?: { signal?: AbortSignal }): Promise<OrganizationDTO[]>;
  create(input: CreateOrganizationInput): Promise<OrganizationDTO>;
  get(
    organizationId: EntityId,
    options?: { signal?: AbortSignal },
  ): Promise<OrganizationDTO>;
  update(
    organizationId: EntityId,
    input: UpdateOrganizationInput,
  ): Promise<OrganizationDTO>;
}

export function createOrganizationService(
  client: OrganizationClient = apiClient,
): OrganizationService {
  return {
    async listAccessible(options = {}) {
      const result = await client.getList<OrganizationDTO>("/organizations", {
        authenticated: true,
        signal: options.signal,
      });

      return result.items;
    },

    create(input) {
      return client.post<OrganizationDTO>(
        "/organizations",
        input,
        { authenticated: true },
      );
    },

    get(organizationId, options = {}) {
      return client.get<OrganizationDTO>(
        `/organizations/${encodeURIComponent(organizationId)}`,
        {
          authenticated: true,
          signal: options.signal,
        },
      );
    },

    update(organizationId, input) {
      return client.patch<OrganizationDTO>(
        `/organizations/${encodeURIComponent(organizationId)}`,
        input,
        { authenticated: true },
      );
    },
  };
}

export const organizationService = createOrganizationService();
