import { apiClient } from "@/services";
import type {
  ApiListData,
  Cursor,
  EntityId,
  PickupDTO,
  PickupStatus,
} from "@/types";

export interface PickupClient {
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
      query?: Record<
        string,
        string | number | boolean | null | undefined
      >;
      signal?: AbortSignal;
    },
  ): Promise<ApiListData<T>>;
  post<T>(
    path: string,
    body?: unknown,
    options?: { authenticated?: boolean },
  ): Promise<T>;
}

export interface PickupService {
  getMyPickup(
    orderId: EntityId,
    options?: { signal?: AbortSignal },
  ): Promise<PickupDTO>;
  listOrganizationPickups(
    organizationId: EntityId,
    options?: {
      campaignId?: EntityId | null;
      status?: PickupStatus | null;
      token?: string | null;
      orderId?: EntityId | null;
      cursor?: Cursor | null;
      signal?: AbortSignal;
    },
  ): Promise<ApiListData<PickupDTO>>;
  getOrganizationPickup(
    organizationId: EntityId,
    pickupId: EntityId,
    options?: { signal?: AbortSignal },
  ): Promise<PickupDTO>;
  confirmOrganizationPickup(
    organizationId: EntityId,
    pickupId: EntityId,
  ): Promise<PickupDTO>;
}

export function createPickupService(
  client: PickupClient = apiClient,
): PickupService {
  return {
    getMyPickup(orderId, options = {}) {
      return client.get<PickupDTO>(
        `/me/orders/${encodeURIComponent(orderId)}/pickup`,
        {
          authenticated: true,
          signal: options.signal,
        },
      );
    },

    listOrganizationPickups(
      organizationId,
      options = {},
    ) {
      return client.getList<PickupDTO>(
        `/organizations/${encodeURIComponent(organizationId)}/pickups`,
        {
          authenticated: true,
          query: {
            campaignId: options.campaignId ?? undefined,
            status: options.status ?? undefined,
            token: options.token ?? undefined,
            orderId: options.orderId ?? undefined,
            cursor: options.cursor ?? undefined,
          },
          signal: options.signal,
        },
      );
    },

    getOrganizationPickup(
      organizationId,
      pickupId,
      options = {},
    ) {
      return client.get<PickupDTO>(
        `/organizations/${encodeURIComponent(organizationId)}/pickups/${encodeURIComponent(pickupId)}`,
        {
          authenticated: true,
          signal: options.signal,
        },
      );
    },

    confirmOrganizationPickup(organizationId, pickupId) {
      return client.post<PickupDTO>(
        `/organizations/${encodeURIComponent(organizationId)}/pickups/${encodeURIComponent(pickupId)}/confirm`,
        undefined,
        { authenticated: true },
      );
    },
  };
}

export const pickupService = createPickupService();
