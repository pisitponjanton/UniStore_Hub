import { apiClient } from "@/services";
import type {
  ApiListData,
  CampaignDTO,
  CampaignStatus,
  Cursor,
  EntityId,
  IsoDateTime,
} from "@/types";

export interface CampaignClient {
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
  patch<T>(
    path: string,
    body?: unknown,
    options?: { authenticated?: boolean },
  ): Promise<T>;
}

export interface CampaignFormInput {
  storeId: EntityId;
  name: string;
  openAt: IsoDateTime | null;
  closeAt: IsoDateTime | null;
  paymentDeadline: IsoDateTime | null;
  pickupAt: IsoDateTime | null;
}

export type CampaignUpdateInput = Partial<CampaignFormInput>;

export type CampaignLifecycleAction =
  | "open"
  | "close"
  | "start-production"
  | "ready-for-pickup"
  | "complete"
  | "cancel";

export interface CampaignService {
  list(
    organizationId: EntityId,
    options?: {
      storeId?: EntityId | null;
      status?: CampaignStatus | null;
      cursor?: Cursor | null;
      signal?: AbortSignal;
    },
  ): Promise<ApiListData<CampaignDTO>>;
  create(
    organizationId: EntityId,
    input: CampaignFormInput,
  ): Promise<CampaignDTO>;
  get(
    organizationId: EntityId,
    campaignId: EntityId,
    options?: { signal?: AbortSignal },
  ): Promise<CampaignDTO>;
  update(
    organizationId: EntityId,
    campaignId: EntityId,
    input: CampaignUpdateInput,
  ): Promise<CampaignDTO>;
  transition(
    organizationId: EntityId,
    campaignId: EntityId,
    action: CampaignLifecycleAction,
  ): Promise<CampaignDTO>;
}

function campaignsPath(organizationId: EntityId): string {
  return `/organizations/${encodeURIComponent(organizationId)}/campaigns`;
}

export function createCampaignService(
  client: CampaignClient = apiClient,
): CampaignService {
  return {
    list(organizationId, options = {}) {
      return client.getList<CampaignDTO>(
        campaignsPath(organizationId),
        {
          authenticated: true,
          query: {
            storeId: options.storeId ?? undefined,
            status: options.status ?? undefined,
            cursor: options.cursor ?? undefined,
          },
          signal: options.signal,
        },
      );
    },

    create(organizationId, input) {
      return client.post<CampaignDTO>(
        campaignsPath(organizationId),
        input,
        { authenticated: true },
      );
    },

    get(organizationId, campaignId, options = {}) {
      return client.get<CampaignDTO>(
        `${campaignsPath(organizationId)}/${encodeURIComponent(campaignId)}`,
        {
          authenticated: true,
          signal: options.signal,
        },
      );
    },

    update(organizationId, campaignId, input) {
      return client.patch<CampaignDTO>(
        `${campaignsPath(organizationId)}/${encodeURIComponent(campaignId)}`,
        input,
        { authenticated: true },
      );
    },

    transition(organizationId, campaignId, action) {
      return client.post<CampaignDTO>(
        `${campaignsPath(organizationId)}/${encodeURIComponent(campaignId)}/${action}`,
        undefined,
        { authenticated: true },
      );
    },
  };
}

export const campaignService = createCampaignService();
