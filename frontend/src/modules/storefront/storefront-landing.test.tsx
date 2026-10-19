import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

  afterEach(() => {
    vi.unstubAllEnvs();
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
        name: /ร้านค้าและพรีออเดอร์\s*ในมหาวิทยาลัย/,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "เลือกดูร้านค้า" }),
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
    expect(screen.queryByRole("heading", { name: "ร้านค้าอื่นที่น่าสนใจ" }))
      .not.toBeInTheDocument();
    const storeLinks = screen.getAllByRole("link", { name: /ร้านชมรม/ });
    expect(storeLinks).toHaveLength(2);
    expect(storeLinks[0]).toHaveAttribute(
      "href",
      "/stores/view?organizationId=org-1&storeId=store-1",
    );
    const spotlight = document.querySelector('a[class*="heroSpotlight"]');
    expect(spotlight).toHaveTextContent("ร้านชมรม");
    expect(spotlight).toHaveAttribute(
      "href",
      "/stores/view?organizationId=org-1&storeId=store-1",
    );
    expect(screen.getByText("มีร้านค้า", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("1 ร้าน")).toBeInTheDocument();
  });

  it("keeps explicit QA fixtures opt-in only in Dev and restores them on request", async () => {
    vi.stubEnv("NODE_ENV", "development");
    mocks.getLanding.mockResolvedValue([
      {
        organization: {
          organizationId: "real-org", name: "Campus Club", description: "", status: "ACTIVE",
        },
        stores: [{
          storeId: "real-store", organizationId: "real-org",
          name: "Official Campus Store", description: "", status: "ACTIVE",
        }],
      },
      {
        organization: {
          organizationId: "test-org", name: "QA Commerce Org phase5-123-1",
          description: "", status: "ACTIVE",
        },
        stores: [{
          storeId: "test-store", organizationId: "test-org",
          name: "Temporary Shop", description: "", status: "ACTIVE",
        }],
      },
    ]);
    render(<StorefrontLanding />);
    const show = await screen.findByRole("button", { name: /แสดงข้อมูล E2E\/QA/ });
    expect(screen.getAllByText("Official Campus Store").length).toBeGreaterThan(0);
    expect(screen.queryByText("Temporary Shop")).not.toBeInTheDocument();
    expect(show).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(show);
    expect(screen.getAllByText("Temporary Shop").length).toBeGreaterThan(0);
    const hide = screen.getByRole("button", { name: "ซ่อนข้อมูล E2E/QA" });
    expect(hide).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(hide);
    expect(screen.queryByText("Temporary Shop")).not.toBeInTheDocument();
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


  it("shows a bounded list while keeping every store searchable across pages", async () => {
    mocks.getLanding.mockResolvedValue([
      {
        organization: {
          organizationId: "org-1",
          name: "มหาวิทยาลัยทดสอบ",
          description: "",
          status: "ACTIVE",
        },
        stores: Array.from({ length: 30 }, (_, index) => ({
          storeId: `store-${index}`,
          organizationId: "org-1",
          name: `ร้าน-${index}`,
          description: "",
          status: "ACTIVE",
        })),
      },
    ]);

    render(<StorefrontLanding />);
    expect(await screen.findByText("หน้า 1 จาก 3")).toBeInTheDocument();
    // Twelve paged directory rows plus a real-store hero and three distinct discovery cards.
    expect(screen.getAllByRole("link", { name: /ร้าน-\d+/ })).toHaveLength(16);
    fireEvent.click(screen.getByRole("button", { name: "ถัดไป" }));
    expect(screen.getByText("หน้า 2 จาก 3")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "ร้าน-12" })).toBeInTheDocument();

    fireEvent.change(
      screen.getByRole("searchbox", { name: "ค้นหาร้านค้าหรือหน่วยงาน" }),
      { target: { value: "ร้าน-29" } },
    );
    expect(screen.getByRole("heading", { name: "ร้าน-29" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ถัดไป" })).not.toBeInTheDocument();
    expect(screen.getByText(/แสดง 1–1 จาก 1 รายการ/)).toBeInTheDocument();
  });

  it("supports empty results, a no-store filter and clearing filters", async () => {
    mocks.getLanding.mockResolvedValue([
      {
        organization: { organizationId: "org-1", name: "ชมรมไอที", description: "", status: "ACTIVE" },
        stores: [{ storeId: "store-1", organizationId: "org-1", name: "IT Shop", description: "", status: "ACTIVE" }],
      },
      {
        organization: { organizationId: "org-2", name: "ชมรมถ่ายภาพ", description: "", status: "ACTIVE" },
        stores: [],
      },
    ]);

    render(<StorefrontLanding />);
    expect(await screen.findByText("1 หน่วยงานที่ยังไม่มีร้าน", { exact: false })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox", { name: "ค้นหาร้านค้าหรือหน่วยงาน" }), {
      target: { value: "not here" },
    });
    expect(screen.getByText("ไม่พบร้านค้าหรือหน่วยงานที่ตรงกับการค้นหา")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "แสดงรายการทั้งหมด" }));
    expect(screen.getByRole("searchbox", { name: "ค้นหาร้านค้าหรือหน่วยงาน" })).toHaveValue("");
    fireEvent.change(screen.getByRole("combobox", { name: "แสดงรายการ" }), {
      target: { value: "without-stores" },
    });
    expect(screen.getByRole("heading", { name: "ชมรมถ่ายภาพ" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "IT Shop" })).not.toBeInTheDocument();
  });

});
