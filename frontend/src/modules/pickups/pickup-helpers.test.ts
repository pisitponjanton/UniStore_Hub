import { describe, expect, it, vi } from "vitest";

import {
  canConfirmPickup,
  canViewCustomerPickup,
  getPickupStatusLabel,
  myPickupHref,
  organizationPickupsHref,
} from "./pickup-helpers";
import { createPickupQrDataUrl } from "./pickup-qr";

describe("customer pickup helpers", () => {
  it("builds the static query route from orderId", () => {
    expect(myPickupHref("order 1")).toBe(
      "/my/pickup/?orderId=order+1",
    );
  });

  it("exposes pickup only for ready or received orders", () => {
    expect(canViewCustomerPickup("READY_FOR_PICKUP")).toBe(true);
    expect(canViewCustomerPickup("RECEIVED")).toBe(true);
    expect(canViewCustomerPickup("IN_PRODUCTION")).toBe(false);
    expect(canViewCustomerPickup("CANCELLED")).toBe(false);
  });

  it("labels both Pickup states", () => {
    expect(getPickupStatusLabel("READY")).toBe("พร้อมรับสินค้า");
    expect(getPickupStatusLabel("RECEIVED")).toBe("รับสินค้าแล้ว");
  });

  it("builds the organization static query route and confirms only READY pickups", () => {
    expect(organizationPickupsHref("org 1")).toBe(
      "/org/pickups/?organizationId=org+1",
    );
    expect(canConfirmPickup("READY")).toBe(true);
    expect(canConfirmPickup("RECEIVED")).toBe(false);
  });

  it("encodes exactly the pickup token in the QR payload", async () => {
    const encoder = vi.fn().mockResolvedValue("data:image/png;base64,qr");

    const result = await createPickupQrDataUrl(
      "token-only-value",
      encoder,
    );

    expect(result).toBe("data:image/png;base64,qr");
    expect(encoder).toHaveBeenCalledWith(
      "token-only-value",
      expect.objectContaining({
        errorCorrectionLevel: "M",
      }),
    );
    expect(encoder).toHaveBeenCalledTimes(1);
  });
});
