"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";

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
import {
  readPendingProductImage,
  savePendingProductImage,
  clearPendingProductImage,
  canRememberPendingProductImage,
} from "./product-image-pending-verification";
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
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [savedImageKeyToVerify, setSavedImageKeyToVerify] = useState<string | null>(null);
  const [stage, setStage] = useState<UploadStage>("idle");
  const [verificationReady, setVerificationReady] = useState(false);
  const [verificationStorageUnavailable, setVerificationStorageUnavailable] = useState(false);
  const [verificationUncertain, setVerificationUncertain] = useState(false);
  const [verificationRetries, setVerificationRetries] = useState(0);
  const mountedRef = useRef(false);
  const resultFocusRequested = useRef(false);
  const resultRef = useRef<HTMLDivElement>(null);

  const pending = stage !== "idle";

  function currentUserId(): string | null {
    const snapshot = authSession.getSnapshot?.();
    return snapshot?.status === "authenticated" ? snapshot.user.userId : null;
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    // Hydrate session state after the component has committed, not during SSR
    // render or synchronously inside an effect.
    const frame = window.requestAnimationFrame(() => {
      const userId = currentUserId();
      const committedKey = userId
        ? readPendingProductImage(userId, organizationId, product.productId)
        : null;
      if (userId) {
        setVerificationStorageUnavailable(
          !canRememberPendingProductImage(userId, organizationId, product.productId),
        );
      }
      if (committedKey) {
        if (product.imageKey === committedKey) {
          if (userId) clearPendingProductImage(userId, organizationId, product.productId);
        } else {
          setSavedImageKeyToVerify(committedKey);
          // A pending marker can be saved before PATCH response arrives, so
          // after reload never assume that the server confirmed the write.
          setVerificationUncertain(true);
          setVerificationError(
            "สถานะการบันทึกรูปยังไม่ชัดเจน กรุณาตรวจสอบข้อมูลล่าสุดอีกครั้ง ไม่ต้องอัปโหลดไฟล์ซ้ำ",
          );
        }
      }
      setVerificationReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [organizationId, product.productId, product.imageKey]);

  useEffect(() => {
    if (!resultFocusRequested.current || pending || (!serverError && !notice && !verificationError)) return;
    const frame = window.requestAnimationFrame(() => {
      if (!resultFocusRequested.current) return;
      resultFocusRequested.current = false;
      resultRef.current?.focus({ preventScroll: true });
      resultRef.current?.scrollIntoView?.({ block: "nearest", behavior: "instant" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pending, serverError, notice, verificationError]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const candidate = event.target.files?.[0] ?? null;

    resultFocusRequested.current = false;
    setFile(null);
    setContentType(null);
    setFileError(null);
    setServerError(null);
    setNotice(null);
    setVerificationError(null);

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

  async function verifySavedImage(expectedKey: string, ownerUserId: string | null = currentUserId()) {
    setStage("refreshing");

    try {
      const refreshed = await productService.get(
        organizationId,
        product.productId,
      );

      // A late response must not update the editor of a different user.
      if (currentUserId() !== ownerUserId) return;
      // A successful GET may still return an older record while replicas
      // catch up. Never label an unverified imageKey as refreshed.
      if (!mountedRef.current) {
        if (refreshed.imageKey === expectedKey) {
          if (ownerUserId) clearPendingProductImage(ownerUserId, organizationId, product.productId);
        }
        return;
      }
      if (refreshed.imageKey !== expectedKey) {
        setVerificationError(verificationUncertain
          ? "ยังยืนยันผลการบันทึกรูปไม่ได้ ข้อมูลล่าสุดยังไม่แสดงรูปนี้ กรุณาตรวจสอบอีกครั้งก่อนอัปโหลดซ้ำ"
          : "บันทึกรูปสินค้าแล้ว แต่ข้อมูลล่าสุดยังไม่แสดงรูปที่บันทึก กรุณาตรวจสอบข้อมูลล่าสุดอีกครั้ง โดยไม่ต้องอัปโหลดซ้ำ");
        return;
      }

      if (ownerUserId) clearPendingProductImage(ownerUserId, organizationId, product.productId);
      onProductRefreshed(refreshed);
      setSavedImageKeyToVerify(null);
      setVerificationRetries(0);
      setVerificationStorageUnavailable(false);
      setVerificationUncertain(false);
      setVerificationError(null);
      setNotice("อัปโหลดและบันทึกรูปสินค้าเรียบร้อยแล้ว");
    } catch (error) {
      if (!mountedRef.current || currentUserId() !== ownerUserId) return;
      if (isDefinitiveSessionFailure(error)) {
        authSession.logout();
        return;
      }

      // The imageKey PATCH was already acknowledged. Retrying the upload
      // could create another object and change the product a second time.
      setVerificationError(verificationUncertain
        ? "ส่งคำขอบันทึกรูปไปแล้ว แต่ยังยืนยันผลไม่ได้ กรุณาตรวจสอบข้อมูลล่าสุดอีกครั้ง ไม่ต้องอัปโหลดซ้ำ"
        : "บันทึกรูปสินค้าแล้ว แต่ยังโหลดข้อมูลล่าสุดไม่สำเร็จ กรุณาตรวจสอบข้อมูลล่าสุดอีกครั้ง ไม่ต้องอัปโหลดไฟล์ซ้ำ");
    }
  }

  async function handleRetryVerification() {
    if (!savedImageKeyToVerify || pending) {
      return;
    }

    resultFocusRequested.current = true;
    setVerificationRetries((value) => value + 1);
    setVerificationError(null);
    setNotice(null);

    try {
      await verifySavedImage(savedImageKeyToVerify, currentUserId());
    } finally {
      setStage("idle");
    }
  }

  async function handleReadOnlyRefresh() {
    if (pending || savedImageKeyToVerify) return;
    const owner = currentUserId();
    resultFocusRequested.current = true;
    setNotice(null);
    setServerError(null);
    setStage("refreshing");
    try {
      const refreshed = await productService.get(organizationId, product.productId);
      if (!mountedRef.current || currentUserId() !== owner) return;
      onProductRefreshed(refreshed);
      setNotice("โหลดข้อมูลสินค้าล่าสุดแล้ว กรุณาตรวจสอบรูปปัจจุบันก่อนอัปโหลดอีกครั้ง");
    } catch (error) {
      if (!mountedRef.current || currentUserId() !== owner) return;
      if (isDefinitiveSessionFailure(error)) {
        authSession.logout();
        return;
      }
      setServerError("ยังโหลดข้อมูลสินค้าล่าสุดไม่ได้ กรุณาลองตรวจสอบอีกครั้งก่อนอัปโหลดซ้ำ");
    } finally {
      if (mountedRef.current && currentUserId() === owner) setStage("idle");
    }
  }

  async function handleUpload() {
    if (!file || !contentType || pending || savedImageKeyToVerify) {
      return;
    }

    const uploadOwnerId = currentUserId();
    setVerificationRetries(0);
    let patchResponsePendingKey: string | null = null;
    let markerStored = false;
    resultFocusRequested.current = true;
    setServerError(null);
    setNotice(null);
    setVerificationError(null);

    try {
      setStage("signing");
      const upload = await productService.requestImageUploadUrl(
        organizationId,
        product.productId,
        contentType,
      );

      if (!mountedRef.current || currentUserId() !== uploadOwnerId) return;
      setStage("uploading");
      await putProductImageToPresignedUrl({
        upload,
        file,
        contentType,
      });

      if (!mountedRef.current || currentUserId() !== uploadOwnerId) return;
      setStage("persisting");
      patchResponsePendingKey = upload.objectKey;
      // Write a conservative marker BEFORE dispatching PATCH. Closing this
      // tab while the response is in flight must not expose a silent reupload.
      markerStored = uploadOwnerId
        ? savePendingProductImage(uploadOwnerId, organizationId, product.productId, upload.objectKey)
        : false;
      await productService.update(
        organizationId,
        product.productId,
        {
          imageKey: upload.objectKey,
        },
      );

      // PATCH was acknowledged; keep the conservative marker until a
      // matching GET proves readback, without issuing another mutation.
      patchResponsePendingKey = null;
      // PATCH can complete after the original owner logged out or the UI
      // unmounted. Retain only their scoped marker, never update a new UI.
      if (!mountedRef.current || currentUserId() !== uploadOwnerId) return;
      setVerificationStorageUnavailable(!markerStored);
      setVerificationUncertain(false);
      setSavedImageKeyToVerify(upload.objectKey);
      setFile(null);
      setContentType(null);

      const input = document.getElementById(
        `product-image-${product.productId}`,
      );
      if (input instanceof HTMLInputElement) {
        input.value = "";
      }

      await verifySavedImage(upload.objectKey, uploadOwnerId);
    } catch (error) {
      const definitivePatchRejection = patchResponsePendingKey &&
        error instanceof ApiClientError &&
        error.kind !== "network" && error.kind !== "server";
      if (definitivePatchRejection && uploadOwnerId) {
        clearPendingProductImage(uploadOwnerId, organizationId, product.productId);
      }
      if (!mountedRef.current || currentUserId() !== uploadOwnerId) return;
      if (isDefinitiveSessionFailure(error)) {
        authSession.logout();
        return;
      }

      if (patchResponsePendingKey) {
        const ambiguous =
          !(error instanceof ApiClientError) ||
          error.kind === "network" || error.kind === "server";
        if (ambiguous) {
          // Server may have committed despite a lost response. Do NOT
          // restart the signed PUT or imageKey PATCH; verify by GET only.
          setVerificationStorageUnavailable(!markerStored);
          setVerificationUncertain(true);
          setSavedImageKeyToVerify(patchResponsePendingKey);
          setFile(null);
          setContentType(null);
          setVerificationError(
            "ส่งคำขอบันทึกรูปไปแล้ว แต่ยังยืนยันผลไม่ได้ กรุณาตรวจสอบข้อมูลล่าสุดอีกครั้ง ไม่ต้องอัปโหลดซ้ำ",
          );
          return;
        }
        // A documented definitive 4xx rejection was already cleaned up.
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

      <div className={styles.currentMedia}>
        {product.imageUrl ? (
          // Backend supplies this short-lived Product image URL for display only.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className={styles.currentImage}
            src={product.imageUrl}
            alt={`รูปสินค้าปัจจุบันของ ${product.name}`}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span className={styles.currentFallback}>
            ยังไม่มีรูปสินค้า อัปโหลดรูปเพื่อช่วยให้สินค้าจดจำได้ง่ายขึ้นในหน้าร้าน
          </span>
        )}
      </div>

      <FileField
        id={`product-image-${product.productId}`}
        label="เลือกรูปสินค้า"
        hint="การอัปโหลดรูปใหม่จะใช้รูปนี้เป็นรูปปัจจุบันของสินค้า หากเพิ่งอัปโหลดแล้วเปิดหน้าใหม่ กรุณาโหลดข้อมูลสินค้าล่าสุดก่อนส่งไฟล์ซ้ำ"
        error={fileError ?? undefined}
        accept="image/jpeg,image/png,image/webp"
        disabled={!verificationReady || pending || savedImageKeyToVerify !== null}
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
        <div ref={resultRef} tabIndex={-1} data-product-upload-feedback>
          <Notice tone="danger" role="alert" title="อัปโหลดไม่สำเร็จ">
            {serverError}
          </Notice>
        </div>
      ) : null}

      {verificationError ? (
        <div ref={resultRef} tabIndex={-1} data-product-upload-feedback>
          <Notice tone="warning" role="alert" title={verificationUncertain ? "ยังยืนยันผลการบันทึกไม่ได้" : "รูปสินค้าบันทึกแล้ว"}>
            {verificationError}
          </Notice>
        </div>
      ) : null}

      {savedImageKeyToVerify && verificationRetries >= 3 && !pending ? (
        <Notice tone="warning" role="status" title="ตรวจสอบหลายครั้งแล้วยังไม่ยืนยันผล">
          ข้อมูลล่าสุดยังไม่ตรงกับรูปที่ส่งไป กรุณาติดต่อผู้ดูแลระบบพร้อมรหัสสินค้าและอย่าเพิ่งอัปโหลดรูปซ้ำ คุณสามารถกลับมาตรวจสอบข้อมูลล่าสุดอีกครั้งได้
        </Notice>
      ) : null}

      {!savedImageKeyToVerify && verificationStorageUnavailable && !pending && !notice ? (
        <Notice tone="warning" role="status" title="ไม่สามารถจำสถานะหลัง Reload">
          เบราว์เซอร์ไม่อนุญาตให้จำสถานะตรวจสอบรูปสินค้า หากเพิ่งอัปโหลดรูปไป กรุณาโหลดข้อมูลสินค้าล่าสุดก่อนตัดสินใจอัปโหลดใหม่ เพื่อหลีกเลี่ยงการส่งไฟล์ซ้ำ
        </Notice>
      ) : null}

      {savedImageKeyToVerify && verificationStorageUnavailable && !pending ? (
        <Notice tone="warning" role="status" title="ไม่สามารถจำสถานะหลังออกจากหน้า">
          เบราว์เซอร์ไม่อนุญาตให้บันทึกสถานะชั่วคราว กรุณาตรวจสอบข้อมูลล่าสุดให้สำเร็จก่อนออกจากหน้านี้ หากกลับเข้ามาอีกครั้ง ระบบอาจไม่ทราบว่ามีการบันทึกรูปไปแล้ว
        </Notice>
      ) : null}

      {notice ? (
        <div ref={resultRef} tabIndex={-1} data-product-upload-feedback>
          <Notice tone="success" role="status" title="อัปโหลดสำเร็จ">
            {notice}
          </Notice>
        </div>
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
        {!savedImageKeyToVerify ? (
          <Button type="button" variant="secondary" disabled={!verificationReady || pending}
            onClick={() => { void handleReadOnlyRefresh(); }}>
            โหลดข้อมูลสินค้าล่าสุด
          </Button>
        ) : null}
        {savedImageKeyToVerify ? (
          <Button
            type="button"
            pending={pending}
            pendingLabel={stageLabel(stage)}
            disabled={pending}
            onClick={() => {
              void handleRetryVerification();
            }}
          >
            ตรวจสอบข้อมูลล่าสุดอีกครั้ง
          </Button>
        ) : (
          <Button
            type="button"
            pending={pending}
            pendingLabel={stageLabel(stage)}
            disabled={!verificationReady || !file || !contentType || pending}
            onClick={() => {
              void handleUpload();
            }}
          >
            อัปโหลดรูปสินค้า
          </Button>
        )}
      </div>
    </div>
  );
}
