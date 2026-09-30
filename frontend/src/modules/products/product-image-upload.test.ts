import { describe, expect, it, vi } from "vitest";

import type { PresignedUploadDTO } from "@/types";

import { putProductImageToPresignedUrl } from "./product-image-upload";

const upload: PresignedUploadDTO = {
  objectKey: "products/org-1/product-1/image-1",
  url: "https://signed.example/upload",
  method: "PUT",
  expiresInSeconds: 900,
};

describe("putProductImageToPresignedUrl", () => {
  it("PUTs directly to the signed URL with the exact Content-Type and no Authorization header", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(null, { status: 200 }),
    );
    const file = new Blob(["image-bytes"], {
      type: "image/png",
    });

    await putProductImageToPresignedUrl({
      upload,
      file,
      contentType: "image/png",
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://signed.example/upload",
      {
        method: "PUT",
        headers: {
          "Content-Type": "image/png",
        },
        body: file,
      },
    );

    const init = fetchImpl.mock.calls[0]?.[1] as RequestInit;
    expect(
      new Headers(init.headers).has("Authorization"),
    ).toBe(false);
  });

  it("surfaces a signed-upload 403 without retrying", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(null, { status: 403 }),
    );

    await expect(
      putProductImageToPresignedUrl({
        upload,
        file: new Blob(["image"], {
          type: "image/webp",
        }),
        contentType: "image/webp",
        fetchImpl,
      }),
    ).rejects.toMatchObject({
      name: "ProductImageUploadError",
      status: 403,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
