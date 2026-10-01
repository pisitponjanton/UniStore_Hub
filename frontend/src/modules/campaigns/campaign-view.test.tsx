import {
  fireEvent,
  render,
  screen,
  waitFor,
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
});
