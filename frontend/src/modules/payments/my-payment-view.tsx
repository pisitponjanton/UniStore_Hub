"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import {
  Button,
  ErrorState,
  FileField,
  ForbiddenState,
  LoadingState,
  Notice,
  TaskStatus,
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

    const validation = validateUploadCandidate(selectedFile, "paymentSlip");

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
  const paymentState = getPaymentStatePresentation(order.status);
  const activeStage = stage === "idle" ? null : stage;

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <Link href={myOrderHref(order.orderId)} className={styles.backLink}>
          กลับรายละเอียดคำสั่งซื้อ
        </Link>

        <header className={styles.header}>
          <div className={styles.headerCopy}>
            <span className={styles.pageKicker}>ขั้นตอนการชำระเงิน</span>
            <h1 className={styles.title}>ชำระและส่งหลักฐาน</h1>
            <p className={styles.description}>
              ตรวจสอบสถานะล่าสุดก่อนทุกครั้ง จากนั้นส่งหลักฐานเฉพาะเมื่อรายการนี้เปิดให้ส่งได้
            </p>
          </div>
          <div className={styles.headerAmount}>
            <span className={styles.metaLabel}>ยอดที่ระบบบันทึก</span>
            <strong className={styles.amount} data-numeric>
              {formatSatang(order.total)}
            </strong>
            <span className={styles.headerAmountNote}>ชำระตามยอดของคำสั่งซื้อนี้</span>
          </div>
        </header>
        <TaskStatus
          tone={paymentState.tone}
          label={<OrderStatusBadge status={order.status} />}
          title={paymentState.title}
          description={paymentState.description}
          metadata={
            <span className={styles.orderCode}>
              คำสั่งซื้อ {order.orderId}
            </span>
          }
        />

        <section className={styles.paymentFacts} aria-label="ข้อมูลการชำระเงิน">
          <div>
            <span className={styles.metaLabel}>ยอดคำสั่งซื้อ</span>
            <strong className={styles.metaValue}>
              {formatSatang(order.total)}
            </strong>
          </div>
          <div>
            <span className={styles.metaLabel}>สถานะหลักฐาน</span>
            <strong className={styles.metaValue}>
              {latestPayment
                ? getPaymentStatusLabel(latestPayment.status)
                : "ยังไม่ได้ส่ง"}
            </strong>
          </div>
          <div>
            <span className={styles.metaLabel}>อัปเดตล่าสุด</span>
            <strong className={styles.metaValue}>
              {latestPayment
                ? formatIsoDateTime(latestPayment.updatedAt)
                : formatIsoDateTime(order.updatedAt)}
            </strong>
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
              <div>
                <span className={styles.stepLabel}>
                  {order.status === "PAYMENT_REJECTED"
                    ? "ส่งหลักฐานใหม่"
                    : "ส่งหลักฐาน"}
                </span>
                <h2 className={styles.sectionTitle} id="payment-upload-title">
                  เลือกไฟล์หลักฐานการชำระเงิน
                </h2>
              </div>
              <p className={styles.sectionDescription}>
                รองรับ JPEG, PNG หรือ WebP ขนาดไม่เกิน 10 MiB
              </p>
            </div>

            <form className={styles.uploadForm} onSubmit={handleSubmit}>
              <FileField
                id="payment-slip"
                label="หลักฐานการชำระเงิน"
                hint="เลือกรูปที่เห็นยอด วันเวลา และรายละเอียดการชำระเงินชัดเจน"
                error={fileError ?? undefined}
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) =>
                  handleFileChange(event.target.files?.[0] ?? null)
                }
                disabled={stage !== "idle"}
                required
              />

              {selectedFile ? (
                <div className={styles.selectedFile} aria-live="polite">
                  <div>
                    <span className={styles.selectedFileLabel}>
                      ไฟล์ที่เลือก
                    </span>
                    <strong className={styles.selectedFileName}>
                      {selectedFile.name}
                    </strong>
                  </div>
                  <span className={styles.selectedFileSize}>
                    {formatUploadFileSize(selectedFile.size)}
                  </span>
                </div>
              ) : (
                <div className={styles.noFileState}>
                  ยังไม่ได้เลือกไฟล์หลักฐาน
                </div>
              )}

              {activeStage ? (
                <div
                  className={styles.progressPanel}
                  role="status"
                  aria-live="polite"
                  aria-label="ความคืบหน้าการส่งหลักฐาน"
                >
                  <div className={styles.progressCurrent}>
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
                          <span>{stageCopy[item].label}</span>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              ) : null}

              {serverError ? (
                <Notice tone="danger" role="alert" title="ส่งหลักฐานไม่สำเร็จ">
                  {serverError}
                </Notice>
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
                <span className={styles.submitHint}>
                  หลังส่งสำเร็จ สถานะจะเปลี่ยนเป็นรอตรวจสอบ
                </span>
              </div>
            </form>
          </section>
        ) : null}

        {!canSubmit && latestPayment ? (
          <section className={styles.reviewSummary} aria-label="สถานะหลักฐานล่าสุด">
            <div className={styles.sectionHeading}>
              <div>
                <span className={styles.stepLabel}>หลักฐานล่าสุด</span>
                <h2 className={styles.sectionTitle}>
                  {getPaymentStatusLabel(latestPayment.status)}
                </h2>
              </div>
              <span className={styles.paymentId}>
                {latestPayment.paymentId}
              </span>
            </div>
            <p className={styles.reviewDescription}>
              {latestPayment.status === "PENDING_REVIEW"
                ? "ระบบได้รับหลักฐานแล้ว ขณะนี้กำลังรอเจ้าหน้าที่ตรวจสอบ"
                : latestPayment.status === "APPROVED"
                  ? "หลักฐานได้รับการอนุมัติแล้ว ไม่ต้องส่งหลักฐานเพิ่มเติม"
                  : "หลักฐานล่าสุดไม่ผ่านการตรวจสอบ"}
            </p>
          </section>
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
