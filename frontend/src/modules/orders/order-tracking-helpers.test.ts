import { describe, expect, it } from "vitest";

import type { OrderStatus } from "@/types";

import {
  canCustomerCancelOrder,
  customerOrderBucket,
  prioritizeLoadedOrders,
  getCustomerOrderGuidance,
  getOrderJourneySteps,
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

  it("maps customer next actions only to documented payment and pickup flows", () => {
    expect(getCustomerOrderGuidance("PENDING_PAYMENT").action).toBe("PAYMENT");
    expect(getCustomerOrderGuidance("PAYMENT_REJECTED").action).toBe(
      "PAYMENT",
    );
    expect(getCustomerOrderGuidance("READY_FOR_PICKUP").action).toBe(
      "PICKUP",
    );

    const statusesWithoutPrimaryAction: OrderStatus[] = [
      "PAYMENT_REVIEW",
      "PAID",
      "CONFIRMED",
      "IN_PRODUCTION",
      "RECEIVED",
      "CANCELLED",
    ];

    expect(
      statusesWithoutPrimaryAction.map(
        (status) => getCustomerOrderGuidance(status).action,
      ),
    ).toEqual(statusesWithoutPrimaryAction.map(() => null));
  });

  it("represents the canonical order journey without inventing a cancelled path", () => {
    expect(getOrderJourneySteps("PENDING_PAYMENT")).toEqual([
      { key: "payment", label: "ชำระเงิน", state: "current" },
      { key: "confirmation", label: "ยืนยันคำสั่งซื้อ", state: "upcoming" },
      { key: "production", label: "ผลิตสินค้า", state: "upcoming" },
      { key: "pickup", label: "รับสินค้า", state: "upcoming" },
    ]);

    expect(getOrderJourneySteps("IN_PRODUCTION")).toEqual([
      { key: "payment", label: "ชำระเงิน", state: "done" },
      { key: "confirmation", label: "ยืนยันคำสั่งซื้อ", state: "done" },
      { key: "production", label: "ผลิตสินค้า", state: "current" },
      { key: "pickup", label: "รับสินค้า", state: "upcoming" },
    ]);

    expect(
      getOrderJourneySteps("RECEIVED").every((step) => step.state === "done"),
    ).toBe(true);
    expect(getOrderJourneySteps("CANCELLED")).toEqual([]);
  });

  it("builds the static query-based customer order detail route", () => {
    expect(myOrderHref("order 1")).toBe(
      "/my/order/?orderId=order+1",
    );
  });
  it("groups by real documented statuses and prioritizes actions among loaded records", () => {
    const rows = [
      { orderId: "done", status: "RECEIVED" as const, updatedAt: "2026-10-04" },
      { orderId: "in-progress", status: "IN_PRODUCTION" as const, updatedAt: "2026-10-05" },
      { orderId: "pay", status: "PENDING_PAYMENT" as const, updatedAt: "2026-10-01" },
      { orderId: "pickup", status: "READY_FOR_PICKUP" as const, updatedAt: "2026-10-06" },
      { orderId: "reject", status: "PAYMENT_REJECTED" as const, updatedAt: "2026-10-03" },
    ];
    const snapshot = rows.map(x => x.orderId);
    expect(prioritizeLoadedOrders(rows).map(x => x.orderId)).toEqual([
      "pickup", "reject", "pay", "in-progress", "done",
    ]);
    expect(rows.map(x => x.orderId)).toEqual(snapshot);
    expect(customerOrderBucket("PAYMENT_REVIEW")).toBe("progress");
    expect(customerOrderBucket("CANCELLED")).toBe("finished");
  });

});
