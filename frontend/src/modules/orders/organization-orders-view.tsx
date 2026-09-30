"use client";

import { useEffect, useState, type FormEvent } from "react";

import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  ForbiddenState,
  LoadingState,
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

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.header}>
          <div className={styles.headerCopy} data-ledger-heading>
            <span className={styles.eyebrow}>Organization orders</span>
            <h1 className={styles.title}>คำสั่งซื้อของหน่วยงาน</h1>
            <p className={styles.description}>
              Staff และ Organization Admin สามารถค้นหาและดู Order
              ภายในหน่วยงานได้ โดยใช้เฉพาะตัวกรองที่ Backend รองรับ:
              Campaign, Customer ID และสถานะ
            </p>
          </div>

          <Badge tone="info">
            {state.orders.length} รายการในหน้าปัจจุบัน
          </Badge>
        </header>

        <form className={styles.filterPanel} onSubmit={applyFilters}>
          <div className={styles.filters}>
            <TextField
              id="organization-orders-campaign"
              label="Campaign ID"
              value={draftCampaignId}
              onChange={(event) =>
                setDraftCampaignId(event.target.value)
              }
              placeholder="กรองด้วย Campaign ID"
              disabled={filtering}
            />

            <TextField
              id="organization-orders-customer"
              label="Customer ID"
              value={draftCustomerId}
              onChange={(event) =>
                setDraftCustomerId(event.target.value)
              }
              placeholder="กรองด้วย Customer ID"
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

        <section className={styles.section} aria-labelledby="orders-list">
          <h2 className={styles.sectionTitle} id="orders-list">
            รายการ Order
          </h2>

          {state.orders.length === 0 ? (
            <EmptyState
              title="ไม่พบคำสั่งซื้อ"
              description={
                hasFilters
                  ? "ไม่มี Order ที่ตรงกับตัวกรองปัจจุบัน"
                  : "หน่วยงานนี้ยังไม่มี Order"
              }
            />
          ) : (
            <div className={styles.list}>
              {state.orders.map((order) => (
                <article className={styles.card} key={order.orderId}>
                  <div className={styles.cardCopy}>
                    <h3 className={styles.cardTitle}>
                      Order {order.orderId}
                    </h3>
                    <div className={styles.metaGrid}>
                      <div className={styles.metaItem}>
                        <span className={styles.metaLabel}>
                          Customer ID
                        </span>
                        <span className={styles.metaValue}>
                          {order.customerId}
                        </span>
                      </div>
                      <div className={styles.metaItem}>
                        <span className={styles.metaLabel}>
                          Campaign ID
                        </span>
                        <span className={styles.metaValue}>
                          {order.campaignId}
                        </span>
                      </div>
                      <div className={styles.metaItem}>
                        <span className={styles.metaLabel}>
                          สร้างเมื่อ
                        </span>
                        <span className={styles.metaValue}>
                          {formatIsoDateTime(order.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.cardAside}>
                    <OrderStatusBadge status={order.status} />
                    <span className={styles.total}>
                      {formatSatang(order.total)}
                    </span>
                    <div className={styles.cardActions}>
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
      </main>
    </div>
  );
}
