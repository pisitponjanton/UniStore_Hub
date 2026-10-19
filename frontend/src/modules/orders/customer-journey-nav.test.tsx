import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CustomerJourneyNav } from "./customer-journey-nav";

describe("CustomerJourneyNav", () => {
  it("links only to universally valid destinations without guessing an order ID", () => {
    render(<CustomerJourneyNav current="orders" />);
    const nav = screen.getByRole("navigation", { name: "เส้นทางผู้ซื้อ" });
    expect(nav).toHaveTextContent("พื้นที่ของผู้ซื้อ");
    expect(nav.querySelector('[aria-current="page"]')).toHaveTextContent("คำสั่งซื้อ");
    expect(screen.getByRole("link", { name: "ค้นหาร้านค้า" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "การแจ้งเตือน" })).toHaveAttribute("href", "/notifications");
    expect(screen.queryByRole("link", { name: "กลับคำสั่งซื้อนี้" })).not.toBeInTheDocument();
  });

  it("preserves scoped order context only when an actual order ID is supplied", () => {
    render(<CustomerJourneyNav current="payment" orderId="test/order ?#123" />);
    expect(screen.getByRole("link", { name: /กลับคำสั่งซื้อนี้/ }))
      .toHaveAttribute("href", "/my/order?orderId=test%2Forder+%3F%23123");
    expect(screen.queryByRole("link", { name: "คำสั่งซื้อ" })).not.toBeInTheDocument();
  });

  it("does not create payment or pickup links for an unrelated order", () => {
    render(<CustomerJourneyNav current="notifications" />);
    const nav = screen.getByRole("navigation", { name: "เส้นทางผู้ซื้อ" });
    expect(nav.querySelectorAll('a[href*="/my/payment"], a[href*="/my/pickup"]')).toHaveLength(0);
    expect(nav.querySelector('[aria-current="page"]')).toHaveTextContent("การแจ้งเตือน");
  });
});
