import { API_ERROR_CODES, type ApiErrorCode } from "@/types";

const API_ERROR_MESSAGES: Record<ApiErrorCode, string> = {
  AUTH_REQUIRED: "กรุณาเข้าสู่ระบบก่อนดำเนินการต่อ",
  INVALID_CREDENTIALS: "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
  TOKEN_INVALID: "เซสชันไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่",
  TOKEN_EXPIRED: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่",
  USER_DISABLED: "บัญชีนี้ถูกปิดใช้งาน",
  FORBIDDEN: "คุณไม่มีสิทธิ์ดำเนินการนี้",
  MEMBERSHIP_REQUIRED: "บัญชีนี้ไม่ได้เป็นสมาชิกของหน่วยงานดังกล่าว",
  ROLE_FORBIDDEN: "บทบาทของคุณไม่มีสิทธิ์ดำเนินการนี้",
  TENANT_MISMATCH: "ไม่สามารถเข้าถึงข้อมูลของหน่วยงานอื่นได้",
  RESOURCE_OWNERSHIP_REQUIRED: "คุณไม่มีสิทธิ์เข้าถึงรายการนี้",
  LAST_ORGANIZATION_ADMIN: "ไม่สามารถลบหรือลดสิทธิ์ผู้ดูแลหน่วยงานคนสุดท้ายได้",
  VALIDATION_ERROR: "ข้อมูลที่กรอกไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง",
  INVALID_CURSOR: "ข้อมูลหน้ารายการไม่ถูกต้อง กรุณาโหลดใหม่",
  INVALID_STATUS_TRANSITION: "ไม่สามารถเปลี่ยนสถานะจากสถานะปัจจุบันได้",
  USER_NOT_FOUND: "ไม่พบบัญชีผู้ใช้",
  ORGANIZATION_NOT_FOUND: "ไม่พบหน่วยงาน",
  MEMBER_NOT_FOUND: "ไม่พบสมาชิกหน่วยงาน",
  STORE_NOT_FOUND: "ไม่พบร้านค้า",
  PRODUCT_NOT_FOUND: "ไม่พบสินค้า",
  VARIANT_NOT_FOUND: "ไม่พบตัวเลือกสินค้า",
  CAMPAIGN_NOT_FOUND: "ไม่พบแคมเปญ",
  ORDER_NOT_FOUND: "ไม่พบคำสั่งซื้อ",
  PAYMENT_NOT_FOUND: "ไม่พบข้อมูลการชำระเงิน",
  PICKUP_NOT_FOUND: "ไม่พบข้อมูลการรับสินค้า",
  NOTIFICATION_NOT_FOUND: "ไม่พบการแจ้งเตือน",
  CAMPAIGN_NOT_OPEN: "แคมเปญนี้ยังไม่เปิดรับคำสั่งซื้อ",
  PAYMENT_NOT_REVIEWABLE: "ไม่สามารถส่งหรือตรวจสอบการชำระเงินในสถานะแคมเปญปัจจุบันได้",
  PAYMENT_REJECT_REASON_REQUIRED: "กรุณาระบุเหตุผลที่ปฏิเสธการชำระเงิน",
  PAYMENT_SLIP_REQUIRED: "กรุณาแนบหลักฐานการชำระเงิน",
  ORDER_NOT_READY_FOR_PICKUP: "คำสั่งซื้อนี้ยังไม่พร้อมรับสินค้า",
  PICKUP_ALREADY_RECEIVED: "คำสั่งซื้อนี้ถูกรับสินค้าแล้ว",
  FILE_ACCESS_FORBIDDEN: "คุณไม่มีสิทธิ์เข้าถึงไฟล์นี้",
  INTERNAL_ERROR: "ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง",
};

export function isApiErrorCode(code: string): code is ApiErrorCode {
  return API_ERROR_CODES.some((knownCode) => knownCode === code);
}

export function getApiErrorMessage(
  code: string,
  fallbackMessage = "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง",
): string {
  return isApiErrorCode(code) ? API_ERROR_MESSAGES[code] : fallbackMessage;
}
