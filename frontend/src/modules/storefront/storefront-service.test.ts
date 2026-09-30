import { describe, expect, it } from "vitest";

import type {
  ApiListData,
  CampaignDTO,
  StorefrontProductDTO,
} from "@/types";

import {
  createStorefrontService,
  type StorefrontClient,
  type StorefrontOrganizationDTO,
  type StorefrontStoreDTO,
} from "./storefront-service";

const organization: StorefrontOrganizationDTO = {
  organizationId: "org 1",
  name: "IT KMITL",
  description: "Organization",
  status: "ACTIVE",
};

const store: StorefrontStoreDTO = {
  storeId: "store-1",
  organizationId: "org 1",
  name: "Faculty Store",
  description: "Store",
  status: "ACTIVE",
};

const product: StorefrontProductDTO = {
  productId: "product-1",
  organizationId: "org 1",
  storeId: "store-1",
  name: "Faculty Shirt",
  description: "Shirt",
  imageUrl: null,
  status: "ACTIVE",
  variants: [],
  createdAt: "2026-09-28T14:30:00.000Z",
  updatedAt: "2026-09-28T14:30:00.000Z",
};

const campaign: CampaignDTO = {
  campaignId: "campaign-1",
  organizationId: "org 1",
  storeId: "store-1",
  name: "Faculty Shirt Pre-order",
  openAt: "2026-10-01T00:00:00.000Z",
  closeAt: "2026-10-10T23:59:59.000Z",
  paymentDeadline: "2026-10-11T23:59:59.000Z",
  pickupAt: "2026-10-25T09:00:00.000Z",
  status: "OPEN",
  createdAt: "2026-09-28T14:30:00.000Z",
  updatedAt: "2026-09-28T14:30:00.000Z",
};

function emptyPage<T>(): ApiListData<T> {
  return { items: [], nextCursor: null };
}

