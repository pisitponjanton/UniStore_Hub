"use client";

import { useEffect, useState, type FormEvent } from "react";

import {
  Button,
  EmptyState,
  ErrorState,
  ForbiddenState,
  LoadingState,
  Notice,
  SelectField,
  TextField,
  UnauthorizedState,
} from "@/components";
import {
  authSession,
  isDefinitiveSessionFailure,
} from "@/modules/auth";
import { ApiClientError } from "@/services";
import {
  ORDER_STATUSES,
  type Cursor,
  type OrderDTO,
  type OrderStatus,
} from "@/types";
import { formatIsoDateTime, formatSatang } from "@/utils";

import {
  organizationOrderHref,
} from "./organization-order-helpers";
import styles from "./organization-orders.module.css";
import { orderService } from "./order-service";
import {
  getOrderStatusLabel,
  OrderStatusBadge,
} from "./order-status";

interface AppliedFilters {
  campaignId: string;
  customerId: string;
  status: OrderStatus | "";
}

type OrdersState =
  | { status: "loading" }
  | { status: "unauthorized" }
  | { status: "forbidden" }
  | { status: "error" }
  | {
      status: "success";
      orders: OrderDTO[];
      nextCursor: Cursor | null;
    };

const EMPTY_FILTERS: AppliedFilters = {
  campaignId: "",
  customerId: "",
  status: "",
};

function requestErrorMessage(error: unknown): string {
  return error instanceof ApiClientError
    ? error.userMessage
    : "ไม่สามารถโหลดรายการคำสั่งซื้อได้ กรุณาลองใหม่อีกครั้ง";
}

