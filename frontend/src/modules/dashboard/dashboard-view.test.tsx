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

  it("trims and submits only campaignId/storeId report filters", async () => {
    render(<DashboardView organizationId="org-1" />);

    await screen.findByText("฿25,000.00");

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
  });
});