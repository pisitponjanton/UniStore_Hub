import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getLanding: vi.fn(),
  useAuthSession: vi.fn(),
}));

vi.mock("@/modules/auth", async () => {
  const actual = await vi.importActual<typeof import("@/modules/auth")>(
    "@/modules/auth",
  );
  return { ...actual, useAuthSession: mocks.useAuthSession };
});

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
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useAuthSession.mockReturnValue({ status: "anonymous" });
  });

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
    const trackingHref = screen
      .getByRole("link", { name: "ติดตามคำสั่งซื้อ" })
      .getAttribute("href");
    const loginDestination = new URL(
      trackingHref ?? "",
      "https://unistore.local",
    );
    expect(loginDestination.pathname).toMatch(/^\/login\/?$/);
    expect(loginDestination.searchParams.get("returnTo")).toBe("/my/orders/");

    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "ร้านที่เปิดให้เข้าชม",
      }),
    ).toBeInTheDocument();

    expect(screen.getAllByText("ชมรมตัวอย่าง")).toHaveLength(2);
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "เลือกร้านจากพื้นที่ที่เปิดอยู่",
      }),
    ).toBeInTheDocument();
    const storeLinks = screen.getAllByRole("link", { name: /ร้านชมรม/ });
    expect(storeLinks).toHaveLength(2);
    expect(storeLinks[0]).toHaveAttribute(
      "href",
      "/stores/view?organizationId=org-1&storeId=store-1",
    );
    expect(screen.getByText("1 ร้าน")).toBeInTheDocument();
    expect(screen.getAllByText("1", { selector: "dd" })).toHaveLength(2);
  });

  it("sends an authenticated customer straight to their own order history", async () => {
    mocks.useAuthSession.mockReturnValue({ status: "authenticated" });
    mocks.getLanding.mockResolvedValue([]);

    render(<StorefrontLanding />);

    expect(
      screen.getByRole("link", { name: "ติดตามคำสั่งซื้อ" }),
    ).toHaveAttribute("href", "/my/orders");
    expect(
      await screen.findByText("ยังไม่มีร้านค้าที่เปิดให้เข้าชม"),
    ).toBeInTheDocument();
  });

  it("holds the tracking link while a stored session is being checked", async () => {
    mocks.useAuthSession.mockReturnValue({ status: "loading" });
    mocks.getLanding.mockResolvedValue([]);

    const { rerender } = render(<StorefrontLanding />);

    expect(
      screen.getByText("กำลังตรวจสอบบัญชี"),
    ).toHaveTextContent("กำลังตรวจสอบบัญชี");
    expect(
      screen.queryByRole("link", { name: "ติดตามคำสั่งซื้อ" }),
    ).not.toBeInTheDocument();

    mocks.useAuthSession.mockReturnValue({ status: "authenticated" });
    rerender(<StorefrontLanding />);

    expect(
      screen.getByRole("link", { name: "ติดตามคำสั่งซื้อ" }),
    ).toHaveAttribute("href", "/my/orders");
    expect(
      await screen.findByText("ยังไม่มีร้านค้าที่เปิดให้เข้าชม"),
    ).toBeInTheDocument();
  });

  it("offers an in-place retry when loading the marketplace fails", async () => {
    mocks.getLanding
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce([]);

    render(<StorefrontLanding />);

    const retry = await screen.findByRole("button", {
      name: "ลองโหลดอีกครั้ง",
    });
    fireEvent.click(retry);

    expect(mocks.getLanding).toHaveBeenCalledTimes(2);
    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "ยังไม่มีร้านค้าที่เปิดให้เข้าชม",
      }),
    ).toBeInTheDocument();
  });
});
