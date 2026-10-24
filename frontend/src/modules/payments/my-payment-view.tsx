"use client";


import { PageLoadingRows, PageStateHeading } from "@/components/ui/async-page";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, UploadCloud, FileImage } from "lucide-react";
import {
  Button,
  ErrorState,
  ForbiddenState,
  LoadingState,
  Notice,
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
  formatIsoDateTime,
  formatSatang,
  getRequiredQueryId,
  validateUploadCandidate,
} from "@/utils";

import { DirectUploadError, putFileToPresignedUrl } from "./direct-upload";
import {
  canSubmitPaymentSlip,
  formatUploadFileSize,
  getPaymentStatePresentation,
  getPaymentStatusLabel,
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

const stageSequence: Array<Exclude<SubmitStage, "idle">> = [
  "signing",
  "uploading",
  "submitting",
  "refreshing",
];

const stageCopy: Record<
  Exclude<SubmitStage, "idle">,
  { label: string; description: string }
> = {
  signing: {
    label: "เตรียมการอัปโหลด",
    description: "กำลังขอลิงก์อัปโหลดที่ใช้ได้กับคำสั่งซื้อนี้",
  },
  uploading: {
    label: "อัปโหลดหลักฐาน",
    description: "กำลังส่งไฟล์หลักฐานไปยังพื้นที่จัดเก็บ",
  },
  submitting: {
    label: "ส่งหลักฐานเข้าตรวจสอบ",
    description: "กำลังแจ้งระบบให้ใช้ไฟล์ที่อัปโหลดสำหรับคำสั่งซื้อนี้",
  },
  refreshing: {
    label: "ตรวจสอบสถานะล่าสุด",
    description: "กำลังโหลดสถานะคำสั่งซื้อและการชำระเงินหลังส่งหลักฐาน",
  },
};

function getStageState(
  item: Exclude<SubmitStage, "idle">,
  current: Exclude<SubmitStage, "idle">,
): "done" | "current" | "upcoming" {
  const itemIndex = stageSequence.indexOf(item);
  const currentIndex = stageSequence.indexOf(current);

  if (itemIndex < currentIndex) {
    return "done";
  }

  return itemIndex === currentIndex ? "current" : "upcoming";
}

export function MyPaymentView() {
  const [state, setState] = useState<PaymentViewState>({
    status: "loading",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [fileError, setFileError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitFeedback, setSubmitFeedback] = useState<string | null>(null);
  const [latestPayment, setLatestPayment] = useState<PaymentDTO | null>(null);
  const [stage, setStage] = useState<SubmitStage>("idle");

  const resultFeedbackRef = useRef<HTMLDivElement>(null);

  const focusAfterUserRetry = useRef(false);

  useEffect(() => () => {
    if (previewUrlRef.current && typeof URL.revokeObjectURL === "function") {
      URL.revokeObjectURL(previewUrlRef.current);
    }
  }, []);

  function updatePreview(file: File | null) {
    if (previewUrlRef.current && typeof URL.revokeObjectURL === "function") {
      URL.revokeObjectURL(previewUrlRef.current);
    }
    const nextUrl = file && typeof URL.createObjectURL === "function"
      ? URL.createObjectURL(file)
      : null;
    previewUrlRef.current = nextUrl;
    setPreviewUrl(nextUrl);
  }

  function retryLoad() {
    focusAfterUserRetry.current = true;
    setState({ status: "loading" });
    setLoadAttempt((attempt) => attempt + 1);
  }

  useEffect(() => {
    if (!focusAfterUserRetry.current || state.status === "loading") return;
    focusAfterUserRetry.current = false;
    const frame = window.requestAnimationFrame(() => {
      const heading = document.querySelector<HTMLElement>("main h1");
      if (!heading) return;
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
      heading.scrollIntoView?.({ block: "start", behavior: "instant" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [state.status]);

  useEffect(() => {
    // A failed upload or completed resubmission may remove the submit button.
    // Announce the terminal result where keyboard users can actually find it.
    if (stage !== "idle" || (!serverError && !submitFeedback)) return;
    const frame = window.requestAnimationFrame(() => {
      resultFeedbackRef.current?.focus({ preventScroll: true });
      resultFeedbackRef.current?.scrollIntoView?.({ block: "start", behavior: "instant" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [stage, serverError, submitFeedback]);

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
  }, [loadAttempt]);

  function handleFileChange(
    file: File | null,
    input?: HTMLInputElement,
  ) {
    setSelectedFile(file);
    updatePreview(null);
    setFileError(null);
    setServerError(null);
    setSubmitFeedback(null);

    if (!file) {
      return;
    }

    const validation = validateUploadCandidate(file, "paymentSlip");

    if (!validation.ok) {
      setSelectedFile(null);
      if (input) {
        input.value = "";
      }
      setFileError(
        validation.reason === "UNSUPPORTED_TYPE"
          ? "รองรับเฉพาะไฟล์ JPEG, PNG หรือ WebP"
          : "ไฟล์หลักฐานต้องมีขนาดไม่เกิน 10 MiB",
      );
    } else {
      updatePreview(file);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      state.status !== "success" ||
      !canSubmitPaymentSlip(state.order.status) ||
      stage !== "idle"
    ) {
      return;
    }

    setServerError(null);
    setSubmitFeedback(null);

    if (!selectedFile) {
      setFileError("กรุณาเลือกไฟล์หลักฐานการชำระเงิน");
      requestAnimationFrame(() => document.getElementById("payment-slip")?.focus());
      return;
    }

    const validation = validateUploadCandidate(selectedFile, "paymentSlip");

    if (!validation.ok) {
      handleFileChange(selectedFile);
      return;
    }

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
      updatePreview(null);
      setLatestPayment(refreshedPayment);
      setState({ status: "success", order: refreshedOrder });
      setSubmitFeedback("ส่งหลักฐานแล้ว ระบบกำลังรอเจ้าหน้าที่ตรวจสอบ");
    } catch (error) {
      if (isDefinitiveSessionFailure(error)) {
        authSession.logout();
        return;
      }

      if (error instanceof DirectUploadError) {
        setServerError(
          error.status === 403
            ? "ลิงก์อัปโหลดหมดอายุหรือใช้ไม่ได้ กรุณากดส่งอีกครั้ง ระบบจะขอลิงก์ใหม่ให้อัตโนมัติ"
            : "อัปโหลดหลักฐานไม่สำเร็จ กรุณาลองส่งใหม่อีกครั้ง",
        );
      } else if (
        error instanceof ApiClientError &&
        error.code === "PAYMENT_NOT_REVIEWABLE"
      ) {
        setServerError(
          "ไม่สามารถส่งหลักฐานในสถานะแคมเปญปัจจุบันได้ กรุณากลับไปตรวจสอบคำสั่งซื้อ",
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
          <PageStateHeading title="การชำระเงิน" description="ตรวจสอบคำสั่งซื้อและหลักฐานการชำระเงิน" />
          {state.status === "loading" ? <PageLoadingRows /> : null}
          {state.status === "loading" ? (
            <LoadingState
              title="กำลังโหลดข้อมูลการชำระเงิน"
              description="กำลังตรวจสอบคำสั่งซื้อและสถานะหลักฐานล่าสุด"
            />
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
              description="ลองดึงสถานะคำสั่งซื้อและหลักฐานล่าสุดอีกครั้ง หรือกลับไปดูรายการคำสั่งซื้อ"
              actions={
                <>
                  <Button
                    onClick={retryLoad}
                  >
                    ลองโหลดอีกครั้ง
                  </Button>
                  <Link href="/my/orders/">กลับรายการคำสั่งซื้อ</Link>
                </>
              }
            />
          ) : null}
        </main>
      </div>
    );
  }

  const { order } = state;
  const canSubmit = canSubmitPaymentSlip(order.status);
  const paymentState = getPaymentStatePresentation(order.status);
  const activeStage = stage === "idle" ? null : stage;

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <Link href={myOrderHref(order.orderId)} className={styles.backLink}>
          กลับรายละเอียดคำสั่งซื้อ
        </Link>

        <header className={styles.header} data-order-status={order.status}>
          <div className={styles.headerCopy}>
            <h1 className={styles.title}>ชำระและส่งหลักฐาน</h1>
            <p className={styles.headerOrderId}>คำสั่งซื้อ <span className={styles.orderCode}>{order.orderId}</span></p>
          </div>
          <div className={styles.headerAmount}>
            <span className={styles.metaLabel}>ยอดที่ต้องชำระ</span>
            <strong className={styles.amount} data-numeric>{formatSatang(order.total)}</strong>
          </div>
        </header>

        <section className={styles.paymentStatusStrip} data-tone={paymentState.tone} aria-label="สถานะการชำระเงิน">
          <span className={styles.statusMarker} aria-hidden="true" />
          <div className={styles.paymentStatusBody}>
            <div className={styles.paymentStatusHeading}>
              <strong>{paymentState.title}</strong>
              <OrderStatusBadge status={order.status} />
            </div>
            <p className={styles.paymentStatusDescription}>{paymentState.description}</p>
            <p className={styles.paymentStatusMeta}>
              <span>หลักฐาน: {latestPayment ? getPaymentStatusLabel(latestPayment.status) : "ยังไม่ได้ส่ง"}</span>
              <span aria-hidden="true">·</span>
              <span>อัปเดตล่าสุด <time dateTime={latestPayment?.updatedAt ?? order.updatedAt}>{formatIsoDateTime(latestPayment?.updatedAt ?? order.updatedAt)}</time></span>
            </p>
          </div>
        </section>

        {order.status === "PAYMENT_REJECTED" && latestPayment ? (
          <Notice
            tone="danger"
            role="alert"
            title="เหตุผลที่หลักฐานไม่ผ่านการตรวจสอบ"
          >
            <strong className={styles.rejectReason}>
              {latestPayment.rejectReason || "ไม่พบเหตุผลจากระบบ"}
            </strong>
            <span className={styles.rejectHelp}>
              เลือกหลักฐานใหม่ด้านล่างแล้วส่งอีกครั้ง ระบบจะใช้รายการชำระเงินเดิมและนำหลักฐานใหม่เข้าสู่การตรวจสอบ
            </span>
          </Notice>
        ) : null}

        {canSubmit ? (
          <section className={styles.uploadSection} aria-labelledby="payment-upload-title">
            <div className={styles.sectionHeading}>
              <h2 className={styles.sectionTitle} id="payment-upload-title">
                {order.status === "PAYMENT_REJECTED" ? "ส่งหลักฐานใหม่" : "อัปโหลดหลักฐานการชำระเงิน"}
              </h2>
            </div>

            <form className={styles.uploadForm} onSubmit={handleSubmit} aria-busy={stage !== "idle"} noValidate>
              <div className={styles.proofField}>
                <label htmlFor="payment-slip" className={styles.proofLabel}>
                  หลักฐานการชำระเงิน <span aria-hidden="true">*</span>
                </label>
                <div className={styles.proofDropzone} data-selected={selectedFile ? "true" : undefined}>
                  <input
                    id="payment-slip"
                    className={styles.proofInput}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    aria-label="หลักฐานการชำระเงิน"
                    aria-invalid={fileError ? true : undefined}
                    aria-describedby={fileError ? "payment-slip-hint payment-slip-error" : "payment-slip-hint"}
                    aria-errormessage={fileError ? "payment-slip-error" : undefined}
                    required
                    disabled={stage !== "idle"}
                    onChange={event => handleFileChange(event.target.files?.[0] ?? null, event.currentTarget)}
                  />
                  <div className={styles.proofDropzoneVisual} aria-hidden="true">
                    {selectedFile ? (
                      <>
                        {previewUrl
                          ? <Image className={styles.proofPreview} src={previewUrl} alt="" width={76} height={76} unoptimized onError={() => setPreviewUrl(null)} />
                          : <FileImage size={30} strokeWidth={1.7} />}
                        <div className={styles.proofSelected}>
                          <strong>{selectedFile.name}</strong>
                          <span>{formatUploadFileSize(selectedFile.size)} · กดเพื่อเปลี่ยนไฟล์</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <UploadCloud size={27} strokeWidth={1.7} />
                        <strong>เลือกไฟล์สลิปการชำระเงิน</strong>
                        <span className={styles.proofChoose}>เลือกไฟล์</span>
                      </>
                    )}
                  </div>
                </div>
                <p id="payment-slip-hint" className={styles.proofHint}>
                  JPEG, PNG หรือ WebP · สูงสุด 10 MiB · กรุณาให้เห็นยอด วันเวลา และรายละเอียดชัดเจน
                </p>
                {selectedFile ? (
                  <p className={styles.proofSelectionAccessible} role="status">
                    ไฟล์ที่เลือก: {selectedFile.name} ({formatUploadFileSize(selectedFile.size)})
                  </p>
                ) : null}
                {fileError ? <p id="payment-slip-error" className={styles.proofError} role="alert">{fileError}</p> : null}
              </div>

              {activeStage ? (
                <div
                  className={styles.progressPanel}
                  aria-label="ความคืบหน้าการส่งหลักฐาน"
                >
                  <div
                    className={styles.progressCurrent}
                    role="status"
                    aria-live="polite"
                    aria-atomic="true"
                  >
                    <strong>{stageCopy[activeStage].label}</strong>
                    <span>{stageCopy[activeStage].description}</span>
                  </div>
                  <ol className={styles.progressSteps}>
                    {stageSequence.map((item) => {
                      const itemState = getStageState(item, activeStage);
                      return (
                        <li
                          key={item}
                          className={styles.progressStep}
                          data-state={itemState}
                        >
                          <span className={styles.progressMarker} aria-hidden="true" />
                          <span className={styles.progressStepCopy}>
                            <span>{stageCopy[item].label}</span>
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

              {serverError ? (
                <div
                  ref={resultFeedbackRef}
                  tabIndex={-1}
                  data-payment-operation-error
                  className={styles.actionFeedback}
                >
                  <Notice tone="danger" role="alert" title="ส่งหลักฐานไม่สำเร็จ">
                    {serverError}
                  </Notice>
                </div>
              ) : null}

              <div className={styles.actions}>
                <Button type="submit" size="large" pending={stage !== "idle"} pendingLabel="กำลังส่งหลักฐาน">
                  {order.status === "PAYMENT_REJECTED" ? "ส่งหลักฐานใหม่" : "ส่งหลักฐานการชำระเงิน"}
                  <ArrowRight size={19} strokeWidth={2.6} aria-hidden="true" />
                </Button>
              </div>
            </form>
          </section>
        ) : null}

        {submitFeedback ? (
          <div ref={resultFeedbackRef} tabIndex={-1} data-payment-operation-success className={styles.actionFeedback}>
            <Notice tone="success" role="status" title="ส่งหลักฐานสำเร็จ">
              {submitFeedback}
            </Notice>
          </div>
        ) : null}

        {serverError && !canSubmit ? (
          <Notice tone="danger" role="alert" title="ไม่สามารถดำเนินการได้">
            {serverError}
          </Notice>
        ) : null}
      </main>
    </div>
  );
}
