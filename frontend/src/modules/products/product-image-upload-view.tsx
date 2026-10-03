"use client";

import { useState, type ChangeEvent } from "react";

import { Badge, Button, FileField, Notice } from "@/components";
import {
  authSession,
  isDefinitiveSessionFailure,
} from "@/modules/auth";
import { ApiClientError } from "@/services";
import type { ProductDTO } from "@/types";
import {
  validateUploadCandidate,
} from "@/utils";

import {
  ProductImageUploadError,
  putProductImageToPresignedUrl,
} from "./product-image-upload";
import { productService } from "./product-service";
import styles from "./product-image-upload.module.css";

type UploadStage =
  | "idle"
  | "signing"
  | "uploading"
  | "persisting"
  | "refreshing";

const UPLOAD_STAGES = [
  "signing",
  "uploading",
  "persisting",
  "refreshing",
] as const satisfies readonly Exclude<UploadStage, "idle">[];

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
  }

  return `${Math.max(1, Math.round(bytes / 1024))} KiB`;
}

function validationMessage(
  reason: "UNSUPPORTED_TYPE" | "FILE_TOO_LARGE",
): string {
  return reason === "UNSUPPORTED_TYPE"
    ? "รองรับเฉพาะ JPEG, PNG และ WebP"
    : "รูปสินค้าต้องมีขนาดไม่เกิน 5 MiB";
}

function stageLabel(stage: UploadStage): string {
  switch (stage) {
    case "signing":
      return "กำลังเตรียมการอัปโหลด";
    case "uploading":
      return "กำลังอัปโหลดไฟล์";
    case "persisting":
      return "กำลังบันทึกรูปสินค้า";
    case "refreshing":
      return "กำลังตรวจสอบข้อมูลล่าสุด";
    case "idle":
      return "";
  }
}

export function ProductImageUploadView({
  organizationId,
  product,
  onProductRefreshed,
}: {
  organizationId: string;
  product: ProductDTO;
  onProductRefreshed: (product: ProductDTO) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [contentType, setContentType] = useState<
    "image/jpeg" | "image/png" | "image/webp" | null
  >(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [stage, setStage] = useState<UploadStage>("idle");

  const pending = stage !== "idle";

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const candidate = event.target.files?.[0] ?? null;

    setFile(null);
    setContentType(null);
    setFileError(null);
    setServerError(null);
    setNotice(null);

    if (!candidate) {
      return;
    }

    const validation = validateUploadCandidate(
      candidate,
      "productImage",
    );

    if (!validation.ok) {
      setFileError(validationMessage(validation.reason));
      event.target.value = "";
      return;
    }

    setFile(candidate);
    setContentType(validation.contentType);
  }

  async function handleUpload() {
    if (!file || !contentType || pending) {
      return;
    }

    setServerError(null);
    setNotice(null);

    try {
      setStage("signing");
      const upload = await productService.requestImageUploadUrl(
        organizationId,
        product.productId,
        contentType,
      );

      setStage("uploading");
      await putProductImageToPresignedUrl({
        upload,
        file,
        contentType,
      });

      setStage("persisting");
      await productService.update(
        organizationId,
        product.productId,
        {
          imageKey: upload.objectKey,
        },
      );

      setStage("refreshing");
      const refreshed = await productService.get(
        organizationId,
        product.productId,
      );
      onProductRefreshed(refreshed);

      setFile(null);
      setContentType(null);
      setNotice("อัปโหลดและบันทึกรูปสินค้าเรียบร้อยแล้ว");

      const input = document.getElementById(
        `product-image-${product.productId}`,
      );

      if (input instanceof HTMLInputElement) {
        input.value = "";
      }
    } catch (error) {
      if (isDefinitiveSessionFailure(error)) {
        authSession.logout();
        return;
      }

      if (
        error instanceof ProductImageUploadError &&
        error.status === 403
      ) {
        setServerError(
          "ลิงก์อัปโหลดหมดอายุหรือถูกปฏิเสธ กรุณากดอัปโหลดอีกครั้งเพื่อสร้างลิงก์ใหม่",
        );
        return;
      }

      if (error instanceof ApiClientError) {
        setServerError(error.userMessage);
        return;
      }

      setServerError(
        "ไม่สามารถอัปโหลดรูปสินค้าได้ กรุณาลองใหม่อีกครั้ง",
      );
    } finally {
      setStage("idle");
    }
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.headerCopy}>
          <h3 className={styles.title}>รูปสินค้า</h3>
          <p className={styles.description}>
            ใช้ไฟล์ JPEG, PNG หรือ WebP ขนาดไม่เกิน 5 MiB
          </p>
        </div>
        <Badge tone={product.imageKey ? "success" : "neutral"}>
          {product.imageKey ? "มีรูปสินค้าแล้ว" : "ยังไม่มีรูปสินค้า"}
        </Badge>
      </div>

      <FileField
        id={`product-image-${product.productId}`}
        label="เลือกรูปสินค้า"
        hint="การอัปโหลดรูปใหม่จะใช้รูปนี้เป็นรูปปัจจุบันของสินค้า"
        error={fileError ?? undefined}
        accept="image/jpeg,image/png,image/webp"
        disabled={pending}
        onChange={handleFileChange}
      />
      {file ? (
        <div className={styles.selected} role="status" aria-atomic="true">
          <div className={styles.selectedCopy}>
            <span className={styles.selectedLabel}>ไฟล์ที่เลือก</span>
            <span className={styles.fileName}>{file.name}</span>
          </div>
          <span className={styles.meta}>
            {file.type} ขนาด {formatBytes(file.size)}
          </span>
        </div>
      ) : null}


      {serverError ? (
        <Notice
          tone="danger"
          role="alert"
          title="อัปโหลดไม่สำเร็จ"
        >
          {serverError}
        </Notice>
      ) : null}

      {notice ? (
        <Notice
          tone="success"
          role="status"
          title="อัปโหลดสำเร็จ"
        >
          {notice}
        </Notice>
      ) : null}

      {pending ? (
        <div className={styles.progress} aria-label="ขั้นตอนการอัปโหลดรูปสินค้า">
          <div
            className={styles.progressCurrent}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {stageLabel(stage)}
          </div>
          <ol className={styles.progressSteps}>
            {UPLOAD_STAGES.map((item, index) => {
              const currentIndex = UPLOAD_STAGES.indexOf(
                stage as (typeof UPLOAD_STAGES)[number],
              );
              const itemState =
                index < currentIndex
                  ? "done"
                  : index === currentIndex
                    ? "current"
                    : "upcoming";

              return (
                <li
                  className={styles.progressStep}
                  data-state={itemState}
                  key={item}
                >
                  <span className={styles.progressMarker} aria-hidden="true" />
                  <span className={styles.progressStepCopy}>
                    <span>{stageLabel(item)}</span>
                    <span className={styles.progressStateLabel}>
                      {itemState === "done"
                        ? "เสร็จแล้ว"
                        : itemState === "current"
                          ? "กำลังดำเนินการ"
                          : "รอดำเนินการ"}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}

      <div className={styles.actions}>
        <Button
          type="button"
          pending={pending}
          pendingLabel={stageLabel(stage)}
          disabled={!file || !contentType || pending}
          onClick={() => {
            void handleUpload();
          }}
        >
          อัปโหลดรูปสินค้า
        </Button>
      </div>
    </div>
  );
}
