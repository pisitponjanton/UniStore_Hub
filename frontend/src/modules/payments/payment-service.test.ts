import { describe, expect, it } from "vitest";

import type {
  ApiListData,
  PaymentDTO,
  PresignedDownloadDTO,
  PresignedUploadDTO,
} from "@/types";

import {
  createPaymentService,
  type PaymentClient,
} from "./payment-service";

const upload: PresignedUploadDTO = {
  objectKey: "payments/org-1/order-1/file-1",
  url: "https://upload.example.test/presigned",
  method: "PUT",
  expiresInSeconds: 900,
};

const download: PresignedDownloadDTO = {
  url: "https://download.example.test/presigned",
  method: "GET",
  expiresInSeconds: 900,
};

const submittedPayment: PaymentDTO = {
  paymentId: "payment-1",
  organizationId: "org-1",
  orderId: "order-1",
  customerId: "user-1",
  slipKey: "payments/org-1/order-1/file-1",
  status: "PENDING_REVIEW",
  rejectReason: null,
  reviewedBy: null,
  reviewedAt: null,
  createdAt: "2026-09-29T15:00:00.000Z",
  updatedAt: "2026-09-29T15:00:00.000Z",
};

function unsupportedClient(): PaymentClient {
  return {
    async get<T>(): Promise<T> {
      throw new Error("unexpected get");
    },
    async getList<T>(): Promise<ApiListData<T>> {
      throw new Error("unexpected getList");
    },
    async post<T>(): Promise<T> {
      throw new Error("unexpected post");
    },
  };
}

describe("payment service", () => {
  it("loads the current Customer Payment through the documented own-Order endpoint", async () => {
    const calls: Array<{
      path: string;
      authenticated?: boolean;
      signal?: AbortSignal;
    }> = [];
    const controller = new AbortController();

    const client: PaymentClient = {
      ...unsupportedClient(),
      async get<T>(
        path: string,
        options?: {
          authenticated?: boolean;
          signal?: AbortSignal;
        },
      ): Promise<T> {
        calls.push({
          path,
          authenticated: options?.authenticated,
          signal: options?.signal,
        });
        return submittedPayment as T;
      },
    };

    const result = await createPaymentService(client).getMyPayment(
      "order 1",
      { signal: controller.signal },
    );

    expect(result).toEqual(submittedPayment);
    expect(calls).toEqual([
      {
        path: "/me/orders/order%201/payment",
        authenticated: true,
        signal: controller.signal,
      },
    ]);
  });

  it("requests a fresh payment-slip upload URL with the validated content type", async () => {
    const calls: Array<{
      path: string;
      body: unknown;
      authenticated?: boolean;
    }> = [];

    const client: PaymentClient = {
      ...unsupportedClient(),
      async post<T>(
        path: string,
        body?: unknown,
        options?: { authenticated?: boolean },
      ): Promise<T> {
        calls.push({
          path,
          body,
          authenticated: options?.authenticated,
        });
        return upload as T;
      },
    };

    const result = await createPaymentService(client).requestSlipUploadUrl(
      "org 1",
      "order 1",
      "image/png",
    );

    expect(result).toEqual(upload);
    expect(calls).toEqual([
      {
        path:
          "/organizations/org%201/orders/order%201/payment-slip-upload-url",
        body: { contentType: "image/png" },
        authenticated: true,
      },
    ]);
  });

  it("submits only the Backend-issued slipKey after direct upload", async () => {
    const calls: Array<{
      path: string;
      body: unknown;
      authenticated?: boolean;
    }> = [];

    const client: PaymentClient = {
      ...unsupportedClient(),
      async post<T>(
        path: string,
        body?: unknown,
        options?: { authenticated?: boolean },
      ): Promise<T> {
        calls.push({
          path,
          body,
          authenticated: options?.authenticated,
        });
        return submittedPayment as T;
      },
    };

    const result = await createPaymentService(client).submitPayment(
      "org-1",
      "order-1",
      "payments/org-1/order-1/file-1",
    );

    expect(result).toEqual(submittedPayment);
    expect(calls).toEqual([
      {
        path:
          "/organizations/org-1/orders/order-1/payment",
        body: {
          slipKey: "payments/org-1/order-1/file-1",
        },
        authenticated: true,
      },
    ]);
  });

  it("uses documented organization review filters, detail, private download, approve, and reject endpoints", async () => {
    const calls: Array<{
      method: string;
      path: string;
      query?: unknown;
      body?: unknown;
      authenticated?: boolean;
    }> = [];

    const client: PaymentClient = {
      ...unsupportedClient(),
      async getList<T>(
        path: string,
        options?: {
          authenticated?: boolean;
          query?: Record<
            string,
            string | number | boolean | null | undefined
          >;
          signal?: AbortSignal;
        },
      ): Promise<ApiListData<T>> {
        calls.push({
          method: "GET_LIST",
          path,
          query: options?.query,
          authenticated: options?.authenticated,
        });
        return {
          items: [submittedPayment] as T[],
          nextCursor: "opaque-next",
        };
      },
      async get<T>(
        path: string,
        options?: {
          authenticated?: boolean;
          signal?: AbortSignal;
        },
      ): Promise<T> {
        calls.push({
          method: "GET",
          path,
          authenticated: options?.authenticated,
        });
        return submittedPayment as T;
      },
      async post<T>(
        path: string,
        body?: unknown,
        options?: { authenticated?: boolean },
      ): Promise<T> {
        calls.push({
          method: "POST",
          path,
          body,
          authenticated: options?.authenticated,
        });

        if (path.endsWith("/files/download-url")) {
          return download as T;
        }

        return submittedPayment as T;
      },
    };

    const service = createPaymentService(client);

    const list = await service.listOrganizationPayments(
      "org 1",
      {
        status: "PENDING_REVIEW",
        campaignId: "campaign 1",
        orderId: "order 1",
        cursor: "opaque-current",
      },
    );
    await service.getOrganizationPayment("org 1", "payment 1");
    const downloadResult =
      await service.requestPrivateDownloadUrl(
        "org 1",
        "payments/org 1/order 1/file 1",
      );
    await service.approvePayment("org 1", "payment 1");
    await service.rejectPayment(
      "org 1",
      "payment 1",
      "Slip amount mismatch",
    );

    expect(list.nextCursor).toBe("opaque-next");
    expect(downloadResult).toEqual(download);
    expect(calls).toEqual([
      {
        method: "GET_LIST",
        path: "/organizations/org%201/payments",
        query: {
          status: "PENDING_REVIEW",
          campaignId: "campaign 1",
          orderId: "order 1",
          cursor: "opaque-current",
        },
        authenticated: true,
      },
      {
        method: "GET",
        path: "/organizations/org%201/payments/payment%201",
        authenticated: true,
      },
      {
        method: "POST",
        path: "/organizations/org%201/files/download-url",
        body: {
          objectKey: "payments/org 1/order 1/file 1",
        },
        authenticated: true,
      },
      {
        method: "POST",
        path: "/organizations/org%201/payments/payment%201/approve",
        body: undefined,
        authenticated: true,
      },
      {
        method: "POST",
        path: "/organizations/org%201/payments/payment%201/reject",
        body: {
          reason: "Slip amount mismatch",
        },
        authenticated: true,
      },
    ]);
  });
});
