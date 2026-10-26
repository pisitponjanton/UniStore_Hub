import type { StoreDTO, AllowedUploadContentType } from "@/types";
import { validateUploadCandidate } from "@/utils";
import { storeService } from "./store-service";
import { ApiClientError } from "@/services";

export function validateStoreImageFile(file: File): AllowedUploadContentType {
  const result = validateUploadCandidate(file, "productImage");
  if (!result.ok) {
    throw new Error(result.reason === "UNSUPPORTED_TYPE"
      ? "รองรับเฉพาะรูป JPEG, PNG และ WebP"
      : "รูปหน้าร้านต้องมีขนาดไม่เกิน 5 MiB");
  }
  return result.contentType;
}

export async function uploadStoreImage(
  organizationId: string, storeId: string, file: File,
): Promise<StoreDTO> {
  const contentType = validateStoreImageFile(file);
  let signed;
  try {
    signed = await storeService.createImageUploadUrl(organizationId, storeId, contentType);
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404 && error.code === "VALIDATION_ERROR") {
      throw new Error("ไม่พบ API อัปโหลดรูปหน้าร้าน กรุณาตรวจสอบว่า Backend ได้อัปเดตและเริ่มทำงานใหม่แล้ว");
    }
    throw error;
  }
  const response = await fetch(signed.url, {
    method: signed.method,
    headers: { "Content-Type": contentType },
    body: file,
  });
  if (!response.ok) throw new Error("อัปโหลดรูปหน้าร้านไม่สำเร็จ กรุณาลองอีกครั้ง");
  // The PATCH only associates an object after the backend verifies its S3 metadata.
  // Never retry a PUT automatically if PATCH acknowledgement is uncertain.
  const updated = await storeService.update(organizationId, storeId, { imageKey: signed.objectKey });
  if (updated.imageKey !== signed.objectKey) {
    throw new Error("ยังยืนยันรูปหน้าร้านล่าสุดไม่ได้ กรุณาโหลดข้อมูลร้านใหม่");
  }
  return storeService.get(organizationId, storeId);
}
