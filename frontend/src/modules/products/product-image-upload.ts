import type {
  AllowedUploadContentType,
  PresignedUploadDTO,
} from "@/types";

export class ProductImageUploadError extends Error {
  constructor(
    readonly status: number,
    message = "Product image upload failed.",
  ) {
    super(message);
    this.name = "ProductImageUploadError";
  }
}

export async function putProductImageToPresignedUrl({
  upload,
  file,
  contentType,
  fetchImpl = fetch,
}: {
  upload: PresignedUploadDTO;
  file: Blob;
  contentType: AllowedUploadContentType;
  fetchImpl?: typeof fetch;
}): Promise<void> {
  const response = await fetchImpl(upload.url, {
    method: upload.method,
    headers: {
      "Content-Type": contentType,
    },
    body: file,
  });

  if (!response.ok) {
    throw new ProductImageUploadError(response.status);
  }
}
