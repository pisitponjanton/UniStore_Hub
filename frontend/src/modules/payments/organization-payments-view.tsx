"use client";

import { StaffOperationNav } from "@/modules/operations/staff-operation-nav";

import { AsyncPageFallback } from "@/components/ui/async-page";
import { useQueueFilterFeedback } from "@/modules/operations/use-queue-filter-feedback";
import { QueuePriorityControls, QueueFilterEmpty } from "@/modules/operations/queue-priority-controls";
import { useRevealSelectedQueueDetail } from "@/modules/operations/use-reveal-selected-queue-detail";
import { prioritizeLoadedQueue, visibleLoadedQueue } from "@/modules/operations/queue-priority";

import { useEffect, useRef, useState, type FormEvent } from "react";

import {
  Badge,
  Button,
  ConfirmDialog,
  Dialog,
  EmptyState,
  ErrorSummary,
  Notice,
  SelectField,
  TextareaField,
  TextField,
  useErrorSummaryFocus,
} from "@/components";
import {
  authSession,
  isDefinitiveSessionFailure,
} from "@/modules/auth";
import {
  orderService,
  OrderStatusBadge,
} from "@/modules/orders";
import { ApiClientError } from "@/services";
import {
  PAYMENT_STATUSES,
  type Cursor,
  type OrderDTO,
  type PaymentDTO,
  type PaymentStatus,
  type PresignedDownloadDTO,
} from "@/types";
import { formatIsoDateTime, formatSatang } from "@/utils";

import {
  paymentStatusLabel,
  validateRejectReason,
} from "./payment-review-helpers";
import { paymentService } from "./payment-service";
import styles from "./organization-payments.module.css";

interface AppliedFilters {
  status: PaymentStatus | "";
  campaignId: string;
  orderId: string;
}

type PaymentsState =
  | { status: "loading" }
  | { status: "unauthorized" }
  | { status: "forbidden" }
  | { status: "error" }
  | {
      status: "success";
      payments: PaymentDTO[];
      nextCursor: Cursor | null;
    };

interface SelectedPaymentState {
  payment: PaymentDTO;
  order: OrderDTO;
}

const EMPTY_FILTERS: AppliedFilters = {
  status: "",
  campaignId: "",
  orderId: "",
};

function paymentStatusTone(
  status: PaymentStatus,
): "info" | "success" | "danger" {
  switch (status) {
    case "PENDING_REVIEW":
      return "info";
    case "APPROVED":
      return "success";
    case "REJECTED":
      return "danger";
  }
}

function operationErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.code === "PAYMENT_NOT_FOUND") {
      return "ไม่พบรายการชำระเงินนี้แล้ว กรุณารีเฟรชคิวตรวจสอบ";
    }

    if (error.code === "PAYMENT_NOT_REVIEWABLE") {
      return "Campaign ไม่อยู่ในสถานะที่อนุญาตให้ตรวจสอบการชำระเงินแล้ว";
    }

    if (error.code === "INVALID_STATUS_TRANSITION") {
      return "สถานะ Payment เปลี่ยนไปแล้วและไม่สามารถตรวจสอบซ้ำได้";
    }

    if (error.code === "FILE_ACCESS_FORBIDDEN") {
      return "ไม่มีสิทธิ์เปิดไฟล์สลิปนี้";
    }

    return error.userMessage;
  }

  return "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง";
}

