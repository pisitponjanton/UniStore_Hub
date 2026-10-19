import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StaffOperationNav } from "./staff-operation-nav";

describe("StaffOperationNav", () => {
  it("keeps the real organizationId across staff queue switches", () => {
    render(<StaffOperationNav organizationId="org /!?" current="orders" />);
    const nav = screen.getByRole("navigation", { name: "คิวงานเจ้าหน้าที่" });
    expect(nav.querySelector('[aria-current="page"]')).toHaveTextContent("คำสั่งซื้อ");
    expect(screen.getByRole("link", { name: "ตรวจชำระเงิน" }))
      .toHaveAttribute("href", "/org/payments?organizationId=org+%2F%21%3F");
    expect(screen.getByRole("link", { name: "รับสินค้า" }))
      .toHaveAttribute("href", "/org/pickups?organizationId=org+%2F%21%3F");
    expect(screen.queryByRole("link", { name: "คำสั่งซื้อ" })).not.toBeInTheDocument();
  });

  it("makes the order list reachable from a selected detail", () => {
    render(<StaffOperationNav organizationId="real-org" current="orders" isDetail />);
    expect(screen.getByRole("link", { name: "คำสั่งซื้อ" }))
      .toHaveAttribute("href", "/org/orders?organizationId=real-org");
    expect(screen.getByRole("link", { name: "ตรวจชำระเงิน" }))
      .toHaveAttribute("href", "/org/payments?organizationId=real-org");
  });
});
