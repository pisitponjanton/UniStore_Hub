import type { AllowedUploadContentType } from "@/types";

export const ALLOWED_UPLOAD_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const satisfies readonly AllowedUploadContentType[];

export const PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const PAYMENT_SLIP_MAX_BYTES = 10 * 1024 * 1024;

export type UploadKind = "productImage" | "paymentSlip";

export interface UploadCandidate {
  type: string;
  size: number;
}

export type UploadValidationResult =
  | {
      ok: true;
      contentType: AllowedUploadContentType;
      maxBytes: number;
    }
  | {
      ok: false;
      reason: "UNSUPPORTED_TYPE" | "FILE_TOO_LARGE";
      maxBytes: number;
    };

export function isAllowedUploadContentType(
  value: string,
): value is AllowedUploadContentType {
  return ALLOWED_UPLOAD_CONTENT_TYPES.some((type) => type === value);
}

export function getUploadMaxBytes(kind: UploadKind): number {
  return kind === "productImage"
    ? PRODUCT_IMAGE_MAX_BYTES
    : PAYMENT_SLIP_MAX_BYTES;
}

export function validateUploadCandidate(
  candidate: UploadCandidate,
  kind: UploadKind,
): UploadValidationResult {
  const maxBytes = getUploadMaxBytes(kind);

  if (!isAllowedUploadContentType(candidate.type)) {
    return { ok: false, reason: "UNSUPPORTED_TYPE", maxBytes };
  }

  if (candidate.size > maxBytes) {
    return { ok: false, reason: "FILE_TOO_LARGE", maxBytes };
  }

  return {
    ok: true,
    contentType: candidate.type,
    maxBytes,
  };
}
