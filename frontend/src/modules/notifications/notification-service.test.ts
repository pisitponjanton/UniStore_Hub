import { describe, expect, it } from "vitest";

import type { ApiListData, NotificationDTO } from "@/types";

import {
  createNotificationService,
  type NotificationClient,
} from "./notification-service";

const notification: NotificationDTO = {
  notificationId: "notification-1",
  userId: "user-1",
  type: "PAYMENT_APPROVED",
  title: "Payment Approved",
  message: "ชำระเงินผ่านการอนุมัติแล้ว",
  resourceType: "PAYMENT",
  resourceId: "payment-1",
  readAt: null,
  createdAt: "2026-09-29T12:00:00.000Z",
};

describe("notification service", () => {
  it("lists current-user notifications with read filter and opaque cursor", async () => {
    const calls: Array<{
      path: string;
      read?: unknown;
      cursor?: unknown;
      authenticated?: boolean;
    }> = [];

    const client: NotificationClient = {
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
          path,
          read: options?.query?.read,
          cursor: options?.query?.cursor,
          authenticated: options?.authenticated,
        });

        return {
          items: [notification] as T[],
          nextCursor: "opaque-next",
        };
      },
      async patch<T>(): Promise<T> {
        throw new Error("unexpected patch");
      },
    };

    const result = await createNotificationService(
      client,
    ).listNotifications({
      filter: "unread",
      cursor: "opaque-current",
    });

    expect(result.nextCursor).toBe("opaque-next");
    expect(calls).toEqual([
      {
        path: "/notifications",
        read: false,
        cursor: "opaque-current",
        authenticated: true,
      },
    ]);
  });

  it("omits read filter for the all view", async () => {
    const client: NotificationClient = {
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
        expect(path).toBe("/notifications");
        expect(options?.query?.read).toBeUndefined();

        return {
          items: [] as T[],
          nextCursor: null,
        };
      },
      async patch<T>(): Promise<T> {
        throw new Error("unexpected patch");
      },
    };

    await createNotificationService(client).listNotifications({
      filter: "all",
    });
  });

  it("marks only the selected notification read through PATCH", async () => {
    const updated: NotificationDTO = {
      ...notification,
      readAt: "2026-09-29T13:00:00.000Z",
    };
    const calls: Array<{
      path: string;
      body: unknown;
      authenticated?: boolean;
    }> = [];

    const client: NotificationClient = {
      async getList<T>(): Promise<ApiListData<T>> {
        throw new Error("unexpected list");
      },
      async patch<T>(
        path: string,
        body?: unknown,
        options?: { authenticated?: boolean },
      ): Promise<T> {
        calls.push({
          path,
          body,
          authenticated: options?.authenticated,
        });
        return updated as T;
      },
    };

    const result = await createNotificationService(client).markRead(
      "notification 1",
    );

    expect(result).toEqual(updated);
    expect(calls).toEqual([
      {
        path: "/notifications/notification%201/read",
        body: undefined,
        authenticated: true,
      },
    ]);
  });
});
