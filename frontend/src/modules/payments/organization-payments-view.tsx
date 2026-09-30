"use client";

import { useEffect, useState, type FormEvent } from "react";

import {
  Badge,
  Button,
  ConfirmDialog,
  Dialog,
  EmptyState,
  ErrorState,
  ForbiddenState,
  LoadingState,
  SelectField,
  TextareaField,
  TextField,
  UnauthorizedState,
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
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectReasonError, setRejectReasonError] = useState<
    string | undefined
  >();

  const [inlineError, setInlineError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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
    } catch (error) {
      if (isDefinitiveSessionFailure(error)) {
        authSession.logout();
        return;
      }

      setInlineError(operationErrorMessage(error));
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
    } catch (error) {
      if (isDefinitiveSessionFailure(error)) {
        authSession.logout();
        return;
      }

      setInlineError(operationErrorMessage(error));
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

      setState({
        status: "success",
        payments: [...state.payments, ...result.items],
        nextCursor: result.nextCursor,
      });
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

      await refreshSelected(
        approved.paymentId,
        approved.orderId,
      );

      setDownload(null);
      setNotice("อนุมัติการชำระเงินเรียบร้อยแล้ว");
    } catch (error) {
      if (isDefinitiveSessionFailure(error)) {
        authSession.logout();
        return;
      }

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
      return;
    }

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

      await refreshSelected(
        rejected.paymentId,
        rejected.orderId,
      );

      setRejectOpen(false);
      setRejectReason("");
      setRejectReasonError(undefined);
      setDownload(null);
      setNotice("ปฏิเสธการชำระเงินและบันทึกเหตุผลแล้ว");
    } catch (error) {
      if (isDefinitiveSessionFailure(error)) {
        authSession.logout();
        return;
      }

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
          {state.status === "loading" ? (
            <LoadingState title="กำลังโหลดคิวตรวจสอบการชำระเงิน" />
          ) : null}
          {state.status === "unauthorized" ? (
            <UnauthorizedState />
          ) : null}
          {state.status === "forbidden" ? (
            <ForbiddenState />
          ) : null}
          {state.status === "error" ? (
            <ErrorState
              title="ไม่สามารถโหลดรายการชำระเงินได้"
              description="กรุณาลองโหลดหน้านี้ใหม่อีกครั้ง"
            />
          ) : null}
        </main>
      </div>
    );
  }

  const hasFilters =
    Boolean(appliedFilters.status) ||
    Boolean(appliedFilters.campaignId) ||
    Boolean(appliedFilters.orderId);

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.header}>
          <div className={styles.headerCopy} data-ledger-heading>
            <span className={styles.eyebrow}>Payment review</span>
            <h1 className={styles.title}>
              ตรวจสอบการชำระเงิน
            </h1>
            <p className={styles.description}>
              Staff และ Organization Admin ตรวจสอบสลิปผ่าน
              Private Pre-signed URL และตัดสินผลผ่าน Backend
              โดยสถานะ Payment และ Order จาก API เป็นข้อมูลอ้างอิงหลัก
            </p>
          </div>

          <Badge tone="info">
            {state.payments.length} รายการในหน้าปัจจุบัน
          </Badge>
        </header>

        <form
          className={styles.filterPanel}
          onSubmit={applyFilters}
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
              placeholder="กรองด้วย Campaign ID"
              disabled={filtering}
            />

            <TextField
              id="payment-review-order"
              label="Order ID"
              value={draftOrderId}
              onChange={(event) =>
                setDraftOrderId(event.target.value)
              }
              placeholder="กรองด้วย Order ID"
              disabled={filtering}
            />
          </div>

          <div className={styles.filterActions}>
            <Button
              type="submit"
              pending={filtering}
              pendingLabel="กำลังค้นหา"
            >
              ค้นหา / กรอง
            </Button>
            <Button
              type="button"
              variant="quiet"
              disabled={filtering}
              onClick={() => {
                void clearFilters();
              }}
            >
              ล้างตัวกรอง
            </Button>
          </div>
        </form>

        {inlineError ? (
          <div className={styles.inlineError} role="alert">
            {inlineError}
          </div>
        ) : null}

        {notice ? (
          <div className={styles.notice} role="status">
            {notice}
          </div>
        ) : null}

        <div className={styles.layout}>
          <section
            className={styles.section}
            aria-labelledby="payment-review-list"
          >
            <h2
              className={styles.sectionTitle}
              id="payment-review-list"
            >
              คิว Payment
            </h2>

            {state.payments.length === 0 ? (
              <EmptyState
                title="ไม่พบรายการชำระเงิน"
                description={
                  hasFilters
                    ? "ไม่มี Payment ที่ตรงกับตัวกรองปัจจุบัน"
                    : "หน่วยงานนี้ยังไม่มี Payment"
                }
              />
            ) : (
              <div className={styles.list}>
                {state.payments.map((payment) => (
                  <article
                    className={styles.card}
                    key={payment.paymentId}
                  >
                    <div className={styles.cardCopy}>
                      <h3 className={styles.cardTitle}>
                        Payment {payment.paymentId}
                      </h3>
                      <div className={styles.metaGrid}>
                        <div className={styles.metaItem}>
                          <span className={styles.metaLabel}>
                            Order ID
                          </span>
                          <span className={styles.metaValue}>
                            {payment.orderId}
                          </span>
                        </div>
                        <div className={styles.metaItem}>
                          <span className={styles.metaLabel}>
                            Customer ID
                          </span>
                          <span className={styles.metaValue}>
                            {payment.customerId}
                          </span>
                        </div>
                        <div className={styles.metaItem}>
                          <span className={styles.metaLabel}>
                            ส่งเมื่อ
                          </span>
                          <span className={styles.metaValue}>
                            {formatIsoDateTime(payment.createdAt)}
                          </span>
                        </div>
                        <div className={styles.metaItem}>
                          <span className={styles.metaLabel}>
                            อัปเดตล่าสุด
                          </span>
                          <span className={styles.metaValue}>
                            {formatIsoDateTime(payment.updatedAt)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className={styles.cardAside}>
                      <Badge
                        tone={paymentStatusTone(payment.status)}
                      >
                        {paymentStatusLabel(payment.status)}
                      </Badge>
                      <div className={styles.cardActions}>
                        <Button
                          variant="secondary"
                          pending={
                            detailLoadingId === payment.paymentId
                          }
                          pendingLabel="กำลังโหลด"
                          disabled={reviewPending !== null}
                          onClick={() => {
                            void selectPayment(payment);
                          }}
                        >
                          ตรวจสอบ
                        </Button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {state.nextCursor ? (
              <div className={styles.loadMore}>
                <Button
                  variant="secondary"
                  pending={loadingMore}
                  pendingLabel="กำลังโหลด"
                  onClick={() => {
                    void loadMore();
                  }}
                >
                  โหลดเพิ่มเติม
                </Button>
              </div>
            ) : null}
          </section>

          <aside aria-label="รายละเอียด Payment">
            {selected ? (
              <div className={styles.detailPanel}>
                <div className={styles.detailHeader}>
                  <div className={styles.detailCopy}>
                    <span className={styles.eyebrow}>
                      Payment detail
                    </span>
                    <h2 className={styles.detailTitle}>
                      {selected.payment.paymentId}
                    </h2>
                    <span className={styles.detailCode}>
                      Order {selected.payment.orderId}
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

                <div className={styles.metaGrid}>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>
                      Customer ID
                    </span>
                    <span className={styles.metaValue}>
                      {selected.payment.customerId}
                    </span>
                  </div>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>
                      ตรวจสอบโดย
                    </span>
                    <span className={styles.metaValue}>
                      {selected.payment.reviewedBy ?? "ยังไม่ตรวจสอบ"}
                    </span>
                  </div>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>
                      เวลาตรวจสอบ
                    </span>
                    <span className={styles.metaValue}>
                      {formatIsoDateTime(
                        selected.payment.reviewedAt,
                      )}
                    </span>
                  </div>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>
                      อัปเดต Payment
                    </span>
                    <span className={styles.metaValue}>
                      {formatIsoDateTime(
                        selected.payment.updatedAt,
                      )}
                    </span>
                  </div>
                </div>

                <div className={styles.orderPanel}>
                  <div className={styles.detailHeader}>
                    <h3 className={styles.sectionTitle}>
                      Order ที่เกี่ยวข้อง
                    </h3>
                    <OrderStatusBadge
                      status={selected.order.status}
                    />
                  </div>
                  <div className={styles.orderSummary}>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>
                        Campaign ID
                      </span>
                      <span className={styles.metaValue}>
                        {selected.order.campaignId}
                      </span>
                    </div>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>
                        ยอดรวม
                      </span>
                      <span className={styles.amount}>
                        {formatSatang(selected.order.total)}
                      </span>
                    </div>
                  </div>
                </div>

                {selected.payment.status === "REJECTED" ? (
                  <div className={styles.rejectBox}>
                    <strong>เหตุผลที่ปฏิเสธ</strong>
                    <span>
                      {selected.payment.rejectReason ??
                        "Backend ไม่ได้ส่งเหตุผลกลับมา"}
                    </span>
                  </div>
                ) : null}

                {selected.payment.status !== "PENDING_REVIEW" ? (
                  <div className={styles.reviewedBox}>
                    Payment นี้ผ่านการตัดสินผลแล้ว
                    จึงไม่มี action อนุมัติหรือปฏิเสธซ้ำ
                  </div>
                ) : null}

                <div className={styles.downloadBox}>
                  <strong>สลิปการชำระเงิน</strong>
                  <span>
                    ไฟล์เป็น private object ต้องขอ Pre-signed
                    download URL จาก Backend ก่อนเปิดดู
                  </span>

                  <div className={styles.downloadActions}>
                    <Button
                      variant="secondary"
                      pending={downloadPending}
                      pendingLabel="กำลังขอลิงก์"
                      disabled={reviewPending !== null}
                      onClick={() => {
                        void requestSlipDownload();
                      }}
                    >
                      ขอลิงก์ดูสลิป
                    </Button>
                  </div>

                  {download ? (
                    <>
                      <a
                        className={styles.temporaryLink}
                        href={download.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        เปิดสลิปในแท็บใหม่
                      </a>
                      <span className={styles.metaLabel}>
                        ลิงก์ชั่วคราวหมดอายุในประมาณ{" "}
                        {Math.max(
                          1,
                          Math.round(
                            download.expiresInSeconds / 60,
                          ),
                        )}{" "}
                        นาที
                      </span>
                    </>
                  ) : null}
                </div>

                {selected.payment.status ===
                "PENDING_REVIEW" ? (
                  <div className={styles.reviewActions}>
                    <ConfirmDialog
                      trigger={
                        <Button
                          disabled={reviewPending !== null}
                        >
                          อนุมัติ
                        </Button>
                      }
                      title="ยืนยันการอนุมัติการชำระเงิน"
                      description="Backend จะตรวจ Campaign และ Payment state อีกครั้งก่อนอัปเดต Payment และ Order"
                      confirmLabel="ยืนยันอนุมัติ"
                      pending={reviewPending === "approve"}
                      onConfirm={() => {
                        void handleApprove();
                      }}
                    />

                    <Button
                      variant="danger"
                      disabled={reviewPending !== null}
                      onClick={() => {
                        setRejectReason("");
                        setRejectReasonError(undefined);
                        setRejectOpen(true);
                      }}
                    >
                      ปฏิเสธ
                    </Button>
                  </div>
                ) : null}

                <Dialog
                  open={rejectOpen}
                  onOpenChange={(open) => {
                    if (!reviewPending) {
                      setRejectOpen(open);
                      if (!open) {
                        setRejectReasonError(undefined);
                      }
                    }
                  }}
                  title="ปฏิเสธการชำระเงิน"
                  description="ระบุเหตุผลที่ลูกค้าสามารถใช้แก้ไขและส่งสลิปใหม่ได้"
                  footer={
                    <div className={styles.dialogActions}>
                      <Button
                        variant="secondary"
                        disabled={reviewPending !== null}
                        onClick={() => setRejectOpen(false)}
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
                    <TextareaField
                      id="payment-reject-reason"
                      label="เหตุผลที่ปฏิเสธ"
                      value={rejectReason}
                      onChange={(event) => {
                        setRejectReason(event.target.value);
                        setRejectReasonError(undefined);
                      }}
                      error={rejectReasonError}
                      required
                      disabled={reviewPending === "reject"}
                      placeholder="เช่น ยอดเงินในสลิปไม่ตรงกับยอด Order"
                    />
                  </div>
                </Dialog>
              </div>
            ) : (
              <div className={styles.emptyDetail}>
                เลือก Payment จากคิวเพื่อดู Order,
                เปิดสลิปแบบมีสิทธิ์ และดำเนินการตรวจสอบ
              </div>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
