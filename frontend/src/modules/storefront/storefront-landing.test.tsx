import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getLanding: vi.fn(),
}));

vi.mock("./storefront-service", () => ({
  storefrontService: {
    getLanding: mocks.getLanding,
  },
}));

vi.mock("./storefront-header", () => ({
  StorefrontHeader: () => <header>UniStore Hub</header>,
}));

import { StorefrontLanding } from "./storefront-landing";

describe("StorefrontLanding", () => {
  it("leads with real discovery actions and renders active organizations and stores", async () => {
    mocks.getLanding.mockResolvedValue([
      {
        organization: {
          organizationId: "org-1",
          name: "ชมรมตัวอย่าง",
          description: "สินค้าจากกิจกรรมของชมรม",
          status: "ACTIVE",
        },
        stores: [
          {
            storeId: "store-1",
            organizationId: "org-1",
            name: "ร้านชมรม",
            description: "สินค้าพรีออเดอร์ของชมรม",
            status: "ACTIVE",
          },
        ],
      },
    ]);

    render(<StorefrontLanding />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "เลือกซื้อจากร้านในมหาวิทยาลัย",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "ดูร้านที่เปิดอยู่" }),
    ).toHaveAttribute("href", "#storefront-heading");
    expect(
      screen.getByRole("link", { name: "ติดตามคำสั่งซื้อ" }),
    ).toHaveAttribute("href", "/my/orders");

    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "ร้านที่เปิดให้เข้าชม",
      }),
    ).toBeInTheDocument();

    expect(screen.getByText("ชมรมตัวอย่าง")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ร้านชมรม/ })).toHaveAttribute(
      "href",
      "/stores/view?organizationId=org-1&storeId=store-1",
    );
    expect(screen.getByText("1 ร้าน")).toBeInTheDocument();
    expect(screen.getAllByText("1", { selector: "dd" })).toHaveLength(2);
  });
});
