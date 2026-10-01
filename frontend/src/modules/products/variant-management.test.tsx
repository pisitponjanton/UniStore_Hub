import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ProductDTO,
  ProductVariantDTO,
} from "@/types";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  createVariant: vi.fn(),
  updateVariant: vi.fn(),
  deactivateVariant: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("@/modules/auth", () => ({
  authSession: {
    logout: mocks.logout,
  },
  isDefinitiveSessionFailure: () => false,
}));

vi.mock("./product-service", () => ({
  productService: {
    get: mocks.get,
    createVariant: mocks.createVariant,
    updateVariant: mocks.updateVariant,
    deactivateVariant: mocks.deactivateVariant,
  },
}));

import { VariantManagement } from "./variant-management";

const variant: ProductVariantDTO = {
  variantId: "variant-1",
  organizationId: "org-1",
  productId: "product-1",
  name: "Size M",
  price: 25000,
  status: "ACTIVE",
  createdAt: "2026-09-29T10:00:00.000Z",
  updatedAt: "2026-09-29T10:00:00.000Z",
};

function product(
  variants: ProductVariantDTO[] = [variant],
): ProductDTO {
  return {
    productId: "product-1",
    organizationId: "org-1",
    storeId: "store-1",
    name: "Faculty Shirt",
    description: "Pre-order shirt",
    imageKey: null,
    imageUrl: null,
    status: "ACTIVE",
    variants,
    createdAt: "2026-09-29T10:00:00.000Z",
    updatedAt: "2026-09-29T10:00:00.000Z",
  };
}

describe("VariantManagement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("converts THB input to integer satang before creating a Variant", async () => {
    const created: ProductVariantDTO = {
      ...variant,
      name: "Size L",
      price: 25050,
    };
    const refreshed = product([created]);

    mocks.createVariant.mockResolvedValue(created);
    mocks.get.mockResolvedValue(refreshed);
    const onProductRefreshed = vi.fn();

    render(
      <VariantManagement
        organizationId="org-1"
        product={product([])}
        onProductRefreshed={onProductRefreshed}
      />,
    );

    fireEvent.change(screen.getByLabelText(/ชื่อตัวเลือก/), {
      target: { value: "  Size L  " },
    });
    fireEvent.change(screen.getByLabelText(/ราคา \(บาท\)/), {
      target: { value: "250.50" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "เพิ่มตัวเลือก" }),
    );

    expect(
      await screen.findByText(
        "สร้างตัวเลือก Size L ราคา ฿250.50 แล้ว",
      ),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(mocks.createVariant).toHaveBeenCalledWith(
        "org-1",
        "product-1",
        {
          name: "Size L",
          price: 25050,
        },
      );
      expect(mocks.get).toHaveBeenCalledWith(
        "org-1",
        "product-1",
      );
      expect(onProductRefreshed).toHaveBeenCalledWith(refreshed);
    });
  });

  it("edits Variant name and THB price through integer satang API payload", async () => {
    const updated: ProductVariantDTO = {
      ...variant,
      name: "Size XL",
      price: 27050,
    };
    const refreshed = product([updated]);

    mocks.updateVariant.mockResolvedValue(updated);
    mocks.get.mockResolvedValue(refreshed);

    render(
      <VariantManagement
        organizationId="org-1"
        product={product()}
        onProductRefreshed={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "แก้ไขตัวเลือก" }),
    );

    const name = screen.getByDisplayValue("Size M");
    const price = screen.getByDisplayValue("250.00");

    fireEvent.change(name, {
      target: { value: "Size XL" },
    });
    fireEvent.change(price, {
      target: { value: "270.50" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "บันทึกตัวเลือก" }),
    );

    expect(mocks.updateVariant).toHaveBeenCalledWith(
      "org-1",
      "product-1",
      "variant-1",
      {
        name: "Size XL",
        price: 27050,
      },
    );
    expect(
      await screen.findByText(
        "บันทึกตัวเลือก Size XL ราคา ฿270.50 แล้ว",
      ),
    ).toBeInTheDocument();
  });

  it("requires confirmation before soft-deactivating a Variant", async () => {
    const inactive: ProductVariantDTO = {
      ...variant,
      status: "INACTIVE",
    };

    mocks.deactivateVariant.mockResolvedValue(undefined);
    mocks.get.mockResolvedValue(product([inactive]));

    render(
      <VariantManagement
        organizationId="org-1"
        product={product()}
        onProductRefreshed={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "ปิดใช้งาน" }),
    );

    expect(
      screen.getByRole("dialog", {
        name: "ยืนยันการปิดใช้งานตัวเลือก",
      }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "ปิดใช้งานตัวเลือก",
      }),
    );

    expect(mocks.deactivateVariant).toHaveBeenCalledWith(
      "org-1",
      "product-1",
      "variant-1",
    );
    expect(
      await screen.findByText(
        "ปิดใช้งานตัวเลือก Size M แล้ว",
      ),
    ).toBeInTheDocument();
  });
});
