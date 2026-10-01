import type { OrderStatus } from "@/types";

export type CustomerOrderAction = "PAYMENT" | "PICKUP" | null;
export type OrderJourneyState = "done" | "current" | "upcoming";

export interface CustomerOrderGuidance {
  title: string;
  description: string;
  action: CustomerOrderAction;
}

export interface OrderJourneyStep {
  key: "payment" | "confirmation" | "production" | "pickup";
  label: string;
  state: OrderJourneyState;
}

const guidance: Record<OrderStatus, CustomerOrderGuidance> = {
  PENDING_PAYMENT: {
    title: "รอชำระเงิน",
    description: "ส่งหลักฐานการชำระเงินเพื่อให้ร้านตรวจสอบคำสั่งซื้อนี้",
    action: "PAYMENT",
  },
  PAYMENT_REVIEW: {
    title: "กำลังตรวจสอบการชำระเงิน",
    description: "ร้านได้รับหลักฐานแล้ว กรุณารอผลการตรวจสอบก่อนดำเนินการต่อ",
    action: null,
  },
  PAID: {
    title: "ชำระเงินแล้ว",
    description: "การชำระเงินผ่านแล้ว ระบบจะอัปเดตคำสั่งซื้อเมื่อรอบพรีออเดอร์ดำเนินต่อ",
    action: null,
  },
  PAYMENT_REJECTED: {
    title: "ต้องส่งหลักฐานการชำระเงินใหม่",
    description: "หลักฐานล่าสุดไม่ผ่านการตรวจสอบ กรุณาเปิดหน้าการชำระเงินเพื่อดูรายละเอียดและส่งใหม่",
    action: "PAYMENT",
  },
  CONFIRMED: {
    title: "ยืนยันคำสั่งซื้อแล้ว",
    description: "คำสั่งซื้อได้รับการยืนยันและกำลังรอเข้าสู่ขั้นตอนการผลิต",
    action: null,
  },
  IN_PRODUCTION: {
    title: "กำลังผลิตสินค้า",
    description: "ร้านกำลังเตรียมสินค้าตามคำสั่งซื้อของคุณ",
    action: null,
  },
  READY_FOR_PICKUP: {
    title: "พร้อมรับสินค้า",
    description: "เปิดข้อมูลรับสินค้าและแสดง QR/Token ให้เจ้าหน้าที่เมื่อไปรับสินค้า",
    action: "PICKUP",
  },
  RECEIVED: {
    title: "รับสินค้าแล้ว",
    description: "คำสั่งซื้อนี้เสร็จสิ้นการรับสินค้าเรียบร้อยแล้ว",
    action: null,
  },
  CANCELLED: {
    title: "คำสั่งซื้อถูกยกเลิก",
    description: "คำสั่งซื้อนี้สิ้นสุดแล้วและไม่ต้องดำเนินการต่อ",
    action: null,
  },
};

export function canCustomerCancelOrder(status: OrderStatus): boolean {
  return status === "PENDING_PAYMENT" || status === "PAYMENT_REJECTED";
}

export function getCustomerOrderGuidance(
  status: OrderStatus,
): CustomerOrderGuidance {
  return guidance[status];
}

export function getOrderJourneySteps(
  status: OrderStatus,
): OrderJourneyStep[] {
  if (status === "CANCELLED") {
    return [];
  }

  const ranks: Record<
    Exclude<OrderStatus, "CANCELLED">,
    { payment: number; confirmation: number; production: number; pickup: number }
  > = {
    PENDING_PAYMENT: { payment: 1, confirmation: 0, production: 0, pickup: 0 },
    PAYMENT_REVIEW: { payment: 1, confirmation: 0, production: 0, pickup: 0 },
    PAYMENT_REJECTED: { payment: 1, confirmation: 0, production: 0, pickup: 0 },
    PAID: { payment: 2, confirmation: 1, production: 0, pickup: 0 },
    CONFIRMED: { payment: 2, confirmation: 2, production: 1, pickup: 0 },
    IN_PRODUCTION: { payment: 2, confirmation: 2, production: 1, pickup: 0 },
    READY_FOR_PICKUP: { payment: 2, confirmation: 2, production: 2, pickup: 1 },
    RECEIVED: { payment: 2, confirmation: 2, production: 2, pickup: 2 },
  };

  const rank = ranks[status];
  const state = (value: number): OrderJourneyState =>
    value === 2 ? "done" : value === 1 ? "current" : "upcoming";

  return [
    { key: "payment", label: "ชำระเงิน", state: state(rank.payment) },
    {
      key: "confirmation",
      label: "ยืนยันคำสั่งซื้อ",
      state: state(rank.confirmation),
    },
    { key: "production", label: "ผลิตสินค้า", state: state(rank.production) },
    { key: "pickup", label: "รับสินค้า", state: state(rank.pickup) },
  ];
}

export function myOrderHref(orderId: string): string {
  const params = new URLSearchParams({ orderId });
  return `/my/order/?${params.toString()}`;
}
