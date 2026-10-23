import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { StorefrontStoreView } from "./storefront-service";

const mocks = vi.hoisted(() => ({ getStoreView: vi.fn() }));

vi.mock("./storefront-service", () => ({
  storefrontService: { getStoreView: mocks.getStoreView },
}));
vi.mock("./storefront-header", () => ({
  StorefrontHeader: () => <header>UniStore Hub</header>,
}));

import { StoreView } from "./store-view";

const organizationId = "55555555-5555-4555-8555-555555555555";
const storeId = "66666666-6666-4666-8666-666666666666";

function dataWithCatalog(): StorefrontStoreView {
  return {
    store: {
      storeId,
      organizationId,
      name: "Local Demo Store",
      description: "ร้านค้าที่เปิดรับพรีออเดอร์",
      status: "ACTIVE",
    },
    products: [
      {
        organizationId,
        storeId,
        productId: "product-1",
        name: "Local Demo Product",
        description: "ตัวเลือกสินค้า",
        imageUrl: null,
        status: "ACTIVE",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    campaigns: [
      {
        organizationId,
        storeId,
        campaignId: "campaign-1",
        name: "Local Demo Campaign",
        openAt: "2026-10-01T00:00:00.000Z",
        closeAt: "2026-10-20T00:00:00.000Z",
        paymentDeadline: "2026-10-21T00:00:00.000Z",
        pickupAt: "2026-10-28T00:00:00.000Z",
        status: "OPEN",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
  };
}

describe("StoreView mobile shopping hierarchy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState(
      null, "", `/stores/view/?organizationId=${organizationId}&storeId=${storeId}`,
    );
  });

  it("exposes direct campaign and product anchors while preserving identity and counts", async () => {
    mocks.getStoreView.mockResolvedValue(dataWithCatalog());
    const { container } = render(<StoreView />);

    expect(await screen.findByRole("heading", { name: "Local Demo Store" })).toBeInTheDocument();
    expect(screen.getByText("ร้านค้าที่เปิดรับพรีออเดอร์")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "ทางลัดไปรายการในร้าน" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ดูรอบพรีออเดอร์" })).toHaveAttribute(
      "href", "#campaign-heading",
    );
    expect(screen.getByRole("link", { name: "เลือกดูสินค้า" })).toHaveAttribute(
      "href", "#product-heading",
    );
    expect(screen.getByRole("heading", { name: "รอบพรีออเดอร์ของร้าน" })).toHaveAttribute(
      "id", "campaign-heading",
    );
    expect(screen.getByRole("heading", { name: "สินค้าของร้าน" })).toHaveAttribute(
      "id", "product-heading",
    );
    expect(screen.getAllByText("1", { selector: "dd" })).toHaveLength(2);
    // Product imagery is never invented when the store has no media.
    expect(container.querySelector('[class*="storeHeroVisual"]')).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Local Demo Product/ })).toHaveAttribute(
      "href", `/products/view?organizationId=${organizationId}&productId=product-1`,
    );
    expect(screen.getByRole("link", { name: /Local Demo Campaign/ })).toHaveAttribute(
      "href", `/campaigns/view?organizationId=${organizationId}&campaignId=campaign-1`,
    );
  });

  it("keeps direct navigation and accurate counts when no campaigns or products exist", async () => {
    mocks.getStoreView.mockResolvedValue({
      ...dataWithCatalog(),
      products: [],
      campaigns: [],
    });

    render(<StoreView />);
    expect(await screen.findByRole("heading", { name: "Local Demo Store" })).toBeInTheDocument();
    expect(screen.getAllByText("0", { selector: "dd" })).toHaveLength(2);
    expect(screen.getByRole("link", { name: "ดูรอบพรีออเดอร์" })).toHaveAttribute(
      "href", "#campaign-heading",
    );
    expect(screen.getByRole("link", { name: "เลือกดูสินค้า" })).toHaveAttribute(
      "href", "#product-heading",
    );
    expect(screen.getByText("ร้านนี้ยังไม่มีแคมเปญที่เปิดให้ลูกค้าเข้าชม")).toBeInTheDocument();
    expect(screen.getByText("ร้านนี้ยังไม่มีสินค้าที่เปิดให้เข้าชม")).toBeInTheDocument();
  });

  it("filters store products by name or description without changing the original catalog", async () => {
    mocks.getStoreView.mockResolvedValue(dataWithCatalog());
    render(<StoreView />);
    await screen.findByRole("heading", { name: "Local Demo Store" });
    const search = screen.getByRole("searchbox", { name: "ค้นหาสินค้าในร้าน" });
    fireEvent.change(search, { target: { value: "ไม่พบ" } });
    expect(screen.getByText("ไม่พบสินค้าที่ตรงกับการค้นหา")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Local Demo Product/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "ล้างคำค้นหา" }));
    expect(search).toHaveValue("");
    expect(screen.getByRole("link", { name: /Local Demo Product/ })).toHaveAttribute(
      "href", `/products/view?organizationId=${organizationId}&productId=product-1`,
    );
  });

  it("shows only OPEN campaigns when filtered and keeps the back-to-all control", async () => {
    const data = dataWithCatalog();
    mocks.getStoreView.mockResolvedValue({
      ...data,
      campaigns: data.campaigns.map(c => ({ ...c, status: "CLOSED" as const })),
    });
    render(<StoreView />);
    await screen.findByRole("heading", { name: "Local Demo Store" });
    const filter = screen.getByRole("combobox", { name: "สถานะรอบขาย" });
    fireEvent.change(filter, { target: { value: "open" } });
    expect(screen.getByText(/ไม่มีรอบที่เปิดรับคำสั่งซื้อในขณะนี้/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Local Demo Campaign/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "ดูรอบขายทั้งหมด" }));
    expect(filter).toHaveValue("all");
    expect(screen.getByRole("link", { name: /Local Demo Campaign/ })).toBeInTheDocument();
  });

  it("jumps to store sections with keyboard focus without corrupting browser history", async () => {
    mocks.getStoreView.mockResolvedValue(dataWithCatalog());
    render(<StoreView />);
    expect(await screen.findByRole("heading", { name: "Local Demo Store" })).toBeInTheDocument();
    const scrollIntoView = vi.fn();
    const original = HTMLElement.prototype.scrollIntoView;
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });

    try {
      const originalUrl = window.location.href;
      fireEvent.click(screen.getByRole("link", { name: /^เลือกดูสินค้า$/ }));
      expect(screen.getByRole("heading", { name: "สินค้าของร้าน" })).toHaveFocus();
      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "start" });
      expect(window.location.href).toBe(originalUrl);

      fireEvent.click(screen.getByRole("link", { name: /^ดูรอบพรีออเดอร์$/ }));
      expect(screen.getByRole("heading", { name: "รอบพรีออเดอร์ของร้าน" })).toHaveFocus();
      expect(window.location.href).toBe(originalUrl);
    } finally {
      if (original) {
        Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
          configurable: true,
          value: original,
        });
      } else {
        delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
      }
    }
  });


  it("sorts products by newest and by Thai name without changing the storefront links", async () => {
    const data = dataWithCatalog();
    const secondProduct = {
      ...data.products[0],
      productId: "product-2",
      name: "Another Product",
      createdAt: "2026-09-20T00:00:00.000Z",
    };
    mocks.getStoreView.mockResolvedValue({
      ...data,
      products: [...data.products, secondProduct],
    });
    const { container } = render(<StoreView />);
    await screen.findByRole("heading", { name: "Local Demo Store" });
    const order = () => [...container.querySelectorAll('a[href*="/products/view"] h3')].map(node => node.textContent);
    expect(order()).toEqual(["Local Demo Product", "Another Product"]);
    const sort = screen.getByRole("combobox", { name: "เรียงสินค้า" });
    fireEvent.change(sort, { target: { value: "recent" } });
    expect(order()).toEqual(["Another Product", "Local Demo Product"]);
    fireEvent.change(sort, { target: { value: "name" } });
    expect(order()).toEqual(["Another Product", "Local Demo Product"]);
    fireEvent.change(sort, { target: { value: "featured" } });
    expect(order()).toEqual(["Local Demo Product", "Another Product"]);
  });
});
