import type {
  CurrentMembershipDTO,
  CurrentUserDTO,
  Cursor,
  UserDTO,
} from "./domain";

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiListData<T> {
  items: T[];
  nextCursor: Cursor | null;
}

export type ApiListSuccess<T> = ApiSuccess<ApiListData<T>>;

export const API_ERROR_CODES = [
  "AUTH_REQUIRED",
  "INVALID_CREDENTIALS",
  "TOKEN_INVALID",
  "TOKEN_EXPIRED",
  "USER_DISABLED",
  "FORBIDDEN",
  "MEMBERSHIP_REQUIRED",
  "ROLE_FORBIDDEN",
  "TENANT_MISMATCH",
  "RESOURCE_OWNERSHIP_REQUIRED",
  "LAST_ORGANIZATION_ADMIN",
  "VALIDATION_ERROR",
  "INVALID_CURSOR",
  "INVALID_STATUS_TRANSITION",
  "USER_NOT_FOUND",
  "ORGANIZATION_NOT_FOUND",
  "MEMBER_NOT_FOUND",
  "STORE_NOT_FOUND",
  "PRODUCT_NOT_FOUND",
  "VARIANT_NOT_FOUND",
  "CAMPAIGN_NOT_FOUND",
  "ORDER_NOT_FOUND",
  "PAYMENT_NOT_FOUND",
  "PICKUP_NOT_FOUND",
  "NOTIFICATION_NOT_FOUND",
  "CAMPAIGN_NOT_OPEN",
  "PAYMENT_NOT_REVIEWABLE",
  "PAYMENT_REJECT_REASON_REQUIRED",
  "PAYMENT_SLIP_REQUIRED",
  "ORDER_NOT_READY_FOR_PICKUP",
  "PICKUP_ALREADY_RECEIVED",
  "FILE_ACCESS_FORBIDDEN",
  "INTERNAL_ERROR",
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export interface ApiErrorBody {
  code: ApiErrorCode;
  message: string;
}

export interface ApiErrorEnvelope {
  success: false;
  error: ApiErrorBody;
}

export type ApiEnvelope<T> = ApiSuccess<T> | ApiErrorEnvelope;
export type ApiListEnvelope<T> = ApiListSuccess<T> | ApiErrorEnvelope;

export interface AuthSessionDTO {
  user: UserDTO;
  token: string;
  expiresIn: string;
}

export interface CurrentUserSessionDTO {
  user: CurrentUserDTO;
  memberships: CurrentMembershipDTO[];
}

export type AllowedUploadContentType =
  | "image/jpeg"
  | "image/png"
  | "image/webp";

export interface PresignedUploadDTO {
  objectKey: string;
  url: string;
  method: "PUT";
  expiresInSeconds: number;
}

export interface PresignedDownloadDTO {
  url: string;
  method: "GET";
  expiresInSeconds: number;
}
