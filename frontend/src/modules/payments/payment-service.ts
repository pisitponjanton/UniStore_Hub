import { apiClient } from "@/services";
import type {
  AllowedUploadContentType,
  ApiListData,
  Cursor,
  EntityId,
  PaymentDTO,
  PaymentStatus,
  PresignedDownloadDTO,
  PresignedUploadDTO,
} from "@/types";

export interface PaymentClient {
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
    options?: {
      authenticated?: boolean;
    },
  ): Promise<T>;
}

export interface PaymentService {
  getMyPayment(
    orderId: EntityId,
    options?: { signal?: AbortSignal },
  ): Promise<PaymentDTO>;
  requestSlipUploadUrl(
    organizationId: EntityId,
    orderId: EntityId,
    contentType: AllowedUploadContentType,
  ): Promise<PresignedUploadDTO>;
  submitPayment(
    organizationId: EntityId,
    orderId: EntityId,
    slipKey: string,
  ): Promise<PaymentDTO>;
  listOrganizationPayments(
    organizationId: EntityId,
    options?: {
      status?: PaymentStatus | null;
      campaignId?: EntityId | null;
      orderId?: EntityId | null;
      cursor?: Cursor | null;
      signal?: AbortSignal;
    },
  ): Promise<ApiListData<PaymentDTO>>;
  getOrganizationPayment(
    organizationId: EntityId,
    paymentId: EntityId,
    options?: { signal?: AbortSignal },
  ): Promise<PaymentDTO>;
  requestPrivateDownloadUrl(
    organizationId: EntityId,
    objectKey: string,
  ): Promise<PresignedDownloadDTO>;
  approvePayment(
    organizationId: EntityId,
    paymentId: EntityId,
  ): Promise<PaymentDTO>;
  rejectPayment(
    organizationId: EntityId,
    paymentId: EntityId,
    reason: string,
  ): Promise<PaymentDTO>;
}

export function createPaymentService(
  client: PaymentClient = apiClient,
): PaymentService {
  return {
    getMyPayment(orderId, options = {}) {
      return client.get<PaymentDTO>(
        `/me/orders/${encodeURIComponent(orderId)}/payment`,
        {
          authenticated: true,
          signal: options.signal,
        },
      );
    },

    requestSlipUploadUrl(organizationId, orderId, contentType) {
      return client.post<PresignedUploadDTO>(
        `/organizations/${encodeURIComponent(
          organizationId,
        )}/orders/${encodeURIComponent(orderId)}/payment-slip-upload-url`,
        { contentType },
        { authenticated: true },
      );
    },

    submitPayment(organizationId, orderId, slipKey) {
      return client.post<PaymentDTO>(
        `/organizations/${encodeURIComponent(
          organizationId,
        )}/orders/${encodeURIComponent(orderId)}/payment`,
        { slipKey },
        { authenticated: true },
      );
    },

    listOrganizationPayments(organizationId, options = {}) {
      return client.getList<PaymentDTO>(
        `/organizations/${encodeURIComponent(organizationId)}/payments`,
        {
          authenticated: true,
          query: {
            status: options.status ?? undefined,
            campaignId: options.campaignId ?? undefined,
            orderId: options.orderId ?? undefined,
            cursor: options.cursor ?? undefined,
          },
          signal: options.signal,
        },
      );
    },

    getOrganizationPayment(
      organizationId,
      paymentId,
      options = {},
    ) {
      return client.get<PaymentDTO>(
        `/organizations/${encodeURIComponent(organizationId)}/payments/${encodeURIComponent(paymentId)}`,
        {
          authenticated: true,
          signal: options.signal,
        },
      );
    },

    requestPrivateDownloadUrl(organizationId, objectKey) {
      return client.post<PresignedDownloadDTO>(
        `/organizations/${encodeURIComponent(organizationId)}/files/download-url`,
        { objectKey },
        { authenticated: true },
      );
    },

    approvePayment(organizationId, paymentId) {
      return client.post<PaymentDTO>(
        `/organizations/${encodeURIComponent(organizationId)}/payments/${encodeURIComponent(paymentId)}/approve`,
        undefined,
        { authenticated: true },
      );
    },

    rejectPayment(organizationId, paymentId, reason) {
      return client.post<PaymentDTO>(
        `/organizations/${encodeURIComponent(organizationId)}/payments/${encodeURIComponent(paymentId)}/reject`,
        { reason },
        { authenticated: true },
      );
    },
  };
}

export const paymentService = createPaymentService();
