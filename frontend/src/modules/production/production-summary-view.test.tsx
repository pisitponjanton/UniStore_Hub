import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CampaignDTO, ProductionSummaryDTO } from "@/types";

const mocks = vi.hoisted(() => ({
  getSummary: vi.fn(),
  listCampaigns: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("@/modules/auth", () => ({
  authSession: { logout: mocks.logout },
  isDefinitiveSessionFailure: () => false,
}));
vi.mock("@/modules/campaigns/campaign-service", () => ({
  campaignService: { list: mocks.listCampaigns },
}));
vi.mock("./production-service", () => ({
  productionService: { getSummary: mocks.getSummary },
}));

import { ProductionSummaryView } from "./production-summary-view";

const summary: ProductionSummaryDTO = {
  campaignId: "campaign-1",
  products: [{
    productId: "product-1",
    productName: "Faculty Shirt",
    variants: [
      { variantId: "variant-1", variantName: "Size M", quantity: 24 },
      { variantId: "variant-2", variantName: "Size L", quantity: 12 },
    ],
  }],
};
const campaigns: CampaignDTO[] = [{
  organizationId: "org-1",
  campaignId: "campaign-1",
  storeId: "store-1",
  name: "Faculty Shirt Preorder",
  status: "CLOSED",
  openAt: null, closeAt: null, paymentDeadline: null, pickupAt: null,
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-01T00:00:00Z",
}, {
  organizationId: "org-1",
  campaignId: "campaign-2",
  storeId: "store-1",
  name: "Club Bag",
  status: "PRODUCING",
  openAt: null, closeAt: null, paymentDeadline: null, pickupAt: null,
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-01T00:00:00Z",
}];

function view(initialCampaignId: string | null = null) {
  return render(<ProductionSummaryView organizationId="org-1" initialCampaignId={initialCampaignId} />);
}
function combo() {
  return screen.getByRole("combobox", { name: "เลือกแคมเปญ" });
}
function openPicker() {
  fireEvent.focus(combo());
}
function typeQuery(value: string) {
  fireEvent.change(combo(), { target: { value } });
}
function enter() {
  fireEvent.keyDown(combo(), { key: "Enter" });
}

describe("ProductionSummaryView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listCampaigns.mockResolvedValue({ items: campaigns, nextCursor: null });
    mocks.getSummary.mockResolvedValue(summary);
    window.history.replaceState({}, "", "/org/production/?organizationId=org-1");
  });

  it("shows one combobox and no redundant manual form or production GET before selection", async () => {
    view();
    expect(screen.getByText("เลือกแคมเปญเพื่อดูยอดผลิต")).toBeInTheDocument();
    expect(screen.getAllByRole("combobox")).toHaveLength(1);
    expect(screen.queryByText("มีรหัสแคมเปญอยู่แล้ว? กรอกรหัสเอง")).not.toBeInTheDocument();
    expect(mocks.getSummary).not.toHaveBeenCalled();
    openPicker();
    expect(await screen.findByRole("option", { name: /Faculty Shirt Preorder/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Club Bag/ })).toBeInTheDocument();
  });

  it("selects an existing campaign with one click and loads Backend-only quantities", async () => {
    view();
    openPicker();
    fireEvent.click(await screen.findByRole("option", { name: /Faculty Shirt Preorder/ }));
    await waitFor(() => expect(mocks.getSummary).toHaveBeenCalledWith("org-1", "campaign-1"));
    expect(await screen.findByText("Faculty Shirt")).toBeInTheDocument();
    expect(screen.getByText("Size M")).toBeInTheDocument();
    expect(screen.getByText("Size L")).toBeInTheDocument();
    expect(screen.getByText("24")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(window.location.search).toBe("?organizationId=org-1&campaignId=campaign-1");
    expect(combo()).toHaveValue("Faculty Shirt Preorder");
  });

  it("uses the same editable input to search by name and keyboard-select the result", async () => {
    view();
    openPicker();
    await screen.findByRole("option", { name: /Faculty Shirt Preorder/ });
    typeQuery("Club");
    expect(screen.queryByRole("option", { name: /Faculty Shirt Preorder/ })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Club Bag/ })).toBeInTheDocument();
    fireEvent.keyDown(combo(), { key: "ArrowDown" });
    expect(combo()).toHaveAttribute("aria-activedescendant", "production-option-0");
    enter();
    await waitFor(() => expect(mocks.getSummary).toHaveBeenCalledWith("org-1", "campaign-2"));
    expect(combo()).toHaveValue("Club Bag");
    expect(combo()).toHaveAttribute("aria-expanded", "false");
  });

  it("supports cursor pagination without incorrectly saying there are no campaigns", async () => {
    const extra: CampaignDTO = { ...campaigns[0], name: "New Faculty Jacket", campaignId: "campaign-3" };
    mocks.listCampaigns.mockResolvedValueOnce({ items: campaigns, nextCursor: "next-cursor" })
      .mockResolvedValueOnce({ items: [extra], nextCursor: null });
    view();
    openPicker();
    await screen.findByRole("option", { name: /Faculty Shirt Preorder/ });
    typeQuery("Jacket");
    expect(screen.getByText("ไม่พบในรายการที่โหลด ลองโหลดแคมเปญเพิ่มเติม")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "โหลดแคมเปญเพิ่มเติม" }));
    expect(await screen.findByRole("option", { name: /New Faculty Jacket/ })).toBeInTheDocument();
    expect(mocks.listCampaigns).toHaveBeenLastCalledWith("org-1", { cursor: "next-cursor" });
    fireEvent.click(screen.getByRole("option", { name: /New Faculty Jacket/ }));
    await waitFor(() => expect(mocks.getSummary).toHaveBeenCalledWith("org-1", "campaign-3"));
  });

  it("keeps URL deep links working even when campaign is not on the first page", async () => {
    mocks.listCampaigns.mockResolvedValue({ items: [], nextCursor: "next" });
    view("campaign-1");
    expect(await screen.findByText("Faculty Shirt")).toBeInTheDocument();
    expect(mocks.getSummary).toHaveBeenCalledWith("org-1", "campaign-1", {
      signal: expect.any(AbortSignal),
    });
    expect(combo()).toHaveValue("campaign-1");
  });

  it("shows read-only empty summary", async () => {
    mocks.getSummary.mockResolvedValue({ campaignId: "campaign-empty", products: [] });
    view("campaign-empty");
    expect(await screen.findByText("ยังไม่มีรายการที่ต้องผลิต")).toBeInTheDocument();
  });

  it("validates an empty input without any production request", async () => {
    view();
    openPicker();
    enter();
    expect(await screen.findByRole("alert")).toHaveTextContent("กรุณาเลือกแคมเปญหรือระบุ Campaign ID");
    expect(combo()).toHaveAttribute("aria-invalid", "true");
    expect(mocks.getSummary).not.toHaveBeenCalled();
  });

  it("can submit a typed Campaign ID via the same combobox and preserve URL", async () => {
    view();
    openPicker();
    typeQuery("  campaign-outside-list  ");
    enter();
    await waitFor(() => expect(mocks.getSummary).toHaveBeenCalledWith("org-1", "campaign-outside-list"));
    expect(window.location.search).toBe("?organizationId=org-1&campaignId=campaign-outside-list");
  });

  it("separates empty directory and directory failure while preserving direct ID entry", async () => {
    mocks.listCampaigns.mockResolvedValueOnce({ items: [], nextCursor: null });
    const empty = view();
    openPicker();
    expect(await screen.findByText("ยังไม่มีแคมเปญในหน่วยงานนี้")).toBeInTheDocument();
    empty.unmount();

    mocks.listCampaigns.mockRejectedValueOnce(new Error("offline"));
    view();
    openPicker();
    expect(await screen.findByText(/โหลดรายการไม่ได้/)).toBeInTheDocument();
    typeQuery("campaign-1");
    enter();
    expect(await screen.findByText("Faculty Shirt")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "รีเฟรชสรุปการผลิต" }));
    await waitFor(() => expect(mocks.getSummary).toHaveBeenCalledTimes(2));
  });

  it("closes and restores selected name on Escape without submitting", async () => {
    view();
    openPicker();
    fireEvent.click(await screen.findByRole("option", { name: /Faculty Shirt Preorder/ }));
    await screen.findByText("Faculty Shirt");
    openPicker();
    typeQuery("unrelated");
    fireEvent.keyDown(combo(), { key: "Escape" });
    expect(combo()).toHaveValue("Faculty Shirt Preorder");
    expect(combo()).toHaveAttribute("aria-expanded", "false");
    expect(mocks.getSummary).toHaveBeenCalledTimes(1);
  });
});