export function OrganizationPaymentsView({
  organizationId,
}: {
  organizationId: string;
}) {
  const focusErrorSummary = useErrorSummaryFocus();
  const [state, setState] = useState<PaymentsState>({
    status: "loading",
  });

  const [draftStatus, setDraftStatus] = useState<
    PaymentStatus | ""
  >("");
  const [draftCampaignId, setDraftCampaignId] = useState("");
  const [draftOrderId, setDraftOrderId] = useState("");
  const [appliedFilters, setAppliedFilters] =
    useState<AppliedFilters>(EMPTY_FILTERS);
  const [filtering, setFiltering] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [queueView, setQueueView] = useState<"all" | "action">("all");
  const [visibleLimit, setVisibleLimit] = useState(30);

  const [selected, setSelected] =
    useState<SelectedPaymentState | null>(null);
  const [detailLoadingId, setDetailLoadingId] =
    useState<string | null>(null);

  const [download, setDownload] =
    useState<PresignedDownloadDTO | null>(null);
  const [downloadPending, setDownloadPending] = useState(false);

  const [reviewPending, setReviewPending] = useState<
    "approve" | "reject" | null
  >(null);
  const [approveOpen, setApproveOpen] = useState(false);
  const reviewResultFocusRequested = useRef(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectReasonError, setRejectReasonError] = useState<
    string | undefined
  >();

  const [inlineError, setInlineError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [listFeedback, setListFeedback] = useState<string | null>(null);
  const { successRef, errorRef, announceCompletion } = useQueueFilterFeedback(filtering, inlineError);

  // Terminal review feedback lives outside Radix. Close its focus trap first.
  useEffect(() => {
    if (!reviewResultFocusRequested.current || reviewPending || approveOpen || rejectOpen || (!inlineError && !notice)) return;
    const timeout = window.setTimeout(() => {
      const target = document.querySelector<HTMLElement>("[data-payment-review-result]");
      if (target && reviewResultFocusRequested.current) {
        reviewResultFocusRequested.current = false;
        target.focus({ preventScroll: true });
        target.scrollIntoView({ block: "nearest", behavior: "instant" });
      }
    }, 150);
    return () => window.clearTimeout(timeout);
  }, [reviewPending, approveOpen, rejectOpen, inlineError, notice]);

  useRevealSelectedQueueDetail(selected?.payment.paymentId ?? null, "staff-payment-detail");

  useEffect(() => {
    const controller = new AbortController();

    async function loadPayments() {
      try {
        const result =
          await paymentService.listOrganizationPayments(
            organizationId,
            { signal: controller.signal },
          );

        if (!controller.signal.aborted) {
          setState({
            status: "success",
            payments: result.items,
            nextCursor: result.nextCursor,
          });
        }
      } catch (error) {
        if (
          controller.signal.aborted ||
          (error instanceof DOMException &&
            error.name === "AbortError")
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
        }

        setState({ status: "error" });
      }
    }

    void loadPayments();

    return () => controller.abort();
  }, [organizationId]);

  function updatePaymentInList(payment: PaymentDTO) {
    setState((current) =>
      current.status === "success"
        ? {
            ...current,
            payments: current.payments.map((item) =>
              item.paymentId === payment.paymentId
                ? payment
                : item,
            ),
          }
        : current,
    );
  }

  async function applyFilters(
    event?: FormEvent<HTMLFormElement>,
  ) {
    event?.preventDefault();

    if (filtering) {
      return;
    }

    const nextFilters: AppliedFilters = {
      status: draftStatus,
      campaignId: draftCampaignId.trim(),
      orderId: draftOrderId.trim(),
    };

    setFiltering(true);
    setInlineError(null);
    setNotice(null);

    try {
      const result =
        await paymentService.listOrganizationPayments(
          organizationId,
          {
            status: nextFilters.status || null,
            campaignId: nextFilters.campaignId || null,
            orderId: nextFilters.orderId || null,
          },
        );

      setAppliedFilters(nextFilters);
      setSelected(null);
      setDownload(null);
      setState({
        status: "success",
        payments: result.items,
        nextCursor: result.nextCursor,
      });
      setListFeedback(
        `แสดง ${result.items.length.toLocaleString("th-TH")} การชำระเงิน${nextFilters.status ? ` · ${paymentStatusLabel(nextFilters.status)}` : ""}`,
      );
      announceCompletion();
    } catch (error) {
      if (isDefinitiveSessionFailure(error)) {
        authSession.logout();
        return;
      }

      setInlineError(operationErrorMessage(error));
      announceCompletion();
    } finally {
      setFiltering(false);
    }
  }

  async function clearFilters() {
    if (filtering) {
      return;
    }

    setDraftStatus("");
    setDraftCampaignId("");
    setDraftOrderId("");
    setFiltering(true);
    setInlineError(null);
    setNotice(null);

    try {
      const result =
        await paymentService.listOrganizationPayments(
          organizationId,
        );

      setAppliedFilters(EMPTY_FILTERS);
      setSelected(null);
      setDownload(null);
      setState({
        status: "success",
        payments: result.items,
        nextCursor: result.nextCursor,
      });
      setListFeedback(
        `แสดงการชำระเงินทั้งหมดที่โหลด ${result.items.length.toLocaleString("th-TH")} รายการ`,
      );
      announceCompletion();
    } catch (error) {
      if (isDefinitiveSessionFailure(error)) {
        authSession.logout();
        return;
      }

      setInlineError(operationErrorMessage(error));
      announceCompletion();
    } finally {
      setFiltering(false);
    }
  }

  async function loadMore() {
    if (
      state.status !== "success" ||
      !state.nextCursor ||
      loadingMore
    ) {
      return;
    }

    setLoadingMore(true);
    setInlineError(null);

    try {
      const result =
        await paymentService.listOrganizationPayments(
          organizationId,
          {
            status: appliedFilters.status || null,
            campaignId: appliedFilters.campaignId || null,
            orderId: appliedFilters.orderId || null,
            cursor: state.nextCursor,
          },
        );

      const nextPayments = [...state.payments, ...result.items];

      setState({
        status: "success",
        payments: nextPayments,
        nextCursor: result.nextCursor,
      });
      setListFeedback(
        `โหลดเพิ่มเติมแล้ว ตอนนี้แสดง ${nextPayments.length.toLocaleString("th-TH")} การชำระเงิน`,
      );
    } catch (error) {
      if (isDefinitiveSessionFailure(error)) {
        authSession.logout();
        return;
      }

      setInlineError(operationErrorMessage(error));
    } finally {
      setLoadingMore(false);
    }
  }

  async function selectPayment(payment: PaymentDTO) {
    if (detailLoadingId || reviewPending) {
      return;
    }

    setDetailLoadingId(payment.paymentId);
    setInlineError(null);
    setNotice(null);
    setDownload(null);
    setRejectOpen(false);
    setRejectReason("");
    setRejectReasonError(undefined);

    try {
      const [freshPayment, order] = await Promise.all([
        paymentService.getOrganizationPayment(
          organizationId,
          payment.paymentId,
        ),
        orderService.getOrganizationOrder(
          organizationId,
          payment.orderId,
        ),
      ]);

      setSelected({
        payment: freshPayment,
        order,
      });
      updatePaymentInList(freshPayment);
    } catch (error) {
      if (isDefinitiveSessionFailure(error)) {
        authSession.logout();
        return;
      }

      setInlineError(operationErrorMessage(error));
    } finally {
      setDetailLoadingId(null);
    }
  }

  async function refreshSelected(
    paymentId: string,
    orderId: string,
  ) {
    const [payment, order] = await Promise.all([
      paymentService.getOrganizationPayment(
        organizationId,
        paymentId,
      ),
      orderService.getOrganizationOrder(
        organizationId,
        orderId,
      ),
    ]);

    setSelected({ payment, order });
    updatePaymentInList(payment);
    return { payment, order };
  }

  async function requestSlipDownload() {
    if (!selected || downloadPending) {
      return;
    }

    setDownloadPending(true);
    setInlineError(null);
    setDownload(null);

    try {
      const result =
        await paymentService.requestPrivateDownloadUrl(
          organizationId,
          selected.payment.slipKey,
        );

      setDownload(result);
    } catch (error) {
      if (isDefinitiveSessionFailure(error)) {
        authSession.logout();
        return;
      }

      setInlineError(operationErrorMessage(error));
    } finally {
      setDownloadPending(false);
    }
  }

  async function handleApprove() {
    if (
      !selected ||
      selected.payment.status !== "PENDING_REVIEW" ||
      reviewPending
    ) {
      return;
    }

    reviewResultFocusRequested.current = true;
    setReviewPending("approve");
    setInlineError(null);
    setNotice(null);

    try {
      const approved = await paymentService.approvePayment(
        organizationId,
        selected.payment.paymentId,
      );

      setSelected((current) =>
        current
          ? {
              ...current,
              payment: approved,
            }
          : current,
      );
      updatePaymentInList(approved);

      setDownload(null);
      setApproveOpen(false);
      setNotice("อนุมัติการชำระเงินเรียบร้อยแล้ว");

      // The mutation is already committed. A slow/failed readback must
      // not hide successful approval or invite a duplicate review action.
      try {
        await refreshSelected(
          approved.paymentId,
          approved.orderId,
        );
      } catch (error) {
        if (isDefinitiveSessionFailure(error)) {
          authSession.logout();
          return;
        }

        setNotice(
          "อนุมัติการชำระเงินเรียบร้อยแล้ว แต่ยังโหลดรายละเอียดล่าสุดไม่ได้ กรุณารีเฟรชข้อมูล",
        );
      }
    } catch (error) {
      if (isDefinitiveSessionFailure(error)) {
        authSession.logout();
        return;
      }

      setApproveOpen(false);
      setInlineError(operationErrorMessage(error));

      try {
        await refreshSelected(
          selected.payment.paymentId,
          selected.payment.orderId,
        );
      } catch {
        // Preserve the review error with the last known detail.
      }
    } finally {
      setReviewPending(null);
    }
  }

  async function handleReject() {
    if (
      !selected ||
      selected.payment.status !== "PENDING_REVIEW" ||
      reviewPending
    ) {
      return;
    }

    const validation = validateRejectReason(rejectReason);
    setRejectReasonError(validation.error);

    if (!validation.valid) {
      focusErrorSummary(
        "payment-reject-error-summary",
      );
      return;
    }

    reviewResultFocusRequested.current = true;
    setReviewPending("reject");
    setInlineError(null);
    setNotice(null);

    try {
      const rejected = await paymentService.rejectPayment(
        organizationId,
        selected.payment.paymentId,
        validation.value,
      );

      setSelected((current) =>
        current
          ? {
              ...current,
              payment: rejected,
            }
          : current,
      );
      updatePaymentInList(rejected);

      setRejectOpen(false);
      setRejectReason("");
      setRejectReasonError(undefined);
      setDownload(null);
      setNotice("ปฏิเสธการชำระเงินและบันทึกเหตุผลแล้ว");

      try {
        await refreshSelected(
          rejected.paymentId,
          rejected.orderId,
        );
      } catch (error) {
        if (isDefinitiveSessionFailure(error)) {
          authSession.logout();
          return;
        }

        setNotice(
          "ปฏิเสธการชำระเงินและบันทึกเหตุผลแล้ว แต่ยังโหลดรายละเอียดล่าสุดไม่ได้ กรุณารีเฟรชข้อมูล",
        );
      }
    } catch (error) {
      if (isDefinitiveSessionFailure(error)) {
        authSession.logout();
        return;
      }

      setRejectOpen(false);
      setInlineError(operationErrorMessage(error));

      try {
        await refreshSelected(
          selected.payment.paymentId,
          selected.payment.orderId,
        );
      } catch {
        // Preserve the review error with the last known detail.
      }
    } finally {
      setReviewPending(null);
    }
  }

  if (state.status !== "success") {
    return (
      <div className={styles.page}>
        <main className={styles.stateWrap}>
          <AsyncPageFallback
            status={state.status}
            pageTitle="ตรวจสอบการชำระเงิน"
            pageDescription="ตรวจหลักฐานและตัดสินใจรายการของหน่วยงาน"
            loadingTitle="กำลังโหลดคิวตรวจสอบการชำระเงิน"
            errorTitle="ไม่สามารถโหลดรายการชำระเงินได้"
            backHref="/org/select/"
            backLabel="กลับไปพื้นที่ทำงาน"
          />
        </main>
      </div>
    );
  }

  const hasFilters =
    Boolean(appliedFilters.status) ||
    Boolean(appliedFilters.campaignId) ||
    Boolean(appliedFilters.orderId);
  const pendingReviewCount = state.payments.filter(
    (payment) => payment.status === "PENDING_REVIEW",
  ).length;
  const approvedCount = state.payments.filter(
    (payment) => payment.status === "APPROVED",
  ).length;
  const rejectedCount = state.payments.filter(
    (payment) => payment.status === "REJECTED",
  ).length;

  const isActionable = (payment: PaymentDTO) => payment.status === "PENDING_REVIEW";
  const sortedRows = prioritizeLoadedQueue(state.payments, isActionable, item => item.updatedAt);
  const queueRows = visibleLoadedQueue(sortedRows, queueView, isActionable);
  const visibleRows = queueRows.slice(0, visibleLimit);

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <StaffOperationNav organizationId={organizationId} current="payments" />
        <header className={styles.header}>
          <div className={styles.headerCopy}>
            <h1 className={styles.title}>ตรวจสอบการชำระเงิน</h1>
            <p className={styles.description}>
              เปิดหลักฐานการชำระเงิน เทียบกับคำสั่งซื้อ แล้วอนุมัติหรือปฏิเสธพร้อมเหตุผลจากคิวเดียว
            </p>
          </div>
        </header>
        <QueuePriorityControls
          heading="คิวตรวจสอบการชำระเงิน"
          actionLabel="ตรวจสลิป"
          countLabel="รอตรวจสอบ"
          actionCount={pendingReviewCount}
          loadedCount={state.payments.length}
          mode={queueView}
          onChange={(next) => { setQueueView(next); setVisibleLimit(30); }}
          listId="payment-review-list"
          filterId="payment-filter-title"
        />








        {listFeedback ? (
          <p
            ref={successRef}
            tabIndex={-1}
            data-queue-filter-feedback="success"
            className={`${styles.listFeedback} ${styles.focusableFeedback}`}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {listFeedback}
          </p>
        ) : null}

        {inlineError ? (
          <div ref={errorRef} tabIndex={-1} data-payment-review-result data-queue-filter-feedback="error" className={styles.focusableFeedback}>
            <Notice tone="danger" role="alert" title="ดำเนินการไม่สำเร็จ">
              {inlineError}
            </Notice>
          </div>
        ) : null}

        {notice ? (
          <div tabIndex={-1} data-payment-review-result className={styles.focusableFeedback}>
            <Notice tone="success" role="status" title="อัปเดตแล้ว">
              {notice}
            </Notice>
          </div>
        ) : null}

        <div className={styles.layout}>
          <section
            className={styles.section}
            aria-labelledby="payment-review-list"
          >
            <div className={styles.sectionHeading}>
              <div>
                <h2
                  className={styles.sectionTitle}
                  id="payment-review-list"
                >
                  คิวการชำระเงิน
                </h2>
                <p className={styles.sectionDescription}>
                  เลือกรายการเพื่อโหลดข้อมูลล่าสุดของ Payment และ Order ก่อนตัดสินผล
                </p>
              </div>
              <span className={styles.sectionMeta}>
                {state.payments.length.toLocaleString("th-TH")} รายการ
              </span>
            </div>

            {state.payments.length === 0 ? (
              <EmptyState
                title="ไม่พบรายการชำระเงิน"
                description={
                  hasFilters
                    ? "ไม่มีรายการที่ตรงกับตัวกรองปัจจุบัน"
                    : "หน่วยงานนี้ยังไม่มีรายการชำระเงิน"
                }
              />
            ) : (
              <div className={styles.list}>
                {visibleRows.length === 0 ? <QueueFilterEmpty onShowAll={() => setQueueView("all")} /> : null}
                {visibleRows.map((payment) => {
                  const isSelected =
                    selected?.payment.paymentId === payment.paymentId;

                  return (
                    <article
                      className={[
                        styles.row,
                        isSelected ? styles.rowSelected : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      data-attention={payment.status === "PENDING_REVIEW" || undefined}
                      key={payment.paymentId}
                      aria-current={isSelected ? "true" : undefined}
                      aria-label={`การชำระเงิน ${payment.paymentId} · ${paymentStatusLabel(payment.status)}`}
                    >
                      <div className={styles.rowMain}>
                        <div className={styles.rowHeading}>
                          <h3 className={styles.cardTitle} title={`Payment ${payment.paymentId}`}>
                            หลักฐาน {payment.paymentId.slice(0, 12)}
                          </h3>
                          <Badge
                            tone={paymentStatusTone(payment.status)}
                          >
                            {paymentStatusLabel(payment.status)}
                          </Badge>
                        </div>
                        <div className={styles.metaRow}>
                          <span className={styles.meta}>
                            คำสั่งซื้อ {payment.orderId.slice(0, 12)}
                          </span>
                          <span className={styles.meta}>
                            ลูกค้า {payment.customerId.slice(0, 12)}
                          </span>
                          <time className={styles.meta} dateTime={payment.createdAt}>
                            ส่งเมื่อ {formatIsoDateTime(payment.createdAt)}
                          </time>
                        </div>

                        {payment.status === "PENDING_REVIEW" ? (
                          <div className={styles.queuePriority} role="note">
                            <span className={styles.queuePriorityLabel}>
                              รอดำเนินการ
                            </span>
                            <strong>เปิดหลักฐานและตัดสินผล</strong>
                          </div>
                        ) : null}
                      </div>

                      <div className={styles.cardActions}>
                        <Button
                          variant="secondary"
                          aria-label={`${isSelected ? "กำลังตรวจสอบ" : "ตรวจสอบ"} การชำระเงิน ${payment.paymentId}`}
                          pending={
                            detailLoadingId === payment.paymentId
                          }
                          pendingLabel="กำลังโหลด"
                          disabled={reviewPending !== null}
                          onClick={() => {
                            void selectPayment(payment);
                          }}
                        >
                          {isSelected ? "กำลังตรวจสอบ" : "ตรวจสอบ"}
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {queueRows.length > visibleLimit ? (
              <div className={styles.loadMore}>
                <Button type="button" variant="secondary" onClick={() => setVisibleLimit(limit => limit + 30)}>
                  แสดงอีก {Math.min(30, queueRows.length - visibleLimit)} รายการจากชุดที่โหลด
                </Button>
              </div>
            ) : null}

            {state.nextCursor && queueRows.length <= visibleLimit ? (
              <div className={styles.loadMore}>
                <Button
                  variant="secondary"
                  pending={loadingMore}
                  pendingLabel="กำลังโหลดเพิ่มเติม"
                  onClick={() => {
                    void loadMore();
                  }}
                >
                  โหลดเพิ่มเติม
                </Button>
              </div>
            ) : null}
          </section>

          <aside id="staff-payment-detail" tabIndex={-1} aria-label="รายละเอียดการชำระเงิน">
            {selected ? (
              <div className={styles.detailPanel}>
                <div className={styles.detailHeader}>
                  <div className={styles.detailCopy}>
                    <span className={styles.detailLabel}>รายการที่กำลังตรวจสอบ</span>
                    <h2 className={styles.detailTitle}>
                      หลักฐานชำระเงิน {selected.payment.paymentId.slice(0, 12)}
                    </h2>
                    <span className={styles.detailCode}>
                      คำสั่งซื้อ {selected.payment.orderId}
                    </span>
                  </div>

                  <Badge
                    tone={paymentStatusTone(
                      selected.payment.status,
                    )}
                  >
                    {paymentStatusLabel(
                      selected.payment.status,
                    )}
                  </Badge>
                </div>

                <dl className={styles.reviewSnapshot}>
                  <div>
                    <dt className={styles.metaLabel}>ยอดคำสั่งซื้อ</dt>
                    <dd className={styles.amount} data-numeric>
                      {formatSatang(selected.order.total)}
                    </dd>
                  </div>
                  <div>
                    <dt className={styles.metaLabel}>สถานะ Order</dt>
                    <dd className={styles.snapshotValue}>
                      <OrderStatusBadge
                        status={selected.order.status}
                      />
                    </dd>
                  </div>
                </dl>

                <section
                  className={styles.reviewGuide}
                  aria-label="ลำดับการตรวจสอบการชำระเงิน"
                >
                  <div className={styles.reviewGuideStep}>
                    <span className={styles.reviewGuideIndex} aria-hidden="true">1</span>
                    <div>
                      <strong>เปิดหลักฐาน</strong>
                      <span>ขอลิงก์ชั่วคราวเพื่อดูสลิปที่ผูกกับ Payment นี้</span>
                    </div>
                  </div>
                  <div className={styles.reviewGuideStep}>
                    <span className={styles.reviewGuideIndex} aria-hidden="true">2</span>
                    <div>
                      <strong>เทียบกับคำสั่งซื้อ</strong>
                      <span>ตรวจยอดรวมและข้อมูลในหลักฐานกับ Order ล่าสุดจากระบบ</span>
                    </div>
                  </div>
                  <div className={styles.reviewGuideStep}>
                    <span className={styles.reviewGuideIndex} aria-hidden="true">3</span>
                    <div>
                      <strong>
                        {selected.payment.status === "PENDING_REVIEW"
                          ? "ตัดสินผล"
                          : "ตัดสินผลแล้ว"}
                      </strong>
                      <span>
                        {selected.payment.status === "PENDING_REVIEW"
                          ? "อนุมัติ หรือปฏิเสธพร้อมเหตุผลหลังตรวจหลักฐาน"
                          : `สถานะปัจจุบัน: ${paymentStatusLabel(selected.payment.status)}`}
                      </span>
                    </div>
                  </div>
                </section>

                <dl className={styles.metaGrid}>
                  <div className={styles.metaItem}>
                    <dt className={styles.metaLabel}>Customer ID</dt>
                    <dd className={styles.metaValue}>
                      {selected.payment.customerId}
                    </dd>
                  </div>
                  <div className={styles.metaItem}>
                    <dt className={styles.metaLabel}>Campaign ID</dt>
                    <dd className={styles.metaValue}>
                      {selected.order.campaignId}
                    </dd>
                  </div>
                  <div className={styles.metaItem}>
                    <dt className={styles.metaLabel}>ตรวจสอบโดย</dt>
                    <dd className={styles.metaValue}>
                      {selected.payment.reviewedBy ?? "ยังไม่ตรวจสอบ"}
                    </dd>
                  </div>
                  <div className={styles.metaItem}>
                    <dt className={styles.metaLabel}>เวลาตรวจสอบ</dt>
                    <dd className={styles.metaValue}>
                      {selected.payment.reviewedAt ? (
                        <time dateTime={selected.payment.reviewedAt}>
                          {formatIsoDateTime(selected.payment.reviewedAt)}
                        </time>
                      ) : (
                        "ยังไม่ตรวจสอบ"
                      )}
                    </dd>
                  </div>
                </dl>

                {selected.payment.status === "REJECTED" ? (
                  <Notice
                    tone="danger"
                    title="เหตุผลที่ปฏิเสธ"
                  >
                    {selected.payment.rejectReason ??
                      "ไม่พบเหตุผลที่บันทึกไว้"}
                  </Notice>
                ) : null}

                {selected.payment.status === "PENDING_REVIEW" ? (
                  <Notice
                    tone="warning"
                    title="ตรวจหลักฐานก่อนตัดสินผล"
                  >
                    เทียบยอดและข้อมูลในสลิปกับคำสั่งซื้อก่อนอนุมัติ หากปฏิเสธควรระบุเหตุผลที่ลูกค้านำไปแก้ไขได้
                  </Notice>
                ) : (
                  <Notice
                    tone="neutral"
                    title="รายการนี้ตัดสินผลแล้ว"
                  >
                    การชำระเงินนี้ไม่มี action อนุมัติหรือปฏิเสธซ้ำ
                  </Notice>
                )}

                <section
                  className={styles.slipPanel}
                  aria-labelledby="payment-slip-title"
                >
                  <div className={styles.panelHeading}>
                    <div>
                      <h3 className={styles.panelTitle} id="payment-slip-title">
                        หลักฐานการชำระเงิน
                      </h3>
                      <p className={styles.panelDescription}>
                        ลิงก์สำหรับดูสลิปเป็นลิงก์ชั่วคราวและจะหมดอายุ
                      </p>
                    </div>
                  </div>

                  <div className={styles.downloadActions}>
                    <Button
                      variant="secondary"
                      pending={downloadPending}
                      pendingLabel="กำลังเตรียมลิงก์"
                      disabled={reviewPending !== null}
                      onClick={() => {
                        void requestSlipDownload();
                      }}
                    >
                      เปิดสลิป
                    </Button>
                  </div>

                  {download ? (
                    <div className={styles.downloadReady}>
                      <a
                        className={styles.temporaryLink}
                        href={download.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        เปิดสลิปในแท็บใหม่
                      </a>
                      <span className={styles.meta}>
                        ลิงก์หมดอายุในประมาณ{" "}
                        {Math.max(
                          1,
                          Math.round(
                            download.expiresInSeconds / 60,
                          ),
                        )}{" "}
                        นาที
                      </span>
                    </div>
                  ) : null}
                </section>

                {selected.payment.status ===
                "PENDING_REVIEW" ? (
                  <section
                    className={styles.decisionPanel}
                    aria-labelledby="payment-decision-title"
                  >
                    <div className={styles.panelHeading}>
                      <div>
                        <h3
                          className={styles.panelTitle}
                          id="payment-decision-title"
                        >
                          ตัดสินผลการชำระเงิน
                        </h3>
                        <p className={styles.panelDescription}>
                          การอนุมัติหรือปฏิเสธจะอัปเดตทั้ง Payment และสถานะ Order ที่เกี่ยวข้องตามกฎของระบบ
                        </p>
                      </div>
                    </div>

                    <div className={styles.reviewActions}>
                      <ConfirmDialog
                        open={approveOpen}
                        onOpenChange={(open) => {
                          if (!reviewPending) setApproveOpen(open);
                        }}
                        onCloseAutoFocus={(event) => {
                          if (reviewResultFocusRequested.current) event.preventDefault();
                        }}
                        trigger={
                          <Button
                            disabled={reviewPending !== null}
                          >
                            อนุมัติการชำระเงิน
                          </Button>
                        }
                        title="ยืนยันการอนุมัติการชำระเงิน"
                        description="เมื่อยืนยัน ระบบจะตรวจสอบสถานะอีกครั้งก่อนบันทึกผลอนุมัติ และอัปเดตคำสั่งซื้อที่เกี่ยวข้องตามกฎเดิม"
                        confirmLabel="ยืนยันอนุมัติ"
                        pending={reviewPending === "approve"}
                        onConfirm={() => {
                          void handleApprove();
                        }}
                      />

                      <Button
                        variant="danger"
                        data-payment-reject-trigger
                        disabled={reviewPending !== null}
                        onClick={() => {
                          setRejectReason("");
                          setRejectReasonError(undefined);
                          setRejectOpen(true);
                        }}
                      >
                        ปฏิเสธการชำระเงิน
                      </Button>
                    </div>
                  </section>
                ) : null}

                <Dialog
                  open={rejectOpen}
                  onCloseAutoFocus={(event) => {
                    // This controlled dialog is opened by a button outside Radix
                    // Trigger. Restore focus explicitly on Back / Escape.
                    const trigger = document.querySelector<HTMLButtonElement>("[data-payment-reject-trigger]");
                    event.preventDefault();
                    if (reviewResultFocusRequested.current) return;
                    if (trigger) trigger.focus({ preventScroll: true });
                    else document.getElementById("staff-payment-detail")?.focus({ preventScroll: true });
                  }}
                  onOpenChange={(open) => {
                    if (!reviewPending) {
                      setRejectOpen(open);
                      if (!open) {
                        setRejectReasonError(undefined);
                      }
                    }
                  }}
                  title="ปฏิเสธการชำระเงิน"
                  description="ระบุเหตุผลให้ชัดเจนเพื่อให้ลูกค้าทราบว่าต้องแก้ไขอะไร ก่อนส่งหลักฐานใหม่"
                  footer={
                    <div className={styles.dialogActions}>
                      <Button
                        variant="secondary"
                        disabled={reviewPending !== null}
                        onPointerDown={(event) => {
                          event.preventDefault();
                          setRejectReasonError(undefined);
                          setRejectOpen(false);
                        }}
                        onClick={() => {
                          setRejectReasonError(undefined);
                          setRejectOpen(false);
                        }}
                      >
                        กลับ
                      </Button>
                      <Button
                        variant="danger"
                        pending={reviewPending === "reject"}
                        pendingLabel="กำลังปฏิเสธ"
                        onClick={() => {
                          void handleReject();
                        }}
                      >
                        ยืนยันปฏิเสธ
                      </Button>
                    </div>
                  }
                >
                  <div className={styles.dialogBody}>
                    <ErrorSummary
                      id="payment-reject-error-summary"
                      items={
                        rejectReasonError
                          ? [
                              {
                                fieldId: "payment-reject-reason",
                                message: rejectReasonError,
                              },
                            ]
                          : []
                      }
                    />
                    <TextareaField
                      id="payment-reject-reason"
                      label="เหตุผลที่ปฏิเสธ"
                      value={rejectReason}
                      onChange={(event) => {
                        setRejectReason(event.target.value);
                        setRejectReasonError(undefined);
                      }}
                      error={rejectReasonError}
                      announceError={false}
                      required
                      disabled={reviewPending === "reject"}
                      placeholder="เช่น ยอดเงินในสลิปไม่ตรงกับยอดคำสั่งซื้อ"
                    />
                  </div>
                </Dialog>
              </div>
            ) : (
              <div className={styles.emptyDetail}>
                <strong>เลือกหลักฐานเพื่อเริ่มตรวจสอบ</strong>
                <span>
                  ระบบจะโหลดข้อมูลชำระเงินและคำสั่งซื้อล่าสุดก่อนให้อนุมัติหรือปฏิเสธ
                </span>
              </div>
            )}
          </aside>
        </div>
        <section className={styles.summaryStrip} aria-label="สรุปคิวชำระเงินที่โหลด">
          <div>
            <span className={styles.summaryLabel}>รายการที่โหลด</span>
            <strong>{state.payments.length}</strong>
          </div>
          <div>
            <span className={styles.summaryLabel}>รอตรวจสอบ</span>
            <strong>{pendingReviewCount}</strong>
          </div>
          <div>
            <span className={styles.summaryLabel}>อนุมัติแล้ว</span>
            <strong>{approvedCount}</strong>
          </div>
          <div>
            <span className={styles.summaryLabel}>ปฏิเสธแล้ว</span>
            <strong>{rejectedCount}</strong>
          </div>
        </section>

        <section className={styles.filterPanel} aria-labelledby="payment-filter-title">
          <div className={styles.filterHeading}>
            <div>
              <h2 className={styles.sectionTitle} id="payment-filter-title">
                ค้นหาคิวตรวจสอบ
              </h2>
              <p className={styles.sectionDescription}>
                กรองด้วยสถานะ รหัสแคมเปญ หรือรหัสคำสั่งซื้อ
              </p>
            </div>
            <div className={styles.appliedFilters} role="group" aria-label="ตัวกรองที่ใช้อยู่">
              {hasFilters ? (
                <>
                  {appliedFilters.status ? (
                    <span>
                      สถานะ: {paymentStatusLabel(appliedFilters.status)}
                    </span>
                  ) : null}
                  {appliedFilters.campaignId ? (
                    <span>Campaign: {appliedFilters.campaignId}</span>
                  ) : null}
                  {appliedFilters.orderId ? (
                    <span>Order: {appliedFilters.orderId}</span>
                  ) : null}
                </>
              ) : (
                <span>แสดงทุกการชำระเงิน</span>
              )}
            </div>
          </div>

          <form
            className={styles.filterForm}
            onSubmit={applyFilters}
            aria-busy={filtering}
          >
            <div className={styles.filters}>
              <SelectField
                id="payment-review-status"
                label="สถานะ Payment"
                value={draftStatus}
                onChange={(event) =>
                  setDraftStatus(
                    event.target.value as PaymentStatus | "",
                  )
                }
                disabled={filtering}
              >
                <option value="">ทุกสถานะ</option>
                {PAYMENT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {paymentStatusLabel(status)}
                  </option>
                ))}
              </SelectField>

              <TextField
                id="payment-review-campaign"
                label="Campaign ID"
                value={draftCampaignId}
                onChange={(event) =>
                  setDraftCampaignId(event.target.value)
                }
                placeholder="เช่น campaign-..."
                disabled={filtering}
              />

              <TextField
                id="payment-review-order"
                label="Order ID"
                value={draftOrderId}
                onChange={(event) =>
                  setDraftOrderId(event.target.value)
                }
                placeholder="เช่น order-..."
                disabled={filtering}
              />
            </div>

            <div className={styles.filterActions}>
              <Button
                type="submit"
                pending={filtering}
                pendingLabel="กำลังค้นหา"
              >
                ใช้ตัวกรอง
              </Button>
              <Button
                type="button"
                variant="quiet"
                disabled={
                  filtering ||
                  (!hasFilters &&
                    !draftCampaignId.trim() &&
                    !draftOrderId.trim() &&
                    !draftStatus)
                }
                onClick={() => {
                  void clearFilters();
                }}
              >
                แสดงทั้งหมด
              </Button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
