import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProductDTO, StoreDTO } from "@/types";

const mocks = vi.hoisted(() => ({
  listProducts: vi.fn(),
  create: vi.fn(),
  get: vi.fn(),
  update: vi.fn(),
  deactivate: vi.fn(),
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

vi.mock("./product-service", () => ({
  productService: {
    list: mocks.listProducts,
    create: mocks.create,
    get: mocks.get,
    update: mocks.update,
    deactivate: mocks.deactivate,
  },
}));

import { ProductManagementView } from "./product-view";

const store: StoreDTO = {
  storeId: "store-1",
  organizationId: "org-1",
  name: "Main Store",
  description: "",
  status: "ACTIVE",
  createdAt: "2026-09-29T09:00:00.000Z",
  updatedAt: "2026-09-29T09:00:00.000Z",
};

const product: ProductDTO = {
  productId: "product-1",
  organizationId: "org-1",
  storeId: "store-1",
  name: "Faculty Shirt",
  description: "Pre-order shirt",
  imageKey: null,
  imageUrl: null,
  status: "ACTIVE",
  createdAt: "2026-09-29T10:00:00.000Z",
  updatedAt: "2026-09-29T10:00:00.000Z",
};

describe("ProductManagementView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listStores.mockResolvedValue([store]);
    mocks.listProducts.mockResolvedValue({
      items: [product],
      nextCursor: null,
    });
  });

  it("filters by store using the documented list query", async () => {
    render(<ProductManagementView organizationId="org-1" />);

    await screen.findByText("Faculty Shirt");

    fireEvent.change(
      screen.getByLabelText("กรองตามร้านค้า"),
      {
        target: { value: "store-1" },
      },
    );

    await waitFor(() => {
      expect(mocks.listProducts).toHaveBeenLastCalledWith(
        "org-1",
        {
          storeId: "store-1",
        },
      );
    });
  });

  it("creates a product with storeId, name, and description only", async () => {
    mocks.create.mockResolvedValue({
      ...product,
      productId: "product-2",
      name: "Faculty Bag",
      description: "Canvas bag",
    });

    render(<ProductManagementView organizationId="org-1" />);

    await screen.findByText("Faculty Shirt");

    fireEvent.change(
      screen.getByLabelText(/ชื่อสินค้า/),
      {
        target: { value: "  Faculty Bag  " },
      },
    );
    fireEvent.change(
      screen.getByLabelText(/คำอธิบาย/),
      {
        target: { value: "  Canvas bag  " },
      },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "สร้างสินค้า" }),
    );

    expect(mocks.create).toHaveBeenCalledWith("org-1", {
      storeId: "store-1",
      name: "Faculty Bag",
      description: "Canvas bag",
    });

    expect(
      await screen.findByText("สร้างสินค้า Faculty Bag แล้ว"),
    ).toBeInTheDocument();
  });

  it("loads fresh product detail before editing and updates only text fields", async () => {
    mocks.get.mockResolvedValue(product);
    mocks.update.mockResolvedValue({
      ...product,
      name: "Updated Shirt",
      description: "Updated description",
    });

    render(<ProductManagementView organizationId="org-1" />);

    await screen.findByText("Faculty Shirt");
    fireEvent.click(
      screen.getByRole("button", { name: "แก้ไขข้อมูล" }),
    );

    expect(mocks.get).toHaveBeenCalledWith(
      "org-1",
      "product-1",
    );

    const name = await screen.findByDisplayValue("Faculty Shirt");
    const description =
      screen.getByDisplayValue("Pre-order shirt");

    fireEvent.change(name, {
      target: { value: "Updated Shirt" },
    });
    fireEvent.change(description, {
      target: { value: "Updated description" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "บันทึกข้อมูล" }),
    );

    expect(mocks.update).toHaveBeenCalledWith(
      "org-1",
      "product-1",
      {
        name: "Updated Shirt",
        description: "Updated description",
      },
    );

    expect(
      await screen.findByText("บันทึกข้อมูลสินค้า Updated Shirt แล้ว"),
    ).toBeInTheDocument();
  });
});
