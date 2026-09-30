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
  label: "เปิด Campaign",
  title: "ยืนยันการเปิด Campaign",
  description:
    "เปิดรับคำสั่งซื้อสำหรับ Campaign นี้ใช่หรือไม่ สถานะจะเปลี่ยนจาก DRAFT เป็น OPEN ผ่าน Backend",
};

const CLOSE: CampaignLifecycleActionMeta = {
  action: "close",
  label: "ปิดรับคำสั่งซื้อ",
  title: "ยืนยันการปิด Campaign",
  description:
    "ปิดรับคำสั่งซื้อสำหรับ Campaign นี้ใช่หรือไม่ Backend จะจัดการ Order ที่เกี่ยวข้องตามกฎของ Campaign",
};

const START_PRODUCTION: CampaignLifecycleActionMeta = {
  action: "start-production",
  label: "เริ่มการผลิต",
  title: "ยืนยันการเริ่มผลิต",
  description:
    "เริ่มการผลิตสำหรับ Campaign นี้ใช่หรือไม่ หากยังมี Payment อยู่ระหว่างตรวจสอบ Backend จะไม่อนุญาตให้ดำเนินการ",
};

const READY_FOR_PICKUP: CampaignLifecycleActionMeta = {
  action: "ready-for-pickup",
  label: "พร้อมรับสินค้า",
  title: "ยืนยันว่าพร้อมรับสินค้า",
  description:
    "เปลี่ยน Campaign เป็นพร้อมรับสินค้าใช่หรือไม่ Backend จะสร้างหรือเตรียม Pickup ตามข้อมูล Order ที่เกี่ยวข้อง",
};

const COMPLETE: CampaignLifecycleActionMeta = {
  action: "complete",
  label: "ปิด Campaign เป็นเสร็จสิ้น",
  title: "ยืนยันการเสร็จสิ้น Campaign",
  description:
    "ทำเครื่องหมาย Campaign ว่าเสร็จสิ้นใช่หรือไม่ Backend จะปฏิเสธหากยังมี Order ที่ยังไม่ครบเงื่อนไข",
};

const CANCEL: CampaignLifecycleActionMeta = {
  action: "cancel",
  label: "ยกเลิก Campaign",
  title: "ยืนยันการยกเลิก Campaign",
  description:
    "ยกเลิก Campaign นี้ใช่หรือไม่ การยกเลิกทำได้เฉพาะ DRAFT, OPEN หรือ CLOSED และ Backend จะตรวจว่าไม่มี Order ที่บล็อกการยกเลิก",
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