export function OrganizationOrdersView({
  organizationId,
}: {
  organizationId: string;
}) {
  const [state, setState] = useState<OrdersState>({
    status: "loading",
  });
  const [draftCampaignId, setDraftCampaignId] = useState("");
  const [draftCustomerId, setDraftCustomerId] = useState("");
  const [draftStatus, setDraftStatus] = useState<OrderStatus | "">("");
  const [appliedFilters, setAppliedFilters] =
    useState<AppliedFilters>(EMPTY_FILTERS);
  const [filtering, setFiltering] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadOrders() {
      try {
        const result = await orderService.listOrganizationOrders(
          organizationId,
          { signal: controller.signal },
        );

        if (!controller.signal.aborted) {
          setState({
            status: "success",
            orders: result.items,
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

    void loadOrders();

    return () => controller.abort();
  }, [organizationId]);

  async function applyFilters(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    if (filtering) {
      return;
    }

    const nextFilters: AppliedFilters = {
      campaignId: draftCampaignId.trim(),
      customerId: draftCustomerId.trim(),
      status: draftStatus,
    };

    setFiltering(true);
    setInlineError(null);

    try {
      const result = await orderService.listOrganizationOrders(
        organizationId,
        {
          campaignId: nextFilters.campaignId || null,
          customerId: nextFilters.customerId || null,
          status: nextFilters.status || null,
        },
      );

      setAppliedFilters(nextFilters);
      setState({
        status: "success",
        orders: result.items,
        nextCursor: result.nextCursor,
      });
    } catch (error) {
      if (isDefinitiveSessionFailure(error)) {
        authSession.logout();
        return;
      }

      setInlineError(requestErrorMessage(error));
    } finally {
      setFiltering(false);
    }
  }

  async function clearFilters() {
    if (filtering) {
      return;
    }

    setDraftCampaignId("");
    setDraftCustomerId("");
    setDraftStatus("");

    setFiltering(true);
    setInlineError(null);

    try {
      const result = await orderService.listOrganizationOrders(
        organizationId,
      );

      setAppliedFilters(EMPTY_FILTERS);
      setState({
        status: "success",
        orders: result.items,
        nextCursor: result.nextCursor,
      });
    } catch (error) {
      if (isDefinitiveSessionFailure(error)) {
        authSession.logout();
        return;
      }

      setInlineError(requestErrorMessage(error));
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
      const result = await orderService.listOrganizationOrders(
        organizationId,
        {
          campaignId: appliedFilters.campaignId || null,
          customerId: appliedFilters.customerId || null,
          status: appliedFilters.status || null,
          cursor: state.nextCursor,
        },
      );

      setState({
        status: "success",
        orders: [...state.orders, ...result.items],
        nextCursor: result.nextCursor,
      });
    } catch (error) {
      if (isDefinitiveSessionFailure(error)) {
        authSession.logout();
        return;
      }

      setInlineError(requestErrorMessage(error));
    } finally {
      setLoadingMore(false);
    }
  }

  if (state.status !== "success") {
    return (
      <div className={styles.page}>
        <main className={styles.stateWrap}>
          {state.status === "loading" ? (
            <LoadingState title="กำลังโหลดคำสั่งซื้อของหน่วยงาน" />
          ) : null}
          {state.status === "unauthorized" ? <UnauthorizedState /> : null}
          {state.status === "forbidden" ? <ForbiddenState /> : null}
          {state.status === "error" ? (
            <ErrorState
              title="ไม่สามารถโหลดคำสั่งซื้อได้"
              description="กรุณาลองโหลดหน้านี้ใหม่อีกครั้ง"
            />
          ) : null}
        </main>
      </div>
    );
  }
  const hasFilters =
    Boolean(appliedFilters.campaignId) ||
    Boolean(appliedFilters.customerId) ||
    Boolean(appliedFilters.status);
  const paymentReviewCount = state.orders.filter(
    (order) => order.status === "PAYMENT_REVIEW",
  ).length;
  const paymentActionCount = state.orders.filter(
    (order) =>
      order.status === "PENDING_PAYMENT" ||
      order.status === "PAYMENT_REJECTED",
  ).length;
  const fulfillmentCount = state.orders.filter((order) =>
    [
      "CONFIRMED",
      "IN_PRODUCTION",
      "READY_FOR_PICKUP",
    ].includes(order.status),
  ).length;

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.header}>
          <div className={styles.headerCopy} data-ledger-heading>
            <span className={styles.pageKicker}>ศูนย์ติดตามคำสั่งซื้อ</span>
            <h1 className={styles.title}>คำสั่งซื้อของหน่วยงาน</h1>
            <p className={styles.description}>
              ค้นหาและติดตามคำสั่งซื้อตามแคมเปญ ลูกค้า และสถานะ เพื่อไปยังรายการที่ต้องดำเนินการต่อได้เร็วขึ้น
            </p>
          </div>
        </header>

        <section className={styles.summaryStrip} aria-label="สรุปคำสั่งซื้อที่โหลด">
          <div>
            <span className={styles.summaryLabel}>รายการที่โหลด</span>
            <strong>{state.orders.length}</strong>
          </div>
          <div>
            <span className={styles.summaryLabel}>รอตรวจการชำระเงิน</span>
            <strong>{paymentReviewCount}</strong>
          </div>
          <div>
            <span className={styles.summaryLabel}>รอชำระหรือแก้ไขการชำระ</span>
            <strong>{paymentActionCount}</strong>
          </div>
          <div>
            <span className={styles.summaryLabel}>กำลังดำเนินการหลังยืนยัน</span>
            <strong>{fulfillmentCount}</strong>
          </div>
        </section>

        <section className={styles.filterPanel} aria-labelledby="order-filter-title">
          <div className={styles.filterHeading}>
            <div>
              <h2 className={styles.sectionTitle} id="order-filter-title">
                ค้นหาและกรอง
              </h2>
              <p className={styles.sectionDescription}>
                ใช้รหัสแคมเปญ รหัสลูกค้า หรือสถานะร่วมกันได้
              </p>
            </div>
            <div className={styles.appliedFilters} role="group" aria-label="ตัวกรองที่ใช้อยู่">
              {hasFilters ? (
                <>
                  {appliedFilters.campaignId ? (
                    <span>Campaign: {appliedFilters.campaignId}</span>
                  ) : null}
                  {appliedFilters.customerId ? (
                    <span>Customer: {appliedFilters.customerId}</span>
                  ) : null}
                  {appliedFilters.status ? (
                    <span>
                      สถานะ: {getOrderStatusLabel(appliedFilters.status)}
                    </span>
                  ) : null}
                </>
              ) : (
                <span>แสดงทุกคำสั่งซื้อ</span>
              )}
            </div>
          </div>

          <form className={styles.filterForm} onSubmit={applyFilters}>
            <div className={styles.filters}>
              <TextField
                id="organization-orders-campaign"
                label="Campaign ID"
                value={draftCampaignId}
                onChange={(event) =>
                  setDraftCampaignId(event.target.value)
                }
                placeholder="เช่น campaign-..."
                disabled={filtering}
              />

              <TextField
                id="organization-orders-customer"
                label="Customer ID"
                value={draftCustomerId}
                onChange={(event) =>
                  setDraftCustomerId(event.target.value)
                }
                placeholder="เช่น customer-..."
                disabled={filtering}
              />

              <SelectField
                id="organization-orders-status"
                label="สถานะ Order"
                value={draftStatus}
                onChange={(event) =>
                  setDraftStatus(
                    event.target.value as OrderStatus | "",
                  )
                }
                disabled={filtering}
              >
                <option value="">ทุกสถานะ</option>
                {ORDER_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {getOrderStatusLabel(status)}
                  </option>
                ))}
              </SelectField>
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
                    !draftCustomerId.trim() &&
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

        {inlineError ? (
          <Notice tone="danger" role="alert" title="โหลดรายการไม่สำเร็จ">
            {inlineError}
          </Notice>
        ) : null}

        <section className={styles.section} aria-labelledby="orders-list">
          <div className={styles.sectionHeading}>
            <div>
              <h2 className={styles.sectionTitle} id="orders-list">
                รายการคำสั่งซื้อ
              </h2>
              <p className={styles.sectionDescription}>
                สถานะและยอดรวมในแต่ละรายการเป็นข้อมูลล่าสุดที่โหลดจากระบบ
              </p>
            </div>
            <span className={styles.sectionMeta}>
              {state.orders.length.toLocaleString("th-TH")} รายการ
            </span>
          </div>

          {state.orders.length === 0 ? (
            <EmptyState
              title="ไม่พบคำสั่งซื้อ"
              description={
                hasFilters
                  ? "ไม่มีคำสั่งซื้อที่ตรงกับตัวกรองปัจจุบัน"
                  : "หน่วยงานนี้ยังไม่มีคำสั่งซื้อ"
              }
            />
          ) : (
            <div className={styles.list}>
              {state.orders.map((order) => (
                <article
                  className={styles.row}
                  data-attention={order.status === "PAYMENT_REVIEW" || undefined}
                  key={order.orderId}
                >
                  <div className={styles.rowMain}>
                    <div className={styles.rowHeading}>
                      <h3 className={styles.cardTitle}>
                        Order {order.orderId}
                      </h3>
                      <OrderStatusBadge status={order.status} />
                    </div>
                    <div className={styles.metaRow}>
                      <span className={styles.meta}>
                        Customer: {order.customerId}
                      </span>
                      <span className={styles.meta}>
                        Campaign: {order.campaignId}
                      </span>
                      <span className={styles.meta}>
                        สร้างเมื่อ {formatIsoDateTime(order.createdAt)}
                      </span>
                    </div>
                  </div>

                  <div className={styles.rowAside}>
                    <span className={styles.total}>
                      {formatSatang(order.total)}
                    </span>
                    <a
                      className={styles.detailLink}
                      href={organizationOrderHref(
                        organizationId,
                        order.orderId,
                      )}
                    >
                      ดูรายละเอียด
                    </a>
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
      </main>
    </div>
  );
}
