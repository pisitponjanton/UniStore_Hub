import type {
  AllowedUploadContentType,
  PresignedUploadDTO,
  ProductDTO,
} from "@/types";
import { validateUploadCandidate } from "@/utils";
import { productService } from "./product-service";

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

/** Product records must exist before the S3 upload URL can be issued. */
export async function uploadImageForCreatedProduct(
  organizationId: string,
  productId: string,
  file: File,
): Promise<ProductDTO> {
  const check = validateUploadCandidate(file, "productImage");
  if (!check.ok) {
    throw new Error(check.reason === "UNSUPPORTED_TYPE"
      ? "รองรับเฉพาะรูป JPEG, PNG และ WebP"
      : "รูปสินค้าต้องมีขนาดไม่เกิน 5 MiB");
  }

  const signed = await productService.requestImageUploadUrl(
    organizationId, productId, check.contentType,
  );
  await putProductImageToPresignedUrl({
    upload: signed, file, contentType: check.contentType,
  });

  // Do not repeat the signed PUT when acknowledgement of PATCH is unclear.
  const updated = await productService.update(organizationId, productId, {
    imageKey: signed.objectKey,
  });
  if (updated.imageKey !== signed.objectKey) {
    throw new Error("ยังยืนยันการบันทึกรูปไม่ได้ กรุณาเปิดรายละเอียดสินค้าเพื่อตรวจสอบ");
  }
  return productService.get(organizationId, productId);
}
