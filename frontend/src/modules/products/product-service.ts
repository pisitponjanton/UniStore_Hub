import { apiClient } from "@/services";
import type {
  ApiListData,
  Cursor,
  EntityId,
  ProductDTO,
  ProductVariantDTO,
  PresignedUploadDTO,
  AllowedUploadContentType,
} from "@/types";

export interface ProductClient {
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
  delete(
    path: string,
    options?: { authenticated?: boolean },
  ): Promise<void>;
}

export interface ProductFormInput {
  storeId: EntityId;
  name: string;
  description: string;
}

export interface ProductUpdateInput {
  name?: string;
  description?: string;
  imageKey?: string | null;
}

export interface VariantFormInput {
  name: string;
  price: number;
}

export interface VariantUpdateInput {
  name?: string;
  price?: number;
}

export interface ProductService {
  list(
    organizationId: EntityId,
    options?: {
      storeId?: EntityId | null;
      cursor?: Cursor | null;
      signal?: AbortSignal;
    },
  ): Promise<ApiListData<ProductDTO>>;
  create(
    organizationId: EntityId,
    input: ProductFormInput,
  ): Promise<ProductDTO>;
  get(
    organizationId: EntityId,
    productId: EntityId,
    options?: { signal?: AbortSignal },
  ): Promise<ProductDTO>;
  update(
    organizationId: EntityId,
    productId: EntityId,
    input: ProductUpdateInput,
  ): Promise<ProductDTO>;
  deactivate(
    organizationId: EntityId,
    productId: EntityId,
  ): Promise<void>;
  createVariant(
    organizationId: EntityId,
    productId: EntityId,
    input: VariantFormInput,
  ): Promise<ProductVariantDTO>;
  updateVariant(
    organizationId: EntityId,
    productId: EntityId,
    variantId: EntityId,
    input: VariantUpdateInput,
  ): Promise<ProductVariantDTO>;
  deactivateVariant(
    organizationId: EntityId,
    productId: EntityId,
    variantId: EntityId,
  ): Promise<void>;
  requestImageUploadUrl(
    organizationId: EntityId,
    productId: EntityId,
    contentType: AllowedUploadContentType,
  ): Promise<PresignedUploadDTO>;
}

function productsPath(organizationId: EntityId): string {
  return `/organizations/${encodeURIComponent(organizationId)}/products`;
}

export function createProductService(
  client: ProductClient = apiClient,
): ProductService {
  return {
    list(organizationId, options = {}) {
      return client.getList<ProductDTO>(
        productsPath(organizationId),
        {
          authenticated: true,
          query: {
            storeId: options.storeId ?? undefined,
            cursor: options.cursor ?? undefined,
          },
          signal: options.signal,
        },
      );
    },

    create(organizationId, input) {
      return client.post<ProductDTO>(
        productsPath(organizationId),
        input,
        { authenticated: true },
      );
    },

    get(organizationId, productId, options = {}) {
      return client.get<ProductDTO>(
        `${productsPath(organizationId)}/${encodeURIComponent(productId)}`,
        {
          authenticated: true,
          signal: options.signal,
        },
      );
    },

    update(organizationId, productId, input) {
      return client.patch<ProductDTO>(
        `${productsPath(organizationId)}/${encodeURIComponent(productId)}`,
        input,
        { authenticated: true },
      );
    },

    deactivate(organizationId, productId) {
      return client.delete(
        `${productsPath(organizationId)}/${encodeURIComponent(productId)}`,
        { authenticated: true },
      );
    },

    createVariant(organizationId, productId, input) {
      return client.post<ProductVariantDTO>(
        `${productsPath(organizationId)}/${encodeURIComponent(productId)}/variants`,
        input,
        { authenticated: true },
      );
    },

    updateVariant(
      organizationId,
      productId,
      variantId,
      input,
    ) {
      return client.patch<ProductVariantDTO>(
        `${productsPath(organizationId)}/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}`,
        input,
        { authenticated: true },
      );
    },

    deactivateVariant(
      organizationId,
      productId,
      variantId,
    ) {
      return client.delete(
        `${productsPath(organizationId)}/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}`,
        { authenticated: true },
      );
    },

    requestImageUploadUrl(
      organizationId,
      productId,
      contentType,
    ) {
      return client.post<PresignedUploadDTO>(
        `${productsPath(organizationId)}/${encodeURIComponent(productId)}/image-upload-url`,
        { contentType },
        { authenticated: true },
      );
    },
  };
}

export const productService = createProductService();
