"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

import {
  Button,
  ErrorState,
  ForbiddenState,
  LoadingState,
  UnauthorizedState,
} from "@/components";
import {
  authSession,
  isDefinitiveSessionFailure,
} from "@/modules/auth";
import {
  myOrderHref,
  OrderStatusBadge,
  orderService,
} from "@/modules/orders";
import { ApiClientError } from "@/services";
import type { OrderDTO, PaymentDTO } from "@/types";
import {
  formatSatang,
  getRequiredQueryId,
  validateUploadCandidate,
} from "@/utils";

import { DirectUploadError, putFileToPresignedUrl } from "./direct-upload";
import {
  canSubmitPaymentSlip,
  paymentOrderStateMessage,
} from "./payment-helpers";
import styles from "./payment-view.module.css";
import { paymentService } from "./payment-service";

type PaymentViewState =
  | { status: "loading" }
  | { status: "invalid" }
  | { status: "notFound" }
  | { status: "unauthorized" }
  | { status: "forbidden" }
  | { status: "error" }
  | { status: "success"; order: OrderDTO };

type SubmitStage =
  | "idle"
  | "signing"
  | "uploading"
  | "submitting"
  | "refreshing";

function stageLabel(stage: SubmitStage): string | null {
  switch (stage) {
    case "signing":
      return "กำลังขอลิงก์อัปโหลดใหม่จาก Backend";
    case "uploading":
      return "กำลังอัปโหลดหลักฐานไปยังพื้นที่จัดเก็บโดยตรง";
    case "submitting":
      return "กำลังส่งข้อมูลหลักฐานให้ Backend";
    case "refreshing":
      return "กำลังอัปเดตสถานะคำสั่งซื้อ";
    case "idle":
      return null;
  }
}

