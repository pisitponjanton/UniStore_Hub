import { apiClient } from "@/services";
import type {
  ApiListData,
  EntityId,
  ResourceStatus,
  StoreDTO,
} from "@/types";

export interface StoreClient {
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

export interface StoreFormInput {
  name: string;
  description: string;
}

export interface StoreUpdateInput {
  name?: string;
  description?: string;
  status?: ResourceStatus;
}

export interface StoreService {
  list(
    organizationId: EntityId,
    options?: { signal?: AbortSignal },
  ): Promise<StoreDTO[]>;
  create(
    organizationId: EntityId,
    input: StoreFormInput,
  ): Promise<StoreDTO>;
  get(
    organizationId: EntityId,
    storeId: EntityId,
    options?: { signal?: AbortSignal },
  ): Promise<StoreDTO>;
  update(
    organizationId: EntityId,
    storeId: EntityId,
    input: StoreUpdateInput,
  ): Promise<StoreDTO>;
}

function storesPath(organizationId: EntityId): string {
  return `/organizations/${encodeURIComponent(organizationId)}/stores`;
}

export function createStoreService(
  client: StoreClient = apiClient,
): StoreService {
  return {
    async list(organizationId, options = {}) {
      const result = await client.getList<StoreDTO>(
        storesPath(organizationId),
        {
          authenticated: true,
          signal: options.signal,
        },
      );

      return result.items;
    },

    create(organizationId, input) {
      return client.post<StoreDTO>(
        storesPath(organizationId),
        input,
        { authenticated: true },
      );
    },

    get(organizationId, storeId, options = {}) {
      return client.get<StoreDTO>(
        `${storesPath(organizationId)}/${encodeURIComponent(storeId)}`,
        {
          authenticated: true,
          signal: options.signal,
        },
      );
    },

    update(organizationId, storeId, input) {
      return client.patch<StoreDTO>(
        `${storesPath(organizationId)}/${encodeURIComponent(storeId)}`,
        input,
        { authenticated: true },
      );
    },
  };
}

export const storeService = createStoreService();
