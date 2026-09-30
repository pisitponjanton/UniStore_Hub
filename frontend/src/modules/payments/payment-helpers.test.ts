import { describe, expect, it } from "vitest";

import type { OrderStatus } from "@/types";

import {
  canSubmitPaymentSlip,
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

  it("presents payment-related order states without inventing a separate customer Payment DTO", () => {
    expect(paymentOrderStateMessage("PAYMENT_REVIEW")).toContain(
      "รอเจ้าหน้าที่ตรวจสอบ",
    );
    expect(paymentOrderStateMessage("PAYMENT_REJECTED")).toContain(
      "ถูกปฏิเสธ",
    );
    expect(paymentOrderStateMessage("PAID")).toContain(
      "ผ่านการอนุมัติ",
    );
  });
});
