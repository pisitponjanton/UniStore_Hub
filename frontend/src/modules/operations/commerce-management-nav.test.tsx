import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CommerceManagementNav } from "./commerce-management-nav";

describe("CommerceManagementNav", () => {
  it("preserves the organization context in product and campaign destinations", () => {
    render(<CommerceManagementNav organizationId="org /?#1" current="stores" />);
    const nav = screen.getByRole("navigation", { name: "จัดการการขายของหน่วยงาน" });
    expect(nav.querySelector('[aria-current="page"]')).toHaveTextContent("ร้านค้า");
    expect(screen.getByRole("link", { name: "สินค้าและตัวเลือก" }))
      .toHaveAttribute("href", "/org/products?organizationId=org+%2F%3F%231");
    expect(screen.getByRole("link", { name: "รอบการขาย" }))
      .toHaveAttribute("href", "/org/campaigns?organizationId=org+%2F%3F%231");
  });
  it("does not point to an unrelated tenant or link the current page", () => {
    render(<CommerceManagementNav organizationId="real-org" current="products" />);
    expect(screen.queryByRole("link", { name: "สินค้าและตัวเลือก" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ร้านค้า" }))
      .toHaveAttribute("href", "/org/stores?organizationId=real-org");
    expect(screen.getByRole("link", { name: "รอบการขาย" }))
      .toHaveAttribute("href", "/org/campaigns?organizationId=real-org");
  });
});
