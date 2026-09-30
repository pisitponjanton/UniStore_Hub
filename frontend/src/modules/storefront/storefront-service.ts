import { ApiClientError, apiClient } from "@/services";
import type {
  ApiListData,
  CampaignDTO,
  OrganizationDTO,
  StoreDTO,
  StorefrontProductDTO,
} from "@/types";

export type StorefrontOrganizationDTO = Pick<
  OrganizationDTO,
  "organizationId" | "name" | "description" | "status"
>;

export type StorefrontStoreDTO = Pick<
  StoreDTO,
  "storeId" | "organizationId" | "name" | "description" | "status"
>;

export interface StorefrontLandingOrganization {
  organization: StorefrontOrganizationDTO;
  stores: StorefrontStoreDTO[];
}

export interface StorefrontStoreView {
  store: StorefrontStoreDTO;
  products: StorefrontProductDTO[];
  campaigns: CampaignDTO[];
}

export interface StorefrontCampaignView {
  store: StorefrontStoreDTO;
  campaign: CampaignDTO;
  products: StorefrontProductDTO[];
}

export interface StorefrontProductView {
  store: StorefrontStoreDTO;
  product: StorefrontProductDTO;
  campaigns: CampaignDTO[];
}

export interface StorefrontClient {
  get<T>(
    path: string,
    options?: {
      signal?: AbortSignal;
      query?: Record<string, string | number | boolean | null | undefined>;
    },
  ): Promise<T>;
  getList<T>(
    path: string,
    options?: {
      signal?: AbortSignal;
      query?: Record<string, string | number | boolean | null | undefined>;
    },
  ): Promise<ApiListData<T>>;
}

export interface StorefrontService {
  getLanding(options?: {
    signal?: AbortSignal;
  }): Promise<StorefrontLandingOrganization[]>;
  getStoreView(
    organizationId: string,
    storeId: string,
    options?: { signal?: AbortSignal },
  ): Promise<StorefrontStoreView>;
  getCampaignView(
    organizationId: string,
    campaignId: string,
    options?: { signal?: AbortSignal },
  ): Promise<StorefrontCampaignView>;
  getProductView(
    organizationId: string,
    productId: string,
    options?: { signal?: AbortSignal },
  ): Promise<StorefrontProductView>;
}

function organizationBasePath(organizationId: string): string {
  return `/storefront/organizations/${encodeURIComponent(organizationId)}`;
}

function storeBasePath(organizationId: string, storeId: string): string {
  return `${organizationBasePath(
    organizationId,
  )}/stores/${encodeURIComponent(storeId)}`;
}

async function getAllPages<T>(
  client: StorefrontClient,
  path: string,
  signal?: AbortSignal,
): Promise<T[]> {
  const items: T[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | null = null;

  do {
    const page: ApiListData<T> = await client.getList<T>(path, {
      signal,
      query: cursor ? { cursor } : undefined,
    });

    items.push(...page.items);

    if (!page.nextCursor) {
      return items;
    }

    if (seenCursors.has(page.nextCursor)) {
      throw new ApiClientError({
        status: 500,
        code: "INTERNAL_ERROR",
        kind: "unexpected",
        message: "The storefront returned a repeated pagination cursor.",
      });
    }

    seenCursors.add(page.nextCursor);
    cursor = page.nextCursor;
  } while (cursor);

  return items;
}

export function createStorefrontService(
  client: StorefrontClient = apiClient,
): StorefrontService {
  return {
    async getLanding(options = {}) {
      const organizations = await getAllPages<StorefrontOrganizationDTO>(
        client,
        "/storefront/organizations",
        options.signal,
      );

      const activeOrganizations = organizations.filter(
        (organization) => organization.status === "ACTIVE",
      );

      return Promise.all(
        activeOrganizations.map(async (organization) => {
          const stores = await getAllPages<StorefrontStoreDTO>(
            client,
            `${organizationBasePath(organization.organizationId)}/stores`,
            options.signal,
          );

          return {
            organization,
            stores: stores.filter((store) => store.status === "ACTIVE"),
          };
        }),
      );
    },

    async getStoreView(organizationId, storeId, options = {}) {
      const basePath = storeBasePath(organizationId, storeId);

      const [store, products, campaigns] = await Promise.all([
        client.get<StorefrontStoreDTO>(basePath, {
          signal: options.signal,
        }),
        getAllPages<StorefrontProductDTO>(
          client,
          `${basePath}/products`,
          options.signal,
        ),
        getAllPages<CampaignDTO>(
          client,
          `${basePath}/campaigns`,
          options.signal,
        ),
      ]);

      return {
        store,
        products,
        campaigns,
      };
    },

    async getCampaignView(organizationId, campaignId, options = {}) {
      const stores = await getAllPages<StorefrontStoreDTO>(
        client,
        `${organizationBasePath(organizationId)}/stores`,
        options.signal,
      );

      for (const store of stores) {
        const basePath = storeBasePath(organizationId, store.storeId);
        const campaigns = await getAllPages<CampaignDTO>(
          client,
          `${basePath}/campaigns`,
          options.signal,
        );
        const campaign = campaigns.find(
          (item) => item.campaignId === campaignId,
        );

        if (!campaign) {
          continue;
        }

        const [authoritativeCampaign, products] = await Promise.all([
          client.get<CampaignDTO>(
            `${basePath}/campaigns/${encodeURIComponent(campaignId)}`,
            { signal: options.signal },
          ),
          getAllPages<StorefrontProductDTO>(
            client,
            `${basePath}/products`,
            options.signal,
          ),
        ]);

        return {
          store,
          campaign: authoritativeCampaign,
          products,
        };
      }

      throw new ApiClientError({
        status: 404,
        code: "CAMPAIGN_NOT_FOUND",
        kind: "notFound",
      });
    },

    async getProductView(organizationId, productId, options = {}) {
      const stores = await getAllPages<StorefrontStoreDTO>(
        client,
        `${organizationBasePath(organizationId)}/stores`,
        options.signal,
      );

      for (const store of stores) {
        const basePath = storeBasePath(organizationId, store.storeId);
        const products = await getAllPages<StorefrontProductDTO>(
          client,
          `${basePath}/products`,
          options.signal,
        );
        const product = products.find((item) => item.productId === productId);

        if (!product) {
          continue;
        }

        const [authoritativeProduct, campaigns] = await Promise.all([
          client.get<StorefrontProductDTO>(
            `${basePath}/products/${encodeURIComponent(productId)}`,
            { signal: options.signal },
          ),
          getAllPages<CampaignDTO>(
            client,
            `${basePath}/campaigns`,
            options.signal,
          ),
        ]);

        return {
          store,
          product: {
            ...authoritativeProduct,
            variants: (authoritativeProduct.variants ?? []).filter(
              (variant) => variant.status === "ACTIVE",
            ),
          },
          campaigns,
        };
      }

      throw new ApiClientError({
        status: 404,
        code: "PRODUCT_NOT_FOUND",
        kind: "notFound",
      });
    },
  };
}

export const storefrontService = createStorefrontService();
