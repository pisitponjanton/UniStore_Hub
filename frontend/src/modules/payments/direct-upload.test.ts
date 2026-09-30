import { describe, expect, it, vi } from "vitest";

import type { PresignedUploadDTO } from "@/types";

import { putFileToPresignedUrl } from "./direct-upload";

const upload: PresignedUploadDTO = {
  objectKey: "payments/org-1/order-1/file-1",
  url: "https://upload.example.test/presigned",
  method: "PUT",
  expiresInSeconds: 900,
};

describe("direct payment-slip upload", () => {
  it("PUTs directly to the presigned URL with the exact signed content type and no Bearer header", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 200 }));
    const file = new Blob(["image-bytes"], { type: "image/png" });

    await putFileToPresignedUrl({
      upload,
      file,
      contentType: "image/png",
      fetchImpl: fetchMock,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(upload.url);

    const init = fetchMock.mock.calls[0]?.[1];
    const headers = new Headers(init?.headers);

    expect(init?.method).toBe("PUT");
    expect(init?.body).toBe(file);
    expect(headers.get("Content-Type")).toBe("image/png");
    expect(headers.get("Authorization")).toBeNull();
  });

  it("surfaces failed or expired presigned PUT responses without retrying automatically", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 403 }));

    await expect(
      putFileToPresignedUrl({
        upload,
        file: new Blob(["image-bytes"], { type: "image/png" }),
        contentType: "image/png",
        fetchImpl: fetchMock,
      }),
    ).rejects.toMatchObject({
      status: 403,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
