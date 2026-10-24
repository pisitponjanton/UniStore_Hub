import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { OrganizationReportDTO } from "@/types";

const mocks = vi.hoisted(() => ({
  getSummary: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("@/modules/auth", () => ({
  authSession: {
    logout: mocks.logout,
  },
  isDefinitiveSessionFailure: () => false,
}));

vi.mock("./dashboard-service", () => ({
  dashboardService: {
    getSummary: mocks.getSummary,
  },
}));

import { DashboardView } from "./dashboard-view";

const summary: OrganizationReportDTO = {
  totalStores: 2,
  totalProducts: 12,
  campaignsByStatus: {
    OPEN: 1,
    CLOSED: 2,
  },
  ordersByStatus: {
    PAID: 5,
    RECEIVED: 3,
  },
  pendingPaymentReviews: 4,
  paidOrderCount: 8,
  paidRevenueSatang: 2500000,
};

describe("DashboardView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSummary.mockResolvedValue(summary);
  });

  it("renders all contracted baseline report metrics from Backend data", async () => {
    render(<DashboardView organizationId="org-1" />);

    expect(
      await screen.findByText("฿25,000.00"),
    ).toBeInTheDocument();

    expect(screen.getAllByText("2").length).toBeGreaterThan(0);
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(
      screen.getByText("เปิดรับคำสั่งซื้อ"),
    ).toBeInTheDocument();
    expect(screen.getByText("ชำระเงินแล้ว")).toBeInTheDocument();

    expect(mocks.getSummary).toHaveBeenCalledWith("org-1", {
      signal: expect.any(AbortSignal),
    });
  });

  it("retries the initial organization report in place after a recoverable error", async () => {
    mocks.getSummary
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(summary);

    render(<DashboardView organizationId="org-1" />);

    fireEvent.click(
      await screen.findByRole("button", { name: "ลองโหลดอีกครั้ง" }),
    );

    expect(mocks.getSummary).toHaveBeenCalledTimes(2);
    await screen.findByText("฿25,000.00");
    expect(screen.getByRole("heading", { name: "ภาพรวมหน่วยงาน", level: 1 })).toBeInTheDocument();
  });

  it("shows only active statuses without disclosure controls", async () => {
    render(<DashboardView organizationId="org-1" />);
    await screen.findByText("฿25,000.00");
    expect(screen.getByText("เปิดรับคำสั่งซื้อ")).toBeInTheDocument();
    expect(screen.getByText("ชำระเงินแล้ว")).toBeInTheDocument();
    expect(screen.queryByText("ฉบับร่าง")).not.toBeInTheDocument();
    expect(screen.queryByText("รอชำระเงิน")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ดูทุกสถานะ" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ซ่อนสถานะที่เป็นศูนย์" })).not.toBeInTheDocument();
  });

  it("uses empty states instead of seven zero-status lines when there is no activity", async () => {
    mocks.getSummary.mockResolvedValue({
      ...summary,
      campaignsByStatus: {},
      ordersByStatus: {},
      pendingPaymentReviews: 0,
      paidOrderCount: 0,
      paidRevenueSatang: 0,
    });
    render(<DashboardView organizationId="org-1" />);
    expect(await screen.findByText("ยังไม่มีแคมเปญ")).toBeInTheDocument();
    expect(screen.getByText("ยังไม่มีคำสั่งซื้อ")).toBeInTheDocument();
    expect(screen.queryByText("เปิดรับคำสั่งซื้อ")).not.toBeInTheDocument();
    expect(screen.queryByText("ชำระเงินแล้ว")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ดูทุกสถานะ" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /จัดการแคมเปญ/ })).toHaveAttribute("href", "/org/campaigns?organizationId=org-1");
    expect(screen.getByRole("link", { name: /เปิดคำสั่งซื้อ/ })).toHaveAttribute("href", "/org/orders?organizationId=org-1");
  });

  it("closes filter on Escape/outside click and returns focus", async () => {
    render(<DashboardView organizationId="org-1" />);
    await screen.findByText("฿25,000.00");
    const toggle = screen.getByRole("button", { name: "ตัวกรอง" });
    fireEvent.click(toggle);
    expect(screen.getByRole("dialog", { name: "กรองรายงาน" })).toBeInTheDocument();
    expect(screen.getByLabelText("รหัสแคมเปญ")).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "กรองรายงาน" })).not.toBeInTheDocument();
    expect(toggle).toHaveFocus();
    fireEvent.click(toggle);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("dialog", { name: "กรองรายงาน" })).not.toBeInTheDocument();
  });

  it("preserves popover and draft after API error, then closes on success", async () => {
    mocks.getSummary.mockResolvedValueOnce(summary)
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(summary);
    render(<DashboardView organizationId="org-1" />);
    await screen.findByText("฿25,000.00");
    fireEvent.click(screen.getByRole("button", { name: "ตัวกรอง" }));
    fireEvent.change(screen.getByLabelText("รหัสแคมเปญ"), { target: { value: "campaign-1" } });
    fireEvent.click(screen.getByRole("button", { name: "ใช้ตัวกรอง" }));
    await screen.findByRole("alert");
    expect(screen.getByRole("dialog", { name: "กรองรายงาน" })).toBeInTheDocument();
    expect(screen.getByLabelText("รหัสแคมเปญ")).toHaveValue("campaign-1");
    fireEvent.click(screen.getByRole("button", { name: "ใช้ตัวกรอง" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "กรองรายงาน" })).not.toBeInTheDocument());
    expect(screen.getByText("แคมเปญ: campaign-1")).toBeInTheDocument();
  });

  it("trims and submits only campaignId/storeId report filters", async () => {
    render(<DashboardView organizationId="org-1" />);

    await screen.findByText("฿25,000.00");

    const toggle = screen.getByRole("button", { name: "ตัวกรอง" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByLabelText("รหัสแคมเปญ")).not.toBeInTheDocument();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    fireEvent.change(screen.getByLabelText("รหัสแคมเปญ"), {
      target: { value: "  campaign-1  " },
    });
    fireEvent.change(screen.getByLabelText("รหัสร้านค้า"), {
      target: { value: "  store-1  " },
    });

    fireEvent.click(
      screen.getByRole("button", { name: "ใช้ตัวกรอง" }),
    );

    await waitFor(() => {
      expect(mocks.getSummary).toHaveBeenLastCalledWith(
        "org-1",
        {
          campaignId: "campaign-1",
          storeId: "store-1",
        },
      );
    });

    expect(screen.getByText("ร้านค้า: store-1")).toBeInTheDocument();
    expect(screen.getByText("แคมเปญ: campaign-1")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "ร้านค้า: store-1แคมเปญ: campaign-1",
    );
  });
});