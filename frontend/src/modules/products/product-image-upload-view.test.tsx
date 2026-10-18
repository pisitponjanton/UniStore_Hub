import {
  act,
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
import { ApiClientError } from "@/services";

const mocks = vi.hoisted(() => ({
  requestImageUploadUrl: vi.fn(),
  update: vi.fn(),
  get: vi.fn(),
  put: vi.fn(),
  logout: vi.fn(),
  getSnapshot: vi.fn(),
}));

vi.mock("@/modules/auth", () => ({
  authSession: {
    logout: mocks.logout,
    getSnapshot: mocks.getSnapshot,
  },
  isDefinitiveSessionFailure: (error: unknown) =>
    error instanceof Error && error.message === "OLD_SESSION_EXPIRED",
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

async function clickReadyUpload() {
  const button = screen.getByRole("button", { name: "อัปโหลดรูปสินค้า" });
  await waitFor(() => expect(button).toBeEnabled());
  await act(async () => {
    fireEvent.click(button);
  });
}

describe("ProductImageUploadView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    mocks.getSnapshot.mockReturnValue({
      status: "authenticated",
      user: { userId: "org-admin-A" },
    });
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
    await clickReadyUpload();

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
    await clickReadyUpload();

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

    await clickReadyUpload();

    expect(
      await screen.findByText(
        "ลิงก์อัปโหลดหมดอายุหรือถูกปฏิเสธ กรุณากดอัปโหลดอีกครั้งเพื่อสร้างลิงก์ใหม่",
      ),
    ).toBeInTheDocument();

    await clickReadyUpload();

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


  it("retries only GET after acknowledged imageKey save but failed product readback", async () => {
    const upload = signedUpload("products/org-1/product-1/readback");
    const refreshed = { ...product, imageKey: upload.objectKey };
    const onProductRefreshed = vi.fn();

    mocks.requestImageUploadUrl.mockResolvedValue(upload);
    mocks.put.mockResolvedValue(undefined);
    mocks.update.mockResolvedValue(refreshed);
    mocks.get
      .mockRejectedValueOnce(new Error("Synthetic readback unavailable"))
      .mockResolvedValueOnce(refreshed);

    render(
      <ProductImageUploadView
        organizationId="org-1"
        product={product}
        onProductRefreshed={onProductRefreshed}
      />,
    );
    selectFile(new File(["png"], "shirt.png", { type: "image/png" }));
    await clickReadyUpload();

    expect(
      await screen.findByText(/บันทึกรูปสินค้าแล้ว แต่ยังโหลดข้อมูลล่าสุดไม่สำเร็จ/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "อัปโหลดรูปสินค้า" })).toBeNull();
    expect(screen.getByLabelText("เลือกรูปสินค้า")).toBeDisabled();
    expect(mocks.requestImageUploadUrl).toHaveBeenCalledTimes(1);
    expect(mocks.put).toHaveBeenCalledTimes(1);
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(onProductRefreshed).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "ตรวจสอบข้อมูลล่าสุดอีกครั้ง" }));
    });
    expect(
      await screen.findByText("อัปโหลดและบันทึกรูปสินค้าเรียบร้อยแล้ว"),
    ).toBeInTheDocument();
    expect(mocks.get).toHaveBeenCalledTimes(2);
    expect(mocks.requestImageUploadUrl).toHaveBeenCalledTimes(1);
    expect(mocks.put).toHaveBeenCalledTimes(1);
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(onProductRefreshed).toHaveBeenCalledWith(refreshed);
  });


  it("ignores a former account's late 401 and does not log out the new account", async () => {
    const upload = signedUpload("products/org-1/product-1/account-A");
    let rejectOldRead: ((error: Error) => void) | undefined;
    const readback = new Promise<ProductDTO>((_, reject) => {
      rejectOldRead = reject;
    });
    mocks.requestImageUploadUrl.mockResolvedValue(upload);
    mocks.put.mockResolvedValue(undefined);
    mocks.update.mockResolvedValue({ ...product, imageKey: upload.objectKey });
    mocks.get.mockReturnValue(readback);
    const refreshed = vi.fn();
    render(<ProductImageUploadView organizationId="org-1"
      product={product} onProductRefreshed={refreshed} />);
    selectFile(new File(["png"], "account.png", { type: "image/png" }));
    await clickReadyUpload();
    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(1));
    mocks.getSnapshot.mockReturnValue({
      status: "authenticated", user: { userId: "staff-B" },
    });
    await act(async () => { rejectOldRead?.(new Error("OLD_SESSION_EXPIRED")); });
    expect(mocks.logout).not.toHaveBeenCalled();
    expect(refreshed).not.toHaveBeenCalled();
    expect(mocks.requestImageUploadUrl).toHaveBeenCalledTimes(1);
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(window.sessionStorage.getItem(
      "unistoreHub.productImageVerification.v1:org-admin-A:org-1:product-1"
    )).toBe(upload.objectKey);
  });

  it("ignores former account's late successful GET without clearing either account marker", async () => {
    const upload = signedUpload("products/org-1/product-1/late-A");
    let resolveOldRead: ((value: ProductDTO) => void) | undefined;
    mocks.get.mockReturnValue(new Promise<ProductDTO>((resolve) => {
      resolveOldRead = resolve;
    }));
    mocks.requestImageUploadUrl.mockResolvedValue(upload);
    mocks.put.mockResolvedValue(undefined);
    mocks.update.mockResolvedValue({ ...product, imageKey: upload.objectKey });
    const refreshed = vi.fn();
    render(<ProductImageUploadView organizationId="org-1"
      product={product} onProductRefreshed={refreshed} />);
    selectFile(new File(["png"], "account.png", { type: "image/png" }));
    await clickReadyUpload();
    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(1));
    mocks.getSnapshot.mockReturnValue({
      status: "authenticated", user: { userId: "staff-B" },
    });
    await act(async () => {
      resolveOldRead?.({ ...product, imageKey: upload.objectKey });
    });
    expect(mocks.logout).not.toHaveBeenCalled();
    expect(refreshed).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem(
      "unistoreHub.productImageVerification.v1:org-admin-A:org-1:product-1"
    )).toBe(upload.objectKey);
  });


  it("avoids duplicate PATCH after a lost PATCH response and verifies by GET only", async () => {
    const upload = signedUpload("products/org-1/product-1/uncertain-patch");
    const refreshed = { ...product, imageKey: upload.objectKey };
    const onProductRefreshed = vi.fn();
    mocks.requestImageUploadUrl.mockResolvedValue(upload);
    mocks.put.mockResolvedValue(undefined);
    mocks.update.mockRejectedValueOnce(new Error("Network response lost"));
    mocks.get.mockResolvedValue(refreshed);

    render(<ProductImageUploadView organizationId="org-1"
      product={product} onProductRefreshed={onProductRefreshed} />);
    selectFile(new File(["png"], "uncertain.png", { type: "image/png" }));
    await clickReadyUpload();
    expect(await screen.findByText(/ส่งคำขอบันทึกรูปไปแล้ว แต่ยังยืนยันผลไม่ได้/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "อัปโหลดรูปสินค้า" })).toBeNull();
    expect(screen.getByLabelText("เลือกรูปสินค้า")).toBeDisabled();
    expect(mocks.requestImageUploadUrl).toHaveBeenCalledTimes(1);
    expect(mocks.put).toHaveBeenCalledTimes(1);
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(window.sessionStorage.getItem(
      "unistoreHub.productImageVerification.v1:org-admin-A:org-1:product-1"
    )).toBe(upload.objectKey);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "ตรวจสอบข้อมูลล่าสุดอีกครั้ง" }));
    });
    expect(await screen.findByText("อัปโหลดและบันทึกรูปสินค้าเรียบร้อยแล้ว")).toBeInTheDocument();
    expect(mocks.get).toHaveBeenCalledTimes(1);
    expect(mocks.requestImageUploadUrl).toHaveBeenCalledTimes(1);
    expect(mocks.put).toHaveBeenCalledTimes(1);
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(onProductRefreshed).toHaveBeenCalledWith(refreshed);
  });


  it("clears provisional verification marker on definitive PATCH 409 rejection", async () => {
    const upload = signedUpload("products/org-1/product-1/rejected-patch");
    mocks.requestImageUploadUrl.mockResolvedValue(upload);
    mocks.put.mockResolvedValue(undefined);
    mocks.update.mockRejectedValueOnce(new ApiClientError({
      status: 409, code: "INVALID_STATUS_TRANSITION", kind: "conflict", message: "UXQA rejected PATCH",
    }));
    render(<ProductImageUploadView organizationId="org-1"
      product={product} onProductRefreshed={vi.fn()} />);
    selectFile(new File(["png"], "rejected.png", { type: "image/png" }));
    await clickReadyUpload();
    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole("button", {
      name: "อัปโหลดรูปสินค้า",
    })).toBeEnabled());
    expect(screen.getByText("rejected.png")).toBeInTheDocument();
    expect(window.sessionStorage.getItem(
      "unistoreHub.productImageVerification.v1:org-admin-A:org-1:product-1"
    )).toBeNull();
    expect(mocks.get).not.toHaveBeenCalled();
  });
});
