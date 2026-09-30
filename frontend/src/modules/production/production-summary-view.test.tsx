import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProductionSummaryDTO } from "@/types";

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

vi.mock("./production-service", () => ({
  productionService: {
    getSummary: mocks.getSummary,
  },
}));

import { ProductionSummaryView } from "./production-summary-view";

const summary: ProductionSummaryDTO = {
  campaignId: "campaign-1",
  products: [
    {
      productId: "product-1",
      productName: "Faculty Shirt",
      variants: [
        {
          variantId: "variant-1",
          variantName: "Size M",
          quantity: 24,
        },
        {
          variantId: "variant-2",
          variantName: "Size L",
          quantity: 12,
        },
      ],
    },
  ],
};

describe("ProductionSummaryView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, "", "/org/production/?organizationId=org-1");
  });

  it("does not call the required-query endpoint until a Campaign ID exists", () => {
    render(
      <ProductionSummaryView
        organizationId="org-1"
        initialCampaignId={null}
      />,
    );

    expect(
      screen.getByText(
        "ระบุ Campaign ID เพื่อโหลดสรุปการผลิตจาก Backend",
      ),
    ).toBeInTheDocument();
    expect(mocks.getSummary).not.toHaveBeenCalled();
  });

  it("loads and displays only the Backend Production Summary grouped by Product and Variant", async () => {
    mocks.getSummary.mockResolvedValue(summary);

    render(
      <ProductionSummaryView
        organizationId="org-1"
        initialCampaignId="campaign-1"
      />,
    );

    expect(
      await screen.findByText("Faculty Shirt"),
    ).toBeInTheDocument();
    expect(screen.getByText("Size M")).toBeInTheDocument();
    expect(screen.getByText("Size L")).toBeInTheDocument();
    expect(screen.getByText("24")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();

    expect(mocks.getSummary).toHaveBeenCalledWith(
      "org-1",
      "campaign-1",
      {
        signal: expect.any(AbortSignal),
      },
    );
  });

  it("shows a meaningful empty state when Backend returns no paid production quantities", async () => {
    mocks.getSummary.mockResolvedValue({
      campaignId: "campaign-empty",
      products: [],
    });

    render(
      <ProductionSummaryView
        organizationId="org-1"
        initialCampaignId="campaign-empty"
      />,
    );

    expect(
      await screen.findByText("ยังไม่มีรายการที่ต้องผลิต"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Payment APPROVED/),
    ).toBeInTheDocument();
  });

  it("trims manual Campaign ID, loads the summary, and keeps the static route in query context", async () => {
    mocks.getSummary.mockResolvedValue(summary);

    render(
      <ProductionSummaryView
        organizationId="org-1"
        initialCampaignId={null}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Campaign ID/), {
      target: { value: "  campaign-1  " },
    });
    fireEvent.click(
      screen.getByRole("button", {
        name: "โหลดสรุปการผลิต",
      }),
    );

    await waitFor(() => {
      expect(mocks.getSummary).toHaveBeenCalledWith(
        "org-1",
        "campaign-1",
      );
    });

    expect(
      await screen.findByText("Faculty Shirt"),
    ).toBeInTheDocument();
    expect(window.location.search).toBe(
      "?organizationId=org-1&campaignId=campaign-1",
    );
  });
});
