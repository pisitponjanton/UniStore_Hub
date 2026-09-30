import type {
  AllowedUploadContentType,
  PresignedUploadDTO,
} from "@/types";

export class DirectUploadError extends Error {
  constructor(
    readonly status: number,
    message = "Direct file upload failed.",
  ) {
    super(message);
    this.name = "DirectUploadError";
  }
}

export async function putFileToPresignedUrl({
  upload,
  file,
  contentType,
  fetchImpl = fetch,
}: {
  upload: PresignedUploadDTO;
  file: Blob;
  contentType: AllowedUploadContentType;
  fetchImpl?: typeof fetch;
}): Promise<void> {
  const response = await fetchImpl(upload.url, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
    },
    body: file,
  });

  if (!response.ok) {
    throw new DirectUploadError(response.status);
  }
}
