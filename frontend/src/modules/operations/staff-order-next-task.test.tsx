import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StaffOrderNextTask } from "./staff-order-next-task";

describe("StaffOrderNextTask", () => {
  it("links PAYMENT_REVIEW only to an organization-scoped payment queue", () => {
    render(<StaffOrderNextTask organizationId="org#1" status="PAYMENT_REVIEW" />);
    expect(screen.getByRole("complementary", { name: "แนวทางดำเนินการสำหรับสถานะนี้" }))
      .toHaveTextContent("ตรวจหลักฐานการชำระเงิน");
    expect(screen.getByRole("link", { name: /เปิดคิวตรวจชำระเงิน/ }))
      .toHaveAttribute("href", "/org/payments?organizationId=org%231");
  });

  it("only opens pickup queue for READY_FOR_PICKUP", () => {
    render(<StaffOrderNextTask organizationId="org-1" status="READY_FOR_PICKUP" />);
    expect(screen.getByRole("link", { name: /เปิดคิวรับสินค้า/ }))
      .toHaveAttribute("href", "/org/pickups?organizationId=org-1");
  });

  it.each(["PENDING_PAYMENT", "PAYMENT_REJECTED", "PAID", "CONFIRMED", "IN_PRODUCTION", "RECEIVED", "CANCELLED"] as const)(
    "does not invent an operator action for %s",
    status => {
      render(<StaffOrderNextTask organizationId="org-1" status={status} />);
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
    },
  );
});
