import { apiClient } from "@/services";
import type {
  ApiListData,
  Cursor,
  EntityId,
  NotificationDTO,
} from "@/types";

export type NotificationReadFilter = "all" | "unread" | "read";

export interface NotificationClient {
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
  patch<T>(
    path: string,
    body?: unknown,
    options?: { authenticated?: boolean },
  ): Promise<T>;
}

export interface NotificationService {
  listNotifications(options?: {
    filter?: NotificationReadFilter;
    cursor?: Cursor | null;
    signal?: AbortSignal;
  }): Promise<ApiListData<NotificationDTO>>;
  markRead(notificationId: EntityId): Promise<NotificationDTO>;
}

function readQueryValue(
  filter: NotificationReadFilter,
): boolean | undefined {
  if (filter === "unread") {
    return false;
  }

  if (filter === "read") {
    return true;
  }

  return undefined;
}

export function createNotificationService(
  client: NotificationClient = apiClient,
): NotificationService {
  return {
    listNotifications(options = {}) {
      const filter = options.filter ?? "all";

      return client.getList<NotificationDTO>("/notifications", {
        authenticated: true,
        query: {
          read: readQueryValue(filter),
          cursor: options.cursor ?? undefined,
        },
        signal: options.signal,
      });
    },

    markRead(notificationId) {
      return client.patch<NotificationDTO>(
        `/notifications/${encodeURIComponent(notificationId)}/read`,
        undefined,
        { authenticated: true },
      );
    },
  };
}

export const notificationService = createNotificationService();
