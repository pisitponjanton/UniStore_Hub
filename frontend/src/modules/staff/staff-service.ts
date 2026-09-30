import { apiClient } from "@/services";
import type {
  ApiListData,
  EntityId,
  MembershipRole,
  OrganizationMemberDTO,
} from "@/types";

export interface StaffClient {
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
  delete(
    path: string,
    options?: { authenticated?: boolean },
  ): Promise<void>;
}

export interface StaffService {
  list(
    organizationId: EntityId,
    options?: { signal?: AbortSignal },
  ): Promise<OrganizationMemberDTO[]>;
  add(
    organizationId: EntityId,
    input: { email: string; role: MembershipRole },
  ): Promise<OrganizationMemberDTO>;
  updateRole(
    organizationId: EntityId,
    userId: EntityId,
    role: MembershipRole,
  ): Promise<OrganizationMemberDTO>;
  remove(
    organizationId: EntityId,
    userId: EntityId,
  ): Promise<void>;
}

function membersPath(organizationId: EntityId): string {
  return `/organizations/${encodeURIComponent(organizationId)}/members`;
}

export function createStaffService(
  client: StaffClient = apiClient,
): StaffService {
  return {
    async list(organizationId, options = {}) {
      const result = await client.getList<OrganizationMemberDTO>(
        membersPath(organizationId),
        {
          authenticated: true,
          signal: options.signal,
        },
      );

      return result.items;
    },

    add(organizationId, input) {
      return client.post<OrganizationMemberDTO>(
        membersPath(organizationId),
        input,
        { authenticated: true },
      );
    },

    updateRole(organizationId, userId, role) {
      return client.patch<OrganizationMemberDTO>(
        `${membersPath(organizationId)}/${encodeURIComponent(userId)}`,
        { role },
        { authenticated: true },
      );
    },

    remove(organizationId, userId) {
      return client.delete(
        `${membersPath(organizationId)}/${encodeURIComponent(userId)}`,
        { authenticated: true },
      );
    },
  };
}

export const staffService = createStaffService();
