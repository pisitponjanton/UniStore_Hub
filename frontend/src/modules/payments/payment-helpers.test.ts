import { describe, expect, it } from "vitest";

import type { OrderStatus } from "@/types";

import {
  canSubmitPaymentSlip,
  formatUploadFileSize,
  getPaymentStatePresentation,
  getPaymentStatusLabel,
  myPaymentHref,
  paymentOrderStateMessage,
} from "./payment-helpers";

describe("customer payment helpers", () => {
  it("permits initial submit and rejected resubmit only", () => {
    const statuses: OrderStatus[] = [
      "PENDING_PAYMENT",
      "PAYMENT_REVIEW",
      "PAID",
      "PAYMENT_REJECTED",
      "CONFIRMED",
      "IN_PRODUCTION",
      "READY_FOR_PICKUP",
      "RECEIVED",
      "CANCELLED",
    ];

    expect(
      statuses.filter((status) => canSubmitPaymentSlip(status)),
    ).toEqual(["PENDING_PAYMENT", "PAYMENT_REJECTED"]);
  });

  it("builds the static payment route from only orderId", () => {
    expect(myPaymentHref("order 1")).toBe(
      "/my/payment/?orderId=order+1",
    );
  });

  it("presents payment-related order states without changing their contract", () => {
    expect(paymentOrderStateMessage("PAYMENT_REVIEW")).toContain(
      "รอเจ้าหน้าที่ตรวจสอบ",
    );
    expect(paymentOrderStateMessage("PAYMENT_REJECTED")).toContain(
      "ถูกปฏิเสธ",
    );
    expect(paymentOrderStateMessage("PAID")).toContain(
      "ผ่านการอนุมัติ",
    );

    expect(getPaymentStatePresentation("PENDING_PAYMENT")).toMatchObject({
      title: "ยังไม่ได้ส่งหลักฐาน",
      tone: "warning",
    });
    expect(getPaymentStatePresentation("PAYMENT_REJECTED")).toMatchObject({
      title: "ต้องส่งหลักฐานใหม่",
      tone: "danger",
    });
    expect(getPaymentStatePresentation("READY_FOR_PICKUP")).toMatchObject({
      title: "ชำระเงินผ่านแล้ว",
      tone: "success",
    });
  });

  it("maps canonical Payment statuses to customer-facing labels", () => {
    expect(getPaymentStatusLabel("PENDING_REVIEW")).toBe("รอตรวจสอบ");
    expect(getPaymentStatusLabel("APPROVED")).toBe("อนุมัติแล้ว");
    expect(getPaymentStatusLabel("REJECTED")).toBe("ไม่ผ่านการตรวจสอบ");
  });

  it("formats selected upload sizes for readable file confirmation", () => {
    expect(formatUploadFileSize(512)).toBe("512 B");
    expect(formatUploadFileSize(2048)).toBe("2.0 KiB");
    expect(formatUploadFileSize(2 * 1024 * 1024)).toBe("2.00 MiB");
  });
});
