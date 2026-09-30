import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiClientError } from "@/services";
import type { CampaignDTO } from "@/types";

const mocks = vi.hoisted(() => ({
  transition: vi.fn(),
  get: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("@/modules/auth", () => ({
  authSession: {
    logout: mocks.logout,
  },
  isDefinitiveSessionFailure: () => false,
}));

vi.mock("./campaign-service", () => ({
  campaignService: {
    transition: mocks.transition,
    get: mocks.get,
  },
}));

import { CampaignLifecycleActions } from "./campaign-lifecycle-actions";

function campaign(
  status: CampaignDTO["status"],
): CampaignDTO {
  return {
    campaignId: "campaign-1",
    organizationId: "org-1",
    storeId: "store-1",
    name: "Faculty Shirt Pre-order",
    openAt: null,
    closeAt: null,
    paymentDeadline: null,
    pickupAt: null,
    status,
    createdAt: "2026-09-29T10:00:00.000Z",
    updatedAt: "2026-09-29T10:00:00.000Z",
  };
}

describe("CampaignLifecycleActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows only DRAFT actions, confirms open, and applies Backend-returned status", async () => {
    const opened = campaign("OPEN");
    mocks.transition.mockResolvedValue(opened);
    const onCampaignChanged = vi.fn();

    render(
      <CampaignLifecycleActions
        organizationId="org-1"
        campaign={campaign("DRAFT")}
        onCampaignChanged={onCampaignChanged}
      />,
    );

    expect(
      screen.getByRole("button", { name: "เปิด Campaign" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "ยกเลิก Campaign" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "เริ่มการผลิต" }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "เปิด Campaign" }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "เปิด Campaign",
      }),
    );

    await waitFor(() => {
      expect(mocks.transition).toHaveBeenCalledWith(
        "org-1",
        "campaign-1",
        "open",
      );
      expect(onCampaignChanged).toHaveBeenCalledWith(opened);
    });
  });

  it("surfaces PAYMENT_NOT_REVIEWABLE and refreshes Campaign after the conflict", async () => {
    const current = campaign("CLOSED");
    mocks.transition.mockRejectedValue(
      new ApiClientError({
        status: 409,
        code: "PAYMENT_NOT_REVIEWABLE",
        kind: "conflict",
      }),
    );
    mocks.get.mockResolvedValue(current);
    const onCampaignChanged = vi.fn();

    render(
      <CampaignLifecycleActions
        organizationId="org-1"
        campaign={current}
        onCampaignChanged={onCampaignChanged}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "เริ่มการผลิต" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "เริ่มการผลิต" }),
    );

    expect(
      await screen.findByText(
        "ยังมีคำสั่งซื้อที่อยู่ระหว่างตรวจสอบการชำระเงิน จึงยังไม่สามารถเริ่มการผลิตได้",
      ),
    ).toBeInTheDocument();

    expect(mocks.transition).toHaveBeenCalledWith(
      "org-1",
      "campaign-1",
      "start-production",
    );
    expect(mocks.get).toHaveBeenCalledWith(
      "org-1",
      "campaign-1",
    );
    expect(onCampaignChanged).toHaveBeenCalledWith(current);
  });

  it("shows no lifecycle mutation for terminal statuses", () => {
    render(
      <CampaignLifecycleActions
        organizationId="org-1"
        campaign={campaign("COMPLETED")}
        onCampaignChanged={vi.fn()}
      />,
    );

    expect(
      screen.getByText("ไม่มี lifecycle action สำหรับสถานะปัจจุบัน"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Campaign|สินค้า|ผลิต/ }),
    ).not.toBeInTheDocument();
  });
});