export function MyPaymentView() {
  const [state, setState] = useState<PaymentViewState>({
    status: "loading",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [latestPayment, setLatestPayment] = useState<PaymentDTO | null>(null);
  const [stage, setStage] = useState<SubmitStage>("idle");

  useEffect(() => {
    const controller = new AbortController();

    async function loadOrder() {
      const params = new URLSearchParams(window.location.search);
      const orderId = getRequiredQueryId(params, "orderId");

      if (!orderId.ok) {
        await Promise.resolve();

        if (!controller.signal.aborted) {
          setState({ status: "invalid" });
        }
        return;
      }

      try {
        const order = await orderService.getMyOrder(orderId.value, {
          signal: controller.signal,
        });

        let payment: PaymentDTO | null = null;

        try {
          payment = await paymentService.getMyPayment(order.orderId, {
            signal: controller.signal,
          });
        } catch (error) {
          if (
            controller.signal.aborted ||
            (error instanceof DOMException && error.name === "AbortError")
          ) {
            return;
          }

          if (
            error instanceof ApiClientError &&
            error.code === "PAYMENT_NOT_FOUND" &&
            order.status === "PENDING_PAYMENT"
          ) {
            payment = null;
          } else {
            throw error;
          }
        }

        if (!controller.signal.aborted) {
          setLatestPayment(payment);
          setState({ status: "success", order });
        }
      } catch (error) {
        if (
          controller.signal.aborted ||
          (error instanceof DOMException && error.name === "AbortError")
        ) {
          return;
        }

        if (isDefinitiveSessionFailure(error)) {
          authSession.logout();
          return;
        }

        if (error instanceof ApiClientError) {
          if (error.kind === "unauthorized") {
            setState({ status: "unauthorized" });
            return;
          }

          if (error.kind === "forbidden") {
            setState({ status: "forbidden" });
            return;
          }

          if (error.kind === "notFound") {
            setState({ status: "notFound" });
            return;
          }
        }

        setState({ status: "error" });
      }
    }

    void loadOrder();

    return () => controller.abort();
  }, []);

  function handleFileChange(file: File | null) {
    setSelectedFile(file);
    setFileError(null);
    setServerError(null);

    if (!file) {
      return;
    }

    const validation = validateUploadCandidate(file, "paymentSlip");

    if (!validation.ok) {
      setSelectedFile(null);
      setFileError(
        validation.reason === "UNSUPPORTED_TYPE"
          ? "รองรับเฉพาะไฟล์ JPEG, PNG หรือ WebP"
          : "ไฟล์หลักฐานต้องมีขนาดไม่เกิน 10 MiB",
      );
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      state.status !== "success" ||
      !canSubmitPaymentSlip(state.order.status) ||
      !selectedFile ||
      stage !== "idle"
    ) {
      return;
    }

    const validation = validateUploadCandidate(
      selectedFile,
      "paymentSlip",
    );

    if (!validation.ok) {
      handleFileChange(selectedFile);
      return;
    }

    setServerError(null);

    try {
      setStage("signing");
      const upload = await paymentService.requestSlipUploadUrl(
        state.order.organizationId,
        state.order.orderId,
        validation.contentType,
      );

      setStage("uploading");
      await putFileToPresignedUrl({
        upload,
        file: selectedFile,
        contentType: validation.contentType,
      });

      setStage("submitting");
      const payment = await paymentService.submitPayment(
        state.order.organizationId,
        state.order.orderId,
        upload.objectKey,
      );
      setLatestPayment(payment);

      setStage("refreshing");
      const [refreshedOrder, refreshedPayment] = await Promise.all([
        orderService.getMyOrder(state.order.orderId),
        paymentService.getMyPayment(state.order.orderId),
      ]);

      setSelectedFile(null);
      setLatestPayment(refreshedPayment);
      setState({ status: "success", order: refreshedOrder });
    } catch (error) {
      if (isDefinitiveSessionFailure(error)) {
        authSession.logout();
        return;
      }

      if (error instanceof DirectUploadError) {
        setServerError(
          error.status === 403
            ? "ลิงก์อัปโหลดหมดอายุหรือไม่สามารถใช้งานได้ กรุณากดส่งใหม่ ระบบจะขอลิงก์ใหม่ให้อัตโนมัติ"
            : "อัปโหลดหลักฐานไม่สำเร็จ กรุณาลองส่งใหม่อีกครั้ง",
        );
      } else if (
        error instanceof ApiClientError &&
        error.code === "PAYMENT_NOT_REVIEWABLE"
      ) {
        setServerError(
          "ไม่สามารถส่งหลักฐานในสถานะแคมเปญปัจจุบันได้ กรุณาตรวจสอบคำสั่งซื้ออีกครั้ง",
        );
      } else {
        setServerError(
          error instanceof ApiClientError
            ? error.userMessage
            : "ไม่สามารถส่งหลักฐานการชำระเงินได้ กรุณาลองใหม่อีกครั้ง",
        );
      }
    } finally {
      setStage("idle");
    }
  }

  if (state.status !== "success") {
    return (
      <div className={styles.page}>
        <main className={styles.stateWrap}>
          {state.status === "loading" ? (
            <LoadingState title="กำลังโหลดข้อมูลการชำระเงิน" />
          ) : null}
          {state.status === "invalid" ? (
            <ErrorState
              title="ลิงก์การชำระเงินไม่สมบูรณ์"
              description="ลิงก์นี้ต้องมี orderId ที่ถูกต้อง"
              actions={<Link href="/my/orders/">กลับรายการคำสั่งซื้อ</Link>}
            />
          ) : null}
          {state.status === "notFound" ? (
            <ErrorState
              title="ไม่พบคำสั่งซื้อ"
              description="ไม่พบคำสั่งซื้อที่สามารถเปิดจากบัญชีนี้"
              actions={<Link href="/my/orders/">กลับรายการคำสั่งซื้อ</Link>}
            />
          ) : null}
          {state.status === "unauthorized" ? <UnauthorizedState /> : null}
          {state.status === "forbidden" ? <ForbiddenState /> : null}
          {state.status === "error" ? (
            <ErrorState
              title="ไม่สามารถโหลดข้อมูลการชำระเงินได้"
              description="กรุณาลองโหลดหน้านี้ใหม่อีกครั้ง"
              actions={<Link href="/my/orders/">กลับรายการคำสั่งซื้อ</Link>}
            />
          ) : null}
        </main>
      </div>
    );
  }

  const { order } = state;
  const canSubmit = canSubmitPaymentSlip(order.status);
  const currentStageLabel = stageLabel(stage);

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <Link href={myOrderHref(order.orderId)} className={styles.backLink}>
          กลับรายละเอียดคำสั่งซื้อ
        </Link>

        <header className={styles.header} data-ledger-heading>
          <span className={styles.eyebrow}>Payment</span>
          <h1 className={styles.title}>การชำระเงิน</h1>
          <p className={styles.description}>
            อัปโหลดหลักฐานโดยตรงไปยังพื้นที่จัดเก็บผ่านลิงก์ที่ Backend ออกให้
            จากนั้นระบบจะส่งเฉพาะ object key กลับไปยืนยัน
          </p>
        </header>

        <section className={styles.panel}>
          <div className={styles.statusRow}>
            <div className={styles.meta}>
              <span className={styles.metaLabel}>เลขคำสั่งซื้อ</span>
              <span className={styles.metaValue}>{order.orderId}</span>
            </div>
            <OrderStatusBadge status={order.status} />
          </div>

          <div className={styles.meta}>
            <span className={styles.metaLabel}>ยอดรวม</span>
            <span className={styles.amount}>{formatSatang(order.total)}</span>
          </div>

          <div className={styles.notice} role="status">
            {paymentOrderStateMessage(order.status)}
          </div>

          {latestPayment ? (
            <div className={styles.meta}>
              <span className={styles.metaLabel}>สถานะ Payment ปัจจุบัน</span>
              <span className={styles.metaValue}>
                {latestPayment.status}
              </span>
            </div>
          ) : null}

          {order.status === "PAYMENT_REJECTED" && latestPayment ? (
            <div className={styles.rejectedNotice} role="alert">
              <strong>การชำระเงินถูกปฏิเสธ</strong>
              <div>
                เหตุผล: {latestPayment.rejectReason}
              </div>
              <div>
                สามารถเลือกหลักฐานใหม่และส่งซ้ำได้ โดยระบบจะใช้ Payment
                record เดิมและล้างข้อมูลการตรวจครั้งก่อนหลังส่งใหม่
              </div>
            </div>
          ) : null}
        </section>

        {canSubmit ? (
          <section className={styles.panel}>
            <form className={styles.uploadForm} onSubmit={handleSubmit}>
              <div className={styles.fileField}>
                <label className={styles.fileLabel} htmlFor="payment-slip">
                  หลักฐานการชำระเงิน
                </label>
                <input
                  className={styles.fileInput}
                  id="payment-slip"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) =>
                    handleFileChange(event.target.files?.[0] ?? null)
                  }
                  disabled={stage !== "idle"}
                  required
                  aria-invalid={fileError ? true : undefined}
                  aria-describedby={
                    fileError
                      ? "payment-slip-hint payment-slip-error"
                      : "payment-slip-hint"
                  }
                />
                <span
                  className={styles.fileHint}
                  id="payment-slip-hint"
                >
                  JPEG, PNG หรือ WebP ขนาดไม่เกิน 10 MiB
                </span>
                {fileError ? (
                  <span
                    className={styles.fileError}
                    id="payment-slip-error"
                    role="alert"
                  >
                    {fileError}
                  </span>
                ) : null}
              </div>

              {currentStageLabel ? (
                <div className={styles.progress} aria-live="polite">
                  <strong>กำลังดำเนินการ</strong>
                  <span>{currentStageLabel}</span>
                </div>
              ) : null}

              {serverError ? (
                <div className={styles.serverError} role="alert">
                  {serverError}
                </div>
              ) : null}

              <div className={styles.actions}>
                <Button
                  type="submit"
                  size="large"
                  pending={stage !== "idle"}
                  pendingLabel="กำลังส่งหลักฐาน"
                  disabled={!selectedFile}
                >
                  {order.status === "PAYMENT_REJECTED"
                    ? "ส่งหลักฐานใหม่"
                    : "ส่งหลักฐานการชำระเงิน"}
                </Button>
              </div>
            </form>
          </section>
        ) : null}

        {serverError && !canSubmit ? (
          <div className={styles.serverError} role="alert">
            {serverError}
          </div>
        ) : null}
      </main>
    </div>
  );
}
