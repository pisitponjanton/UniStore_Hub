import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CampaignDTO, StoreDTO } from "@/types";

const mocks = vi.hoisted(() => ({
  listCampaigns: vi.fn(),
  create: vi.fn(),
  get: vi.fn(),
  update: vi.fn(),
  listStores: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("@/modules/auth", () => ({
  authSession: {
    logout: mocks.logout,
  },
  isDefinitiveSessionFailure: () => false,
}));

vi.mock("@/modules/stores", () => ({
  storeService: {
    list: mocks.listStores,
  },
}));

vi.mock("./campaign-service", () => ({
  campaignService: {
    list: mocks.listCampaigns,
    create: mocks.create,
    get: mocks.get,
    update: mocks.update,
  },
}));

import { CampaignManagementView } from "./campaign-view";

const store: StoreDTO = {
  storeId: "store-1",
  organizationId: "org-1",
  name: "Main Store",
  description: "",
  status: "ACTIVE",
  createdAt: "2026-09-29T09:00:00.000Z",
  updatedAt: "2026-09-29T09:00:00.000Z",
};

function campaign(
  overrides: Partial<CampaignDTO> = {},
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
    status: "DRAFT",
    createdAt: "2026-09-29T10:00:00.000Z",
    updatedAt: "2026-09-29T10:00:00.000Z",
    ...overrides,
  };
}

describe("CampaignManagementView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listStores.mockResolvedValue([store]);
    mocks.listCampaigns.mockResolvedValue({
      items: [campaign()],
      nextCursor: null,
    });
  });

  it("focuses a linked error summary when campaign creation validation fails", async () => {
    render(<CampaignManagementView organizationId="org-1" />);

    await screen.findByText("Faculty Shirt Pre-order");

    fireEvent.click(
      screen.getByRole("button", { name: "สร้างแคมเปญ" }),
    );

    const summary = await screen.findByRole("alert");
    expect(
      screen.getByRole("link", { name: "กรุณาระบุชื่อ Campaign" }),
    ).toHaveAttribute("href", "#campaign-create-name");
    await waitFor(() => expect(summary).toHaveFocus());
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("announces the applied campaign filter with useful context", async () => {
    mocks.listCampaigns
      .mockResolvedValueOnce({
        items: [campaign()],
        nextCursor: null,
      })
      .mockResolvedValueOnce({
        items: [campaign({ status: "OPEN" })],
        nextCursor: null,
      });

    render(<CampaignManagementView organizationId="org-1" />);

    await screen.findByText("Faculty Shirt Pre-order");

    fireEvent.change(screen.getByLabelText("สถานะ"), {
      target: { value: "OPEN" },
    });

    expect(
      await screen.findByText(
        "แสดง 1 แคมเปญ · ทุกร้านค้า · เปิดรับคำสั่งซื้อ",
      ),
    ).toHaveAttribute("role", "status");
    expect(mocks.listCampaigns).toHaveBeenLastCalledWith("org-1", {
      storeId: null,
      status: "OPEN",
    });
  });

  it("creates a DRAFT campaign using nullable planning timestamps", async () => {
    const created = campaign({
      campaignId: "campaign-2",
      name: "New Campaign",
    });
    mocks.create.mockResolvedValue(created);

    render(<CampaignManagementView organizationId="org-1" />);

    await screen.findByText("Faculty Shirt Pre-order");

    fireEvent.change(
      screen.getByLabelText(/ชื่อแคมเปญ/, {
        selector: "#campaign-create-name",
      }),
      {
        target: { value: "  New Campaign  " },
      },
    );

    fireEvent.click(
      screen.getByRole("button", { name: "สร้างแคมเปญ" }),
    );

    await waitFor(() => {
      expect(mocks.create).toHaveBeenCalledWith("org-1", {
        storeId: "store-1",
        name: "New Campaign",
        openAt: null,
        closeAt: null,
        paymentDeadline: null,
        pickupAt: null,
      });
    });

    expect(
      await screen.findByText(
        "สร้างแคมเปญ New Campaign เป็นฉบับร่างแล้ว",
      ),
    ).toBeInTheDocument();
  });

  it("loads fresh DRAFT detail before editing and serializes planning fields through the helper", async () => {
    const fresh = campaign({
      name: "Fresh Campaign",
      openAt: "2026-10-01T02:00:00.000Z",
    });
    const updated = campaign({
      name: "Updated Campaign",
      openAt: "2026-10-01T02:00:00.000Z",
      updatedAt: "2026-09-29T11:00:00.000Z",
    });

    mocks.get.mockResolvedValue(fresh);
    mocks.update.mockResolvedValue(updated);

    render(<CampaignManagementView organizationId="org-1" />);

    await screen.findByText("Faculty Shirt Pre-order");

    fireEvent.click(
      screen.getByRole("button", { name: "ดูและแก้ไข" }),
    );

    expect(mocks.get).toHaveBeenCalledWith(
      "org-1",
      "campaign-1",
    );

    const name = await screen.findByDisplayValue("Fresh Campaign");
    fireEvent.change(name, {
      target: { value: "Updated Campaign" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: "บันทึกฉบับร่าง" }),
    );

    await waitFor(() => {
      expect(mocks.update).toHaveBeenCalledWith(
        "org-1",
        "campaign-1",
        expect.objectContaining({
          storeId: "store-1",
          name: "Updated Campaign",
          openAt: "2026-10-01T02:00:00.000Z",
          closeAt: null,
          paymentDeadline: null,
          pickupAt: null,
        }),
      );
    });

    expect(
      await screen.findByText(
        "บันทึกแคมเปญ Updated Campaign แล้ว",
      ),
    ).toBeInTheDocument();
  });

  it("shows non-DRAFT campaigns read-only and does not infer lifecycle from planned dates", async () => {
    const openCampaign = campaign({
      status: "OPEN",
      openAt: "2020-01-01T00:00:00.000Z",
      closeAt: "2020-01-02T00:00:00.000Z",
    });

    mocks.listCampaigns.mockResolvedValue({
      items: [openCampaign],
      nextCursor: null,
    });
    mocks.get.mockResolvedValue(openCampaign);

    render(<CampaignManagementView organizationId="org-1" />);

    expect(
      (await screen.findAllByText("เปิดรับคำสั่งซื้อ")).length,
    ).toBeGreaterThan(0);

    fireEvent.click(
      screen.getByRole("button", { name: "ดูรายละเอียด" }),
    );

    expect(
      await screen.findByText(
        /หลังออกจากฉบับร่าง ข้อมูลแผนจะแสดงแบบอ่านอย่างเดียว/,
      ),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("button", { name: "บันทึกฉบับร่าง" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "ปิดรับคำสั่งซื้อ" }),
    ).toBeInTheDocument();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("shows the next source-defined lifecycle action in the campaign list", async () => {
    mocks.listCampaigns.mockResolvedValue({
      items: [
        campaign({
          campaignId: "campaign-open",
          name: "Open Campaign",
          status: "OPEN",
          openAt: "2020-01-01T00:00:00.000Z",
          closeAt: "2020-01-02T00:00:00.000Z",
        }),
        campaign({
          campaignId: "campaign-completed",
          name: "Completed Campaign",
          status: "COMPLETED",
        }),
      ],
      nextCursor: null,
    });

    render(<CampaignManagementView organizationId="org-1" />);
    const openCard = (await screen.findByRole("heading", {
      name: "Open Campaign",
    })).closest("article");
    const completedCard = screen.getByRole("heading", {
      name: "Completed Campaign",
    }).closest("article");
    expect(openCard).not.toBeNull();
    expect(completedCard).not.toBeNull();
    expect(within(openCard as HTMLElement).getByText("ปิดรับคำสั่งซื้อ")).toBeInTheDocument();
    expect(within(completedCard as HTMLElement).getByText("เสร็จสิ้นแล้ว")).toBeInTheDocument();
  });
});
