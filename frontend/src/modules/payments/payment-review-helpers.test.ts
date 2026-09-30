import { describe, expect, it } from "vitest";

import {
  paymentStatusLabel,
  validateRejectReason,
} from "./payment-review-helpers";

describe("payment review helpers", () => {
  it("labels only canonical Payment statuses", () => {
    expect(paymentStatusLabel("PENDING_REVIEW")).toBe("รอตรวจสอบ");
    expect(paymentStatusLabel("APPROVED")).toBe("อนุมัติแล้ว");
    expect(paymentStatusLabel("REJECTED")).toBe("ปฏิเสธแล้ว");
  });

  it("requires and trims the reject reason", () => {
    expect(validateRejectReason("   ")).toEqual({
      value: "",
      error: "กรุณาระบุเหตุผลที่ปฏิเสธการชำระเงิน",
      valid: false,
    });

    expect(
      validateRejectReason("  Slip amount mismatch  "),
    ).toEqual({
      value: "Slip amount mismatch",
      valid: true,
    });
  });
});
