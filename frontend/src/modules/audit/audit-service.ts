import { apiClient } from "@/services";
import type {
  ApiListData,
  AuditLogDTO,
  Cursor,
  EntityId,
} from "@/types";

export interface AuditClient {
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
}

export interface AuditService {
  list(
    organizationId: EntityId,
    options?: {
      actorId?: EntityId | null;
      action?: string | null;
      resourceType?: string | null;
      resourceId?: EntityId | null;
      cursor?: Cursor | null;
      signal?: AbortSignal;
    },
  ): Promise<ApiListData<AuditLogDTO>>;
}

export function createAuditService(
  client: AuditClient = apiClient,
): AuditService {
  return {
    list(organizationId, options = {}) {
      return client.getList<AuditLogDTO>(
        `/organizations/${encodeURIComponent(organizationId)}/audit-logs`,
        {
          authenticated: true,
          query: {
            actorId: options.actorId ?? undefined,
            action: options.action ?? undefined,
            resourceType: options.resourceType ?? undefined,
            resourceId: options.resourceId ?? undefined,
            cursor: options.cursor ?? undefined,
          },
          signal: options.signal,
        },
      );
    },
  };
}

export const auditService = createAuditService();
