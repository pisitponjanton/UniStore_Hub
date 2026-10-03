import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  PresignedUploadDTO,
  ProductDTO,
} from "@/types";
import { PRODUCT_IMAGE_MAX_BYTES } from "@/utils";

const mocks = vi.hoisted(() => ({
  requestImageUploadUrl: vi.fn(),
  update: vi.fn(),
  get: vi.fn(),
  put: vi.fn(),
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
    requestImageUploadUrl: mocks.requestImageUploadUrl,
    update: mocks.update,
    get: mocks.get,
  },
}));

vi.mock("./product-image-upload", async () => {
  const actual = await vi.importActual<
    typeof import("./product-image-upload")
  >("./product-image-upload");

  return {
    ...actual,
    putProductImageToPresignedUrl: mocks.put,
  };
});

import { ProductImageUploadError } from "./product-image-upload";
import { ProductImageUploadView } from "./product-image-upload-view";

const product: ProductDTO = {
  productId: "product-1",
  organizationId: "org-1",
  storeId: "store-1",
  name: "Faculty Shirt",
  description: "Pre-order shirt",
  imageKey: null,
  imageUrl: null,
  status: "ACTIVE",
  variants: [],
  createdAt: "2026-09-29T10:00:00.000Z",
  updatedAt: "2026-09-29T10:00:00.000Z",
};

function signedUpload(
  objectKey: string,
): PresignedUploadDTO {
  return {
    objectKey,
    url: `https://signed.example/${objectKey}`,
    method: "PUT",
    expiresInSeconds: 900,
  };
}

function selectFile(file: File) {
  fireEvent.change(screen.getByLabelText("เลือกรูปสินค้า"), {
    target: {
      files: [file],
    },
  });
}

describe("ProductImageUploadView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates the 5 MiB limit before requesting a Pre-signed URL", () => {
    render(
      <ProductImageUploadView
        organizationId="org-1"
        product={product}
        onProductRefreshed={vi.fn()}
      />,
    );

    selectFile(
      new File(
        [new Uint8Array(PRODUCT_IMAGE_MAX_BYTES + 1)],
        "too-large.png",
        { type: "image/png" },
      ),
    );

    expect(
      screen.getByRole("alert"),
    ).toHaveTextContent("รูปสินค้าต้องมีขนาดไม่เกิน 5 MiB");
    expect(mocks.requestImageUploadUrl).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", {
        name: "อัปโหลดรูปสินค้า",
      }),
    ).toBeDisabled();
  });

  it("shows contextual multi-step progress while preparing a direct upload", async () => {
    mocks.requestImageUploadUrl.mockImplementation(
      () => new Promise<never>(() => undefined),
    );

    render(
      <ProductImageUploadView
        organizationId="org-1"
        product={product}
        onProductRefreshed={vi.fn()}
      />,
    );

    selectFile(
      new File(["png"], "shirt.png", {
        type: "image/png",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "อัปโหลดรูปสินค้า",
      }),
    );

    const statuses = await screen.findAllByRole("status");
    expect(
      statuses.some(
        (item) => item.textContent === "กำลังเตรียมการอัปโหลด",
      ),
    ).toBe(true);
    expect(screen.getByText("กำลังดำเนินการ")).toBeInTheDocument();
    expect(screen.getAllByText("รอดำเนินการ")).toHaveLength(3);
  });

  it("requests a presign, PUTs directly to S3, persists imageKey, and refreshes Product data", async () => {
    const upload = signedUpload(
      "products/org-1/product-1/image-1",
    );
    const refreshed: ProductDTO = {
      ...product,
      imageKey: upload.objectKey,
      updatedAt: "2026-09-29T11:00:00.000Z",
    };
    const onProductRefreshed = vi.fn();

    mocks.requestImageUploadUrl.mockResolvedValue(upload);
    mocks.put.mockResolvedValue(undefined);
    mocks.update.mockResolvedValue(refreshed);
    mocks.get.mockResolvedValue(refreshed);

    render(
      <ProductImageUploadView
        organizationId="org-1"
        product={product}
        onProductRefreshed={onProductRefreshed}
      />,
    );

    const file = new File(["png"], "shirt.png", {
      type: "image/png",
    });

    selectFile(file);
    fireEvent.click(
      screen.getByRole("button", {
        name: "อัปโหลดรูปสินค้า",
      }),
    );

    expect(
      await screen.findByText(
        "อัปโหลดและบันทึกรูปสินค้าเรียบร้อยแล้ว",
      ),
    ).toBeInTheDocument();

    expect(mocks.requestImageUploadUrl).toHaveBeenCalledWith(
      "org-1",
      "product-1",
      "image/png",
    );
    expect(mocks.put).toHaveBeenCalledWith({
      upload,
      file,
      contentType: "image/png",
    });
    expect(mocks.update).toHaveBeenCalledWith(
      "org-1",
      "product-1",
      {
        imageKey: "products/org-1/product-1/image-1",
      },
    );
    expect(mocks.get).toHaveBeenCalledWith(
      "org-1",
      "product-1",
    );
    expect(onProductRefreshed).toHaveBeenCalledWith(refreshed);
  });

  it("keeps the selected file after a 403 and requests a fresh Pre-signed URL on retry", async () => {
    const firstUpload = signedUpload(
      "products/org-1/product-1/expired",
    );
    const secondUpload = signedUpload(
      "products/org-1/product-1/fresh",
    );
    const refreshed: ProductDTO = {
      ...product,
      imageKey: secondUpload.objectKey,
    };

    mocks.requestImageUploadUrl
      .mockResolvedValueOnce(firstUpload)
      .mockResolvedValueOnce(secondUpload);
    mocks.put
      .mockRejectedValueOnce(new ProductImageUploadError(403))
      .mockResolvedValueOnce(undefined);
    mocks.update.mockResolvedValue(refreshed);
    mocks.get.mockResolvedValue(refreshed);

    render(
      <ProductImageUploadView
        organizationId="org-1"
        product={product}
        onProductRefreshed={vi.fn()}
      />,
    );

    selectFile(
      new File(["webp"], "shirt.webp", {
        type: "image/webp",
      }),
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "อัปโหลดรูปสินค้า",
      }),
    );

    expect(
      await screen.findByText(
        "ลิงก์อัปโหลดหมดอายุหรือถูกปฏิเสธ กรุณากดอัปโหลดอีกครั้งเพื่อสร้างลิงก์ใหม่",
      ),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "อัปโหลดรูปสินค้า",
      }),
    );

    await waitFor(() => {
      expect(mocks.requestImageUploadUrl).toHaveBeenCalledTimes(2);
      expect(mocks.put).toHaveBeenLastCalledWith({
        upload: secondUpload,
        file: expect.any(File),
        contentType: "image/webp",
      });
      expect(mocks.update).toHaveBeenCalledWith(
        "org-1",
        "product-1",
        {
          imageKey: secondUpload.objectKey,
        },
      );
    });
  });
});
