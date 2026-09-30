import { describe, expect, it } from "vitest";

import type { ApiListData, ProductDTO } from "@/types";

import {
  createProductService,
  type ProductClient,
} from "./product-service";

const product: ProductDTO = {
  productId: "product-1",
  organizationId: "org-1",
  storeId: "store-1",
  name: "Faculty Shirt",
  description: "Pre-order shirt",
  imageKey: null,
  imageUrl: null,
  status: "ACTIVE",
  createdAt: "2026-09-29T10:00:00.000Z",
  updatedAt: "2026-09-29T10:00:00.000Z",
};

function unsupportedClient(): ProductClient {
  return {
    async get<T>(): Promise<T> {
      throw new Error("unexpected get");
    },
    async getList<T>(): Promise<ApiListData<T>> {
      throw new Error("unexpected list");
    },
    async post<T>(): Promise<T> {
      throw new Error("unexpected post");
    },
    async patch<T>(): Promise<T> {
      throw new Error("unexpected patch");
    },
    async delete(): Promise<void> {
      throw new Error("unexpected delete");
    },
  };
}

describe("product service", () => {
  it("uses documented management endpoints, store filter, and opaque cursor", async () => {
    const calls: Array<{
      method: string;
      path: string;
      query?: unknown;
      body?: unknown;
      authenticated?: boolean;
    }> = [];

    const client: ProductClient = {
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
          items: [product] as T[],
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
        return product as T;
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
        return product as T;
      },
      async patch<T>(
        path: string,
        body?: unknown,
        options?: { authenticated?: boolean },
      ): Promise<T> {
        calls.push({
          method: "PATCH",
          path,
          body,
          authenticated: options?.authenticated,
        });
        return {
          ...product,
          name: "Updated Shirt",
        } as T;
      },
      async delete(
        path: string,
        options?: { authenticated?: boolean },
      ): Promise<void> {
        calls.push({
          method: "DELETE",
          path,
          authenticated: options?.authenticated,
        });
      },
    };

    const service = createProductService(client);

    const result = await service.list("org 1", {
      storeId: "store 1",
      cursor: "opaque-current",
    });
    await service.create("org 1", {
      storeId: "store-1",
      name: "Faculty Shirt",
      description: "Pre-order shirt",
    });
    await service.get("org 1", "product 1");
    await service.update("org 1", "product 1", {
      name: "Updated Shirt",
      description: "Updated",
    });
    await service.deactivate("org 1", "product 1");

    expect(result.nextCursor).toBe("opaque-next");
    expect(calls).toEqual([
      {
        method: "GET_LIST",
        path: "/organizations/org%201/products",
        query: {
          storeId: "store 1",
          cursor: "opaque-current",
        },
        authenticated: true,
      },
      {
        method: "POST",
        path: "/organizations/org%201/products",
        body: {
          storeId: "store-1",
          name: "Faculty Shirt",
          description: "Pre-order shirt",
        },
        authenticated: true,
      },
      {
        method: "GET",
        path: "/organizations/org%201/products/product%201",
        authenticated: true,
      },
      {
        method: "PATCH",
        path: "/organizations/org%201/products/product%201",
        body: {
          name: "Updated Shirt",
          description: "Updated",
        },
        authenticated: true,
      },
      {
        method: "DELETE",
        path: "/organizations/org%201/products/product%201",
        authenticated: true,
      },
    ]);
  });

  it("uses documented nested Variant endpoints without sending THB decimals", async () => {
    const calls: Array<{
      method: string;
      path: string;
      body?: unknown;
      authenticated?: boolean;
    }> = [];

    const variant = {
      variantId: "variant-1",
      organizationId: "org-1",
      productId: "product-1",
      name: "Size M",
      price: 25000,
      status: "ACTIVE" as const,
      createdAt: "2026-09-29T10:00:00.000Z",
      updatedAt: "2026-09-29T10:00:00.000Z",
    };

    const client: ProductClient = {
      ...unsupportedClient(),
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
        return variant as T;
      },
      async patch<T>(
        path: string,
        body?: unknown,
        options?: { authenticated?: boolean },
      ): Promise<T> {
        calls.push({
          method: "PATCH",
          path,
          body,
          authenticated: options?.authenticated,
        });
        return {
          ...variant,
          name: "Size L",
          price: 27050,
        } as T;
      },
      async delete(
        path: string,
        options?: { authenticated?: boolean },
      ): Promise<void> {
        calls.push({
          method: "DELETE",
          path,
          authenticated: options?.authenticated,
        });
      },
    };

    const service = createProductService(client);

    await service.createVariant("org 1", "product 1", {
      name: "Size M",
      price: 25000,
    });
    await service.updateVariant(
      "org 1",
      "product 1",
      "variant 1",
      {
        name: "Size L",
        price: 27050,
      },
    );
    await service.deactivateVariant(
      "org 1",
      "product 1",
      "variant 1",
    );

    expect(calls).toEqual([
      {
        method: "POST",
        path: "/organizations/org%201/products/product%201/variants",
        body: {
          name: "Size M",
          price: 25000,
        },
        authenticated: true,
      },
      {
        method: "PATCH",
        path: "/organizations/org%201/products/product%201/variants/variant%201",
        body: {
          name: "Size L",
          price: 27050,
        },
        authenticated: true,
      },
      {
        method: "DELETE",
        path: "/organizations/org%201/products/product%201/variants/variant%201",
        authenticated: true,
      },
    ]);
  });

  it("requests a Product Image presign and persists only the returned imageKey", async () => {
    const calls: Array<{
      method: string;
      path: string;
      body?: unknown;
      authenticated?: boolean;
    }> = [];
    const upload = {
      objectKey: "products/org-1/product-1/image-1",
      url: "https://signed.example/upload",
      method: "PUT" as const,
      expiresInSeconds: 900,
    };

    const client: ProductClient = {
      ...unsupportedClient(),
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
        return upload as T;
      },
      async patch<T>(
        path: string,
        body?: unknown,
        options?: { authenticated?: boolean },
      ): Promise<T> {
        calls.push({
          method: "PATCH",
          path,
          body,
          authenticated: options?.authenticated,
        });
        return {
          ...product,
          imageKey: upload.objectKey,
        } as T;
      },
    };

    const service = createProductService(client);

    const signed = await service.requestImageUploadUrl(
      "org 1",
      "product 1",
      "image/webp",
    );
    await service.update("org 1", "product 1", {
      imageKey: signed.objectKey,
    });

    expect(signed).toEqual(upload);
    expect(calls).toEqual([
      {
        method: "POST",
        path: "/organizations/org%201/products/product%201/image-upload-url",
        body: {
          contentType: "image/webp",
        },
        authenticated: true,
      },
      {
        method: "PATCH",
        path: "/organizations/org%201/products/product%201",
        body: {
          imageKey: "products/org-1/product-1/image-1",
        },
        authenticated: true,
      },
    ]);
  });
});