describe("storefront service", () => {
  it("uses only documented public storefront organization/store endpoints", async () => {
    const calledPaths: string[] = [];
    const client: StorefrontClient = {
      async get<T>(): Promise<T> {
        throw new Error("Unexpected detail request");
      },
      async getList<T>(path: string): Promise<ApiListData<T>> {
        calledPaths.push(path);

        if (path === "/storefront/organizations") {
          return {
            items: [organization] as T[],
            nextCursor: null,
          };
        }

        if (path === "/storefront/organizations/org%201/stores") {
          return {
            items: [store] as T[],
            nextCursor: null,
          };
        }

        throw new Error(`Unexpected endpoint: ${path}`);
      },
    };

    const result = await createStorefrontService(client).getLanding();

    expect(result).toEqual([{ organization, stores: [store] }]);
    expect(calledPaths).toEqual([
      "/storefront/organizations",
      "/storefront/organizations/org%201/stores",
    ]);
  });

  it("loads store detail, products, and campaigns from public storefront paths", async () => {
    const detailPaths: string[] = [];
    const listPaths: string[] = [];
    const client: StorefrontClient = {
      async get<T>(path: string): Promise<T> {
        detailPaths.push(path);
        return store as T;
      },
      async getList<T>(path: string): Promise<ApiListData<T>> {
        listPaths.push(path);

        if (path.endsWith("/products")) {
          return { items: [product] as T[], nextCursor: null };
        }

        if (path.endsWith("/campaigns")) {
          return { items: [campaign] as T[], nextCursor: null };
        }

        return emptyPage<T>();
      },
    };

    const result = await createStorefrontService(client).getStoreView(
      "org 1",
      "store-1",
    );

    expect(result).toEqual({
      store,
      products: [product],
      campaigns: [campaign],
    });
    expect(detailPaths).toEqual([
      "/storefront/organizations/org%201/stores/store-1",
    ]);
    expect(listPaths).toEqual([
      "/storefront/organizations/org%201/stores/store-1/products",
      "/storefront/organizations/org%201/stores/store-1/campaigns",
    ]);
  });

  it("resolves the canonical campaign route using documented storefront paths without requiring storeId in the route", async () => {
    const detailPaths: string[] = [];
    const client: StorefrontClient = {
      async get<T>(path: string): Promise<T> {
        detailPaths.push(path);
        return campaign as T;
      },
      async getList<T>(path: string): Promise<ApiListData<T>> {
        if (path === "/storefront/organizations/org%201/stores") {
          return { items: [store] as T[], nextCursor: null };
        }

        if (path.endsWith("/campaigns")) {
          return { items: [campaign] as T[], nextCursor: null };
        }

        if (path.endsWith("/products")) {
          return { items: [product] as T[], nextCursor: null };
        }

        return emptyPage<T>();
      },
    };

    const result = await createStorefrontService(client).getCampaignView(
      "org 1",
      "campaign-1",
    );

    expect(result).toEqual({
      store,
      campaign,
      products: [product],
    });
    expect(detailPaths).toEqual([
      "/storefront/organizations/org%201/stores/store-1/campaigns/campaign-1",
    ]);
  });

  it("follows opaque cursor pagination without parsing cursor contents", async () => {
    const cursors: Array<string | undefined> = [];
    const client: StorefrontClient = {
      async get<T>(): Promise<T> {
        throw new Error("Unexpected detail request");
      },
      async getList<T>(
        path: string,
        options?: {
          signal?: AbortSignal;
          query?: Record<
            string,
            string | number | boolean | null | undefined
          >;
        },
      ): Promise<ApiListData<T>> {
        const cursor = options?.query?.cursor;
        cursors.push(typeof cursor === "string" ? cursor : undefined);

        if (path === "/storefront/organizations") {
          if (!cursor) {
            return {
              items: [organization] as T[],
              nextCursor: "opaque-next",
            };
          }

          return { items: [], nextCursor: null };
        }

        return { items: [store] as T[], nextCursor: null };
      },
    };

    await createStorefrontService(client).getLanding();

    expect(cursors.slice(0, 2)).toEqual([undefined, "opaque-next"]);
  });

  it("reports a missing public campaign as a typed not-found error", async () => {
    const client: StorefrontClient = {
      async get<T>(): Promise<T> {
        throw new Error("Unexpected detail request");
      },
      async getList<T>(path: string): Promise<ApiListData<T>> {
        if (path === "/storefront/organizations/org%201/stores") {
          return { items: [store] as T[], nextCursor: null };
        }

        return emptyPage<T>();
      },
    };

    await expect(
      createStorefrontService(client).getCampaignView(
        "org 1",
        "missing-campaign",
      ),
    ).rejects.toMatchObject({
      status: 404,
      code: "CAMPAIGN_NOT_FOUND",
      kind: "notFound",
    });
  });
  it("resolves public product detail through the product store and keeps only active variants", async () => {
    const inactiveVariant = {
      ...(product.variants?.[0] ?? {
        variantId: "variant-inactive",
        organizationId: "org 1",
        productId: "product-1",
        name: "Inactive",
        price: 10000,
        status: "INACTIVE" as const,
        createdAt: "2026-09-28T14:30:00.000Z",
        updatedAt: "2026-09-28T14:30:00.000Z",
      }),
      variantId: "variant-inactive",
      status: "INACTIVE" as const,
    };
    const activeVariant = {
      ...inactiveVariant,
      variantId: "variant-active",
      name: "Active",
      status: "ACTIVE" as const,
    };
    const detailedProduct = {
      ...product,
      variants: [activeVariant, inactiveVariant],
    };
    const detailPaths: string[] = [];

    const client: StorefrontClient = {
      async get<T>(path: string): Promise<T> {
        detailPaths.push(path);
        return detailedProduct as T;
      },
      async getList<T>(path: string): Promise<ApiListData<T>> {
        if (path === "/storefront/organizations/org%201/stores") {
          return { items: [store] as T[], nextCursor: null };
        }

        if (path.endsWith("/products")) {
          return { items: [product] as T[], nextCursor: null };
        }

        if (path.endsWith("/campaigns")) {
          return { items: [campaign] as T[], nextCursor: null };
        }

        return emptyPage<T>();
      },
    };

    const result = await createStorefrontService(client).getProductView(
      "org 1",
      "product-1",
    );

    expect(detailPaths).toEqual([
      "/storefront/organizations/org%201/stores/store-1/products/product-1",
    ]);
    expect(result.store).toEqual(store);
    expect(result.campaigns).toEqual([campaign]);
    expect(result.product.variants).toEqual([activeVariant]);
  });

});
