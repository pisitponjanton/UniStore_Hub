import { apiClient } from "@/services";
import type {
  ApiListData,
  Cursor,
  EntityId,
  OrderDTO,
  OrderStatus,
} from "@/types";

export interface CreateOrderItemInput {
  productId: EntityId;
  variantId: EntityId;
  quantity: number;
}

export interface CreateOrderRequest {
  campaignId: EntityId;
  items: CreateOrderItemInput[];
}

export interface OrderClient {
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
    options?: {
      authenticated?: boolean;
    },
  ): Promise<T>;
}

export interface OrderService {
  createOrder(
    organizationId: EntityId,
    request: CreateOrderRequest,
  ): Promise<OrderDTO>;
  listMyOrders(options?: {
    cursor?: Cursor | null;
    signal?: AbortSignal;
  }): Promise<ApiListData<OrderDTO>>;
  getMyOrder(
    orderId: EntityId,
    options?: { signal?: AbortSignal },
  ): Promise<OrderDTO>;
  cancelMyOrder(orderId: EntityId): Promise<void>;
  listOrganizationOrders(
    organizationId: EntityId,
    options?: {
      campaignId?: EntityId | null;
      status?: OrderStatus | null;
      customerId?: EntityId | null;
      cursor?: Cursor | null;
      signal?: AbortSignal;
    },
  ): Promise<ApiListData<OrderDTO>>;
  getOrganizationOrder(
    organizationId: EntityId,
    orderId: EntityId,
    options?: { signal?: AbortSignal },
  ): Promise<OrderDTO>;
  cancelOrganizationOrder(
    organizationId: EntityId,
    orderId: EntityId,
  ): Promise<OrderDTO>;
}

export function createOrderService(
  client: OrderClient = apiClient,
): OrderService {
  return {
    createOrder(organizationId, request) {
      return client.post<OrderDTO>(
        `/organizations/${encodeURIComponent(organizationId)}/orders`,
        request,
        { authenticated: true },
      );
    },

    listMyOrders(options = {}) {
      return client.getList<OrderDTO>("/me/orders", {
        authenticated: true,
        query: options.cursor ? { cursor: options.cursor } : undefined,
        signal: options.signal,
      });
    },

    getMyOrder(orderId, options = {}) {
      return client.get<OrderDTO>(
        `/me/orders/${encodeURIComponent(orderId)}`,
        {
          authenticated: true,
          signal: options.signal,
        },
      );
    },

    async cancelMyOrder(orderId) {
      await client.post<void>(
        `/me/orders/${encodeURIComponent(orderId)}/cancel`,
        undefined,
        { authenticated: true },
      );
    },

    listOrganizationOrders(organizationId, options = {}) {
      return client.getList<OrderDTO>(
        `/organizations/${encodeURIComponent(organizationId)}/orders`,
        {
          authenticated: true,
          query: {
            campaignId: options.campaignId ?? undefined,
            status: options.status ?? undefined,
            customerId: options.customerId ?? undefined,
            cursor: options.cursor ?? undefined,
          },
          signal: options.signal,
        },
      );
    },

    getOrganizationOrder(
      organizationId,
      orderId,
      options = {},
    ) {
      return client.get<OrderDTO>(
        `/organizations/${encodeURIComponent(organizationId)}/orders/${encodeURIComponent(orderId)}`,
        {
          authenticated: true,
          signal: options.signal,
        },
      );
    },

    cancelOrganizationOrder(organizationId, orderId) {
      return client.post<OrderDTO>(
        `/organizations/${encodeURIComponent(organizationId)}/orders/${encodeURIComponent(orderId)}/cancel`,
        undefined,
        { authenticated: true },
      );
    },
  };
}

export const orderService = createOrderService();
