import type { CampaignStatus } from "@/types";

import type { CampaignLifecycleAction } from "./campaign-service";

export interface CampaignLifecycleActionMeta {
  action: CampaignLifecycleAction;
  label: string;
  title: string;
  description: string;
  danger?: boolean;
}

const OPEN: CampaignLifecycleActionMeta = {
  action: "open",
  label: "เปิดรับคำสั่งซื้อ",
  title: "ยืนยันการเปิดรับคำสั่งซื้อ",
  description:
    "เมื่อยืนยัน แคมเปญจะเปลี่ยนจากฉบับร่างเป็นเปิดรับคำสั่งซื้อ กรุณาตรวจสอบร้านค้า ชื่อ และช่วงเวลาวางแผนก่อนดำเนินการ",
};

const CLOSE: CampaignLifecycleActionMeta = {
  action: "close",
  label: "ปิดรับคำสั่งซื้อ",
  title: "ยืนยันการปิดรับคำสั่งซื้อ",
  description:
    "เมื่อยืนยัน แคมเปญจะหยุดรับคำสั่งซื้อใหม่ แต่รายการเดิมยังคงดำเนินต่อไปตามกฎของระบบ",
};

const START_PRODUCTION: CampaignLifecycleActionMeta = {
  action: "start-production",
  label: "เริ่มการผลิต",
  title: "ยืนยันการเริ่มผลิต",
  description:
    "ระบบจะเริ่มขั้นตอนการผลิตได้เมื่อไม่มีคำสั่งซื้อที่ยังค้างการตรวจสอบการชำระเงิน",
};

const READY_FOR_PICKUP: CampaignLifecycleActionMeta = {
  action: "ready-for-pickup",
  label: "แจ้งพร้อมรับสินค้า",
  title: "ยืนยันว่าพร้อมรับสินค้า",
  description:
    "ยืนยันเมื่อสินค้าพร้อมสำหรับการรับ ระบบจะดำเนินข้อมูลการรับสินค้าของคำสั่งซื้อที่เกี่ยวข้องต่อ",
};

const COMPLETE: CampaignLifecycleActionMeta = {
  action: "complete",
  label: "ปิดแคมเปญเป็นเสร็จสิ้น",
  title: "ยืนยันการเสร็จสิ้นแคมเปญ",
  description:
    "ใช้เมื่อการรับสินค้าและงานที่เกี่ยวข้องครบเงื่อนไขแล้ว ระบบจะตรวจสอบเงื่อนไขอีกครั้งก่อนเปลี่ยนสถานะ",
};

const CANCEL: CampaignLifecycleActionMeta = {
  action: "cancel",
  label: "ยกเลิกแคมเปญ",
  title: "ยืนยันการยกเลิกแคมเปญ",
  description:
    "การยกเลิกทำได้เฉพาะฉบับร่าง เปิดรับคำสั่งซื้อ หรือปิดรับคำสั่งซื้อ และระบบจะปฏิเสธหากมีคำสั่งซื้อที่ไม่อนุญาตให้ยกเลิก",
  danger: true,
};

export function lifecycleActionsForStatus(
  status: CampaignStatus,
): CampaignLifecycleActionMeta[] {
  switch (status) {
    case "DRAFT":
      return [OPEN, CANCEL];
    case "OPEN":
      return [CLOSE, CANCEL];
    case "CLOSED":
      return [START_PRODUCTION, CANCEL];
    case "PRODUCING":
      return [READY_FOR_PICKUP];
    case "READY_FOR_PICKUP":
      return [COMPLETE];
    case "COMPLETED":
    case "CANCELLED":
      return [];
  }
}
