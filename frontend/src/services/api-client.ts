import { getApiBaseUrl, readAccessToken } from "@/lib";
import type {
  ApiErrorCode,
  ApiErrorEnvelope,
  ApiListData,
  ApiSuccess,
} from "@/types";
import { getApiErrorMessage, isApiErrorCode } from "@/utils";

export type ApiHttpErrorKind =
  | "unauthorized"
  | "forbidden"
  | "notFound"
  | "conflict"
  | "server"
  | "network"
  | "unexpected";

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly kind: ApiHttpErrorKind;
  readonly userMessage: string;

  constructor({
    status,
    code,
    kind,
    message,
  }: {
    status: number;
    code: ApiErrorCode;
    kind: ApiHttpErrorKind;
    message?: string;
  }) {
    super(message || getApiErrorMessage(code));
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.kind = kind;
    this.userMessage = getApiErrorMessage(code, message);
  }
}

export interface ApiClientConfig {
  baseUrl?: string;
  getAccessToken?: () => string | null;
  fetchImpl?: typeof fetch;
}

export type ApiQueryValue = string | number | boolean | null | undefined;
export type ApiQuery = Record<string, ApiQueryValue>;

export interface ApiRequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  authenticated?: boolean;
  query?: ApiQuery;
  body?: unknown;
  headers?: HeadersInit;
  signal?: AbortSignal;
}

function classifyStatus(status: number): ApiHttpErrorKind {
  switch (status) {
    case 401:
      return "unauthorized";
    case 403:
      return "forbidden";
    case 404:
      return "notFound";
    case 409:
      return "conflict";
    default:
      return status >= 500 ? "server" : "unexpected";
  }
}

function isSuccessEnvelope<T>(value: unknown): value is ApiSuccess<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    "success" in value &&
    (value as { success?: unknown }).success === true &&
    "data" in value
  );
}

function isErrorEnvelope(value: unknown): value is ApiErrorEnvelope {
  if (
    typeof value !== "object" ||
    value === null ||
    !("success" in value) ||
    (value as { success?: unknown }).success !== false ||
    !("error" in value)
  ) {
    return false;
  }

  const error = (value as { error?: unknown }).error;

  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  );
}

function buildUrl(baseUrl: string, path: string, query?: ApiQuery): string {
  if (!path.startsWith("/")) {
    throw new TypeError("API path must start with '/'.");
  }

  const url = new URL(`${baseUrl}${path}`);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== null && value !== undefined && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }

  return url.toString();
}

function normalizeErrorCode(code: string): ApiErrorCode {
  return isApiErrorCode(code) ? code : "INTERNAL_ERROR";
}

export class ApiClient {
  private readonly baseUrl?: string;
  private readonly getAccessToken?: () => string | null;
  private readonly fetchImpl: typeof fetch;

  constructor(config: ApiClientConfig = {}) {
    this.baseUrl = config.baseUrl?.replace(/\/+$/, "");
    this.getAccessToken = config.getAccessToken;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async request<T>(
    path: string,
    options: ApiRequestOptions = {},
  ): Promise<T> {
    const {
      method = "GET",
      authenticated = false,
      query,
      body,
      headers: providedHeaders,
      signal,
    } = options;

    const headers = new Headers(providedHeaders);
    headers.set("Accept", "application/json");

    if (body !== undefined) {
      headers.set("Content-Type", "application/json");
    }

    if (authenticated) {
      const accessToken = this.getAccessToken?.();

      if (accessToken) {
        headers.set("Authorization", `Bearer ${accessToken}`);
      }
    }

    let response: Response;

    try {
      response = await this.fetchImpl(
        buildUrl(this.baseUrl ?? getApiBaseUrl(), path, query),
        {
          method,
          headers,
          body: body === undefined ? undefined : JSON.stringify(body),
          signal,
        },
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }

      throw new ApiClientError({
        status: 0,
        code: "INTERNAL_ERROR",
        kind: "network",
        message: "Unable to reach the server.",
      });
    }

    if (response.status === 204) {
      if (!response.ok) {
        throw new ApiClientError({
          status: response.status,
          code: "INTERNAL_ERROR",
          kind: classifyStatus(response.status),
        });
      }

      return undefined as T;
    }

    let payload: unknown;

    try {
      payload = await response.json();
    } catch {
      throw new ApiClientError({
        status: response.status,
        code: "INTERNAL_ERROR",
        kind: classifyStatus(response.status),
        message: "The server returned an invalid response.",
      });
    }

    if (isErrorEnvelope(payload)) {
      const code = normalizeErrorCode(payload.error.code);

      throw new ApiClientError({
        status: response.status,
        code,
        kind: classifyStatus(response.status),
        message: payload.error.message,
      });
    }

    if (!response.ok || !isSuccessEnvelope<T>(payload)) {
      throw new ApiClientError({
        status: response.status,
        code: "INTERNAL_ERROR",
        kind: classifyStatus(response.status),
        message: "The server returned an unexpected response.",
      });
    }

    return payload.data;
  }

  get<T>(
    path: string,
    options: Omit<ApiRequestOptions, "method" | "body"> = {},
  ): Promise<T> {
    return this.request<T>(path, { ...options, method: "GET" });
  }

  getList<T>(
    path: string,
    options: Omit<ApiRequestOptions, "method" | "body"> = {},
  ): Promise<ApiListData<T>> {
    return this.get<ApiListData<T>>(path, options);
  }

  post<T>(
    path: string,
    body?: unknown,
    options: Omit<ApiRequestOptions, "method" | "body"> = {},
  ): Promise<T> {
    return this.request<T>(path, { ...options, method: "POST", body });
  }

  patch<T>(
    path: string,
    body?: unknown,
    options: Omit<ApiRequestOptions, "method" | "body"> = {},
  ): Promise<T> {
    return this.request<T>(path, { ...options, method: "PATCH", body });
  }

  delete(
    path: string,
    options: Omit<ApiRequestOptions, "method" | "body"> = {},
  ): Promise<void> {
    return this.request<void>(path, { ...options, method: "DELETE" });
  }
}

export const apiClient = new ApiClient({ getAccessToken: readAccessToken });
