import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProductDTO, StoreDTO } from "@/types";

const mocks = vi.hoisted(() => ({
  listProducts: vi.fn(),
  create: vi.fn(),
  requestImageUploadUrl: vi.fn(),
  get: vi.fn(),
  update: vi.fn(),
  deactivate: vi.fn(),
  listStores: vi.fn(),
  getStore: vi.fn(),
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
    get: mocks.getStore,
  },
}));

vi.mock("./product-service", () => ({
  productService: {
    list: mocks.listProducts,
    create: mocks.create,
    requestImageUploadUrl: mocks.requestImageUploadUrl,
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

  it("uses the selected Store as the only source of truth for create and list", async () => {
    mocks.listProducts.mockResolvedValue({ items: [product], nextCursor: null });
    mocks.create.mockResolvedValue({ ...product, productId: "new", name: "Scoped Product" });
    render(<ProductManagementView organizationId="org-1" fixedStoreId="store-1" storeName="Main Store" />);
    await screen.findByText("Faculty Shirt");
    expect(mocks.getStore).toHaveBeenCalledWith("org-1", "store-1", expect.any(Object));
    expect(mocks.listStores).not.toHaveBeenCalled();
    expect(mocks.listProducts).toHaveBeenCalledWith("org-1", expect.objectContaining({storeId:"store-1"}));
    expect(screen.queryByLabelText("กรองตามร้านค้า")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "+ เพิ่มสินค้า" }));
    expect(screen.queryByLabelText("ร้านค้า")).toBeNull();
    fireEvent.change(screen.getByLabelText("ชื่อสินค้า"), {target:{value:"Scoped Product"}});
    fireEvent.click(screen.getByRole("button", {name:"สร้างสินค้า"}));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith("org-1", {
      storeId:"store-1", name:"Scoped Product", description:""
    }));
  });


  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listStores.mockResolvedValue([store]);
    mocks.getStore.mockResolvedValue(store);
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
    fireEvent.click(screen.getByRole("button", { name: "+ เพิ่มสินค้า" }));

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

  it("uploads a selected image after creating the product and reads back the saved cover", async () => {
    const newProduct = { ...product, productId: "product-2", name: "With Picture" };
    const imageKey = "products/org-1/product-2/11111111-1111-4111-8111-111111111111";
    const ready = { ...newProduct, imageKey, imageUrl: "/cover.png" };
    mocks.create.mockResolvedValue(newProduct);
    mocks.requestImageUploadUrl.mockResolvedValue({
      objectKey: imageKey, url: "/fake-put", method: "PUT", expiresInSeconds: 900,
    });
    mocks.update.mockResolvedValue(ready);
    mocks.get.mockResolvedValue(ready);
    const put = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", put);
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:preview") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    try {
      render(<ProductManagementView organizationId="org-1" fixedStoreId="store-1" storeName="Main Store" />);
      await screen.findByText("Faculty Shirt");
      fireEvent.click(screen.getByRole("button", { name: "+ เพิ่มสินค้า" }));
      fireEvent.change(screen.getByLabelText("ชื่อสินค้า"), { target: { value: "With Picture" } });
      const file = new File(["image"], "cover.png", { type: "image/png" });
      fireEvent.change(screen.getByLabelText("รูปสินค้า (ไม่บังคับ)"), { target: { files: [file] } });
      expect(screen.getByText("เลือกแล้ว: cover.png")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "สร้างสินค้า" }));
      await waitFor(() => expect(mocks.update).toHaveBeenCalledWith("org-1", "product-2", { imageKey }));
      expect(mocks.requestImageUploadUrl).toHaveBeenCalledWith("org-1", "product-2", "image/png");
      expect(put).toHaveBeenCalledWith("/fake-put", expect.objectContaining({ method: "PUT", body: file }));
      expect(mocks.get).toHaveBeenCalledWith("org-1", "product-2");
      expect(await screen.findByRole("img", { name: "รูปสินค้า With Picture" })).toHaveAttribute("src", "/cover.png");
    } finally { vi.unstubAllGlobals(); }
  });

  it("keeps a newly created product and shows a retry path if the cover upload fails", async () => {
    const newProduct = { ...product, productId: "product-3", name: "Needs Cover" };
    mocks.create.mockResolvedValue(newProduct);
    mocks.requestImageUploadUrl.mockRejectedValue(new Error("Signing failed"));
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:preview") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    render(<ProductManagementView organizationId="org-1" />);
    await screen.findByText("Faculty Shirt");
    fireEvent.click(screen.getByRole("button", { name: "+ เพิ่มสินค้า" }));
    fireEvent.change(screen.getByLabelText("ชื่อสินค้า"), { target: { value: "Needs Cover" } });
    fireEvent.change(screen.getByLabelText("รูปสินค้า (ไม่บังคับ)"), {
      target: { files: [new File(["image"], "cover.png", { type: "image/png" })] },
    });
    fireEvent.click(screen.getByRole("button", { name: "สร้างสินค้า" }));
    expect(await screen.findByText("Needs Cover")).toBeInTheDocument();
    expect(await screen.findByText(/สินค้า Needs Cover ถูกสร้างแล้ว แต่ยังบันทึกรูปไม่สำเร็จ/)).toBeInTheDocument();
    expect(mocks.update).not.toHaveBeenCalled();
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

  it("focuses a validation summary when creating a product without a name", async () => {
    render(<ProductManagementView organizationId="org-1" />);

    await screen.findByText("Faculty Shirt");
    fireEvent.click(screen.getByRole("button", { name: "+ เพิ่มสินค้า" }));

    fireEvent.click(
      screen.getByRole("button", { name: "สร้างสินค้า" }),
    );

    const summary = await screen.findByRole("alert");
    expect(
      screen.getByRole("link", { name: "กรุณาระบุชื่อสินค้า" }),
    ).toHaveAttribute("href", "#product-create-name");
    await waitFor(() => expect(summary).toHaveFocus());
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
