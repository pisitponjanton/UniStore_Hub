import { describe, expect, it } from "vitest";

import type { OrderStatus } from "@/types";

import {
  canCustomerCancelOrder,
  myOrderHref,
} from "./order-tracking-helpers";

describe("customer order tracking helpers", () => {
  it("allows customer cancellation only from documented source states", () => {
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
      statuses.filter((status) => canCustomerCancelOrder(status)),
    ).toEqual(["PENDING_PAYMENT", "PAYMENT_REJECTED"]);
  });

  it("builds the static query-based customer order detail route", () => {
    expect(myOrderHref("order 1")).toBe(
      "/my/order/?orderId=order+1",
    );
  });
});
