"use client";

import { useEffect, useState, type FormEvent } from "react";

import {
  Badge,
  Button,
  ConfirmDialog,
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
import {
  orderService,
  OrderStatusBadge,
} from "@/modules/orders";
import { ApiClientError } from "@/services";
import {
  PICKUP_STATUSES,
  type Cursor,
  type OrderDTO,
  type PickupDTO,
  type PickupStatus,
} from "@/types";
import { formatIsoDateTime, formatSatang } from "@/utils";
import {
  canConfirmPickup,
  getPickupStatusLabel,
} from "./pickup-helpers";
import { pickupService } from "./pickup-service";
import styles from "./organization-pickups.module.css";

interface AppliedFilters {
  campaignId: string;
  status: PickupStatus | "";
  token: string;
  orderId: string;
}

type PickupListState =
  | { status: "loading" }
  | { status: "unauthorized" }
  | { status: "forbidden" }
  | { status: "error" }
  | {
      status: "success";
      pickups: PickupDTO[];
      nextCursor: Cursor | null;
    };

interface SelectedPickupState {
  pickup: PickupDTO;
  order: OrderDTO;
}

const EMPTY_FILTERS: AppliedFilters = {
  campaignId: "",
  status: "",
  token: "",
  orderId: "",
};

function pickupTone(
  status: PickupStatus,
): "success" | "neutral" {
  return status === "READY" ? "success" : "neutral";
}

function operationErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.code === "PICKUP_NOT_FOUND") {
      return "ไม่พบรายการรับสินค้านี้แล้ว กรุณาค้นหาใหม่";
    }

    if (error.code === "PICKUP_ALREADY_RECEIVED") {
      return "รายการรับสินค้านี้ถูกยืนยันไปแล้ว ระบบจะโหลดสถานะล่าสุดมาให้";
    }

    if (error.code === "ORDER_NOT_READY_FOR_PICKUP") {
      return "คำสั่งซื้อนี้ไม่อยู่ในสถานะพร้อมรับสินค้าแล้ว";
    }

    return error.userMessage;
  }

  return "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง";
}

export function OrganizationPickupsView({
  organizationId,
}: {
  organizationId: string;
}) {
  const [state, setState] = useState<PickupListState>({
    status: "loading",
  });

  const [draftCampaignId, setDraftCampaignId] = useState("");
  const [draftStatus, setDraftStatus] =
    useState<PickupStatus | "">("");
  const [draftToken, setDraftToken] = useState("");
  const [draftOrderId, setDraftOrderId] = useState("");
  const [appliedFilters, setAppliedFilters] =
    useState<AppliedFilters>(EMPTY_FILTERS);

  const [filtering, setFiltering] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [detailLoadingId, setDetailLoadingId] =
    useState<string | null>(null);
  const [selected, setSelected] =
    useState<SelectedPickupState | null>(null);
  const [confirmPending, setConfirmPending] = useState(false);

  const [inlineError, setInlineError] = useState<string | null>(
    null,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [listFeedback, setListFeedback] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadPickups() {
      try {
        const result =
          await pickupService.listOrganizationPickups(
            organizationId,
            { signal: controller.signal },
          );

        if (!controller.signal.aborted) {
          setState({
            status: "success",
            pickups: result.items,
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

    void loadPickups();

    return () => controller.abort();
  }, [organizationId]);

  function updatePickupInList(pickup: PickupDTO) {
    setState((current) =>
      current.status === "success"
        ? {
            ...current,
            pickups: current.pickups.map((item) =>
              item.pickupId === pickup.pickupId
                ? pickup
                : item,
            ),
          }
        : current,
    );
  }

  async function refreshSelected(
    pickupId: string,
    orderId: string,
  ) {
    const [pickup, order] = await Promise.all([
      pickupService.getOrganizationPickup(
        organizationId,
        pickupId,
      ),
      orderService.getOrganizationOrder(
        organizationId,
        orderId,
      ),
    ]);

    setSelected({ pickup, order });
    updatePickupInList(pickup);
    return { pickup, order };
  }

  async function applyFilters(
    event?: FormEvent<HTMLFormElement>,
  ) {
    event?.preventDefault();

    if (filtering) {
      return;
    }

    const nextFilters: AppliedFilters = {
      campaignId: draftCampaignId.trim(),
      status: draftStatus,
      token: draftToken.trim(),
      orderId: draftOrderId.trim(),
    };

    setFiltering(true);
    setInlineError(null);
    setNotice(null);

    try {
      const result =
        await pickupService.listOrganizationPickups(
          organizationId,
          {
            campaignId: nextFilters.campaignId || null,
            status: nextFilters.status || null,
            token: nextFilters.token || null,
            orderId: nextFilters.orderId || null,
          },
        );

      setAppliedFilters(nextFilters);
      setSelected(null);
      setState({
        status: "success",
        pickups: result.items,
        nextCursor: result.nextCursor,
      });
      setListFeedback(
        `แสดง ${result.items.length.toLocaleString("th-TH")} รายการรับสินค้า${nextFilters.status ? ` · ${getPickupStatusLabel(nextFilters.status)}` : ""}`,
      );
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

    setDraftCampaignId("");
    setDraftStatus("");
    setDraftToken("");
    setDraftOrderId("");
    setFiltering(true);
    setInlineError(null);
    setNotice(null);

    try {
      const result =
        await pickupService.listOrganizationPickups(
          organizationId,
        );

      setAppliedFilters(EMPTY_FILTERS);
      setSelected(null);
      setState({
        status: "success",
        pickups: result.items,
        nextCursor: result.nextCursor,
      });
      setListFeedback(
        `แสดงรายการรับสินค้าทั้งหมดที่โหลด ${result.items.length.toLocaleString("th-TH")} รายการ`,
      );
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
        await pickupService.listOrganizationPickups(
          organizationId,
          {
            campaignId: appliedFilters.campaignId || null,
            status: appliedFilters.status || null,
            token: appliedFilters.token || null,
            orderId: appliedFilters.orderId || null,
            cursor: state.nextCursor,
          },
        );

      const nextPickups = [...state.pickups, ...result.items];

      setState({
        status: "success",
        pickups: nextPickups,
        nextCursor: result.nextCursor,
      });
      setListFeedback(
        `โหลดเพิ่มเติมแล้ว ตอนนี้แสดง ${nextPickups.length.toLocaleString("th-TH")} รายการรับสินค้า`,
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

  async function selectPickup(pickup: PickupDTO) {
    if (detailLoadingId || confirmPending) {
      return;
    }

    setDetailLoadingId(pickup.pickupId);
    setInlineError(null);
    setNotice(null);

    try {
      const [freshPickup, order] = await Promise.all([
        pickupService.getOrganizationPickup(
          organizationId,
          pickup.pickupId,
        ),
        orderService.getOrganizationOrder(
          organizationId,
          pickup.orderId,
        ),
      ]);

      setSelected({
        pickup: freshPickup,
        order,
      });
      updatePickupInList(freshPickup);
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

  async function handleConfirm() {
    if (
      !selected ||
      !canConfirmPickup(selected.pickup.status) ||
      confirmPending
    ) {
      return;
    }

    setConfirmPending(true);
    setInlineError(null);
    setNotice(null);

    try {
      const confirmed =
        await pickupService.confirmOrganizationPickup(
          organizationId,
          selected.pickup.pickupId,
        );

      updatePickupInList(confirmed);

      await refreshSelected(
        confirmed.pickupId,
        confirmed.orderId,
      );

      setNotice("ยืนยันการรับสินค้าเรียบร้อยแล้ว");
    } catch (error) {
      if (isDefinitiveSessionFailure(error)) {
        authSession.logout();
        return;
      }

      if (
        error instanceof ApiClientError &&
        error.code === "PICKUP_ALREADY_RECEIVED"
      ) {
        setInlineError(
          "รายการรับสินค้านี้ถูกยืนยันไปแล้ว ระบบได้โหลดสถานะล่าสุดมาให้",
        );

        try {
          await refreshSelected(
            selected.pickup.pickupId,
            selected.pickup.orderId,
          );
        } catch {
          // Keep duplicate-received state visible with last known data.
        }
      } else {
        setInlineError(operationErrorMessage(error));

        if (
          error instanceof ApiClientError &&
          error.kind === "conflict"
        ) {
          try {
            await refreshSelected(
              selected.pickup.pickupId,
              selected.pickup.orderId,
            );
          } catch {
            // Preserve original conflict message.
          }
        }
      }
    } finally {
      setConfirmPending(false);
    }
  }

  if (state.status !== "success") {
    return (
      <div className={styles.page}>
        <main className={styles.stateWrap}>
          {state.status === "loading" ? (
            <LoadingState title="กำลังโหลดรายการรับสินค้า" />
          ) : null}
          {state.status === "unauthorized" ? (
            <UnauthorizedState />
          ) : null}
          {state.status === "forbidden" ? (
            <ForbiddenState />
          ) : null}
          {state.status === "error" ? (
            <ErrorState
              title="ไม่สามารถโหลดรายการรับสินค้าได้"
              description="กรุณาลองโหลดหน้านี้ใหม่อีกครั้ง"
            />
          ) : null}
        </main>
      </div>
    );
  }

  const hasFilters =
    Boolean(appliedFilters.campaignId) ||
    Boolean(appliedFilters.status) ||
    Boolean(appliedFilters.token) ||
    Boolean(appliedFilters.orderId);
  const hasDraftFilters =
    Boolean(draftCampaignId.trim()) ||
    Boolean(draftStatus) ||
    Boolean(draftToken.trim()) ||
    Boolean(draftOrderId.trim());
  const readyCount = state.pickups.filter(
    (pickup) => pickup.status === "READY",
  ).length;
  const receivedCount = state.pickups.filter(
    (pickup) => pickup.status === "RECEIVED",
  ).length;

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.header}>
          <div className={styles.headerCopy}>
            <h1 className={styles.title}>จุดรับสินค้า</h1>
            <p className={styles.description}>
              ค้นหาด้วย Token หรือ Order ID ตรวจข้อมูลที่เกี่ยวข้อง แล้วจึงยืนยันการรับสินค้า
            </p>
          </div>
        </header>

        <section
          className={styles.summaryStrip}
          aria-label="สรุปรายการรับสินค้าที่โหลด"
        >
          <div>
            <span className={styles.summaryLabel}>รายการที่โหลด</span>
            <strong>{state.pickups.length}</strong>
          </div>
          <div>
            <span className={styles.summaryLabel}>พร้อมรับสินค้า</span>
            <strong>{readyCount}</strong>
          </div>
          <div>
            <span className={styles.summaryLabel}>รับสินค้าแล้ว</span>
            <strong>{receivedCount}</strong>
          </div>
        </section>

        <section
          className={styles.filterPanel}
          aria-labelledby="pickup-filter-title"
        >
          <div className={styles.filterHeading}>
            <div>
              <h2 className={styles.sectionTitle} id="pickup-filter-title">
                ค้นหารายการรับสินค้า
              </h2>
              <p className={styles.sectionDescription}>
                Token และ Order ID เหมาะสำหรับค้นหารายการเฉพาะ ส่วนแคมเปญและสถานะใช้จำกัดคิว
              </p>
            </div>

            <div
              className={styles.appliedFilters}
              role="group"
              aria-label="ตัวกรองที่ใช้อยู่"
            >
              {hasFilters ? (
                <>
                  {appliedFilters.token ? (
                    <span>Token: {appliedFilters.token}</span>
                  ) : null}
                  {appliedFilters.orderId ? (
                    <span>Order: {appliedFilters.orderId}</span>
                  ) : null}
                  {appliedFilters.campaignId ? (
                    <span>Campaign: {appliedFilters.campaignId}</span>
                  ) : null}
                  {appliedFilters.status ? (
                    <span>
                      สถานะ: {getPickupStatusLabel(appliedFilters.status)}
                    </span>
                  ) : null}
                </>
              ) : (
                <span>แสดงทุกรายการ</span>
              )}
            </div>
          </div>

          <form
            className={styles.filterForm}
            onSubmit={applyFilters}
            aria-busy={filtering}
          >
            <div className={styles.filters}>
              <TextField
                id="pickup-token-filter"
                label="Pickup token"
                value={draftToken}
                onChange={(event) =>
                  setDraftToken(event.target.value)
                }
                placeholder="Token ที่ลูกค้าแสดง"
                disabled={filtering}
              />

              <TextField
                id="pickup-order-filter"
                label="Order ID"
                value={draftOrderId}
                onChange={(event) =>
                  setDraftOrderId(event.target.value)
                }
                placeholder="เช่น order-..."
                disabled={filtering}
              />

              <TextField
                id="pickup-campaign-filter"
                label="Campaign ID"
                value={draftCampaignId}
                onChange={(event) =>
                  setDraftCampaignId(event.target.value)
                }
                placeholder="เช่น campaign-..."
                disabled={filtering}
              />

              <SelectField
                id="pickup-status-filter"
                label="สถานะ Pickup"
                value={draftStatus}
                onChange={(event) =>
                  setDraftStatus(
                    event.target.value as PickupStatus | "",
                  )
                }
                disabled={filtering}
              >
                <option value="">ทุกสถานะ</option>
                {PICKUP_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {getPickupStatusLabel(status)}
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
                  filtering || (!hasFilters && !hasDraftFilters)
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

        {listFeedback ? (
          <p
            className={styles.listFeedback}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {listFeedback}
          </p>
        ) : null}

        {inlineError ? (
          <Notice tone="danger" role="alert" title="ดำเนินการไม่สำเร็จ">
            {inlineError}
          </Notice>
        ) : null}

        {notice ? (
          <Notice tone="success" role="status" title="อัปเดตแล้ว">
            {notice}
          </Notice>
        ) : null}

        <div className={styles.layout}>
          <section
            className={styles.section}
            aria-labelledby="pickup-list"
          >
            <div className={styles.sectionHeading}>
              <div>
                <h2 className={styles.sectionTitle} id="pickup-list">
                  คิวรับสินค้า
                </h2>
                <p className={styles.sectionDescription}>
                  เลือกรายการเพื่อโหลด Pickup และ Order ล่าสุดก่อนยืนยัน
                </p>
              </div>
              <span className={styles.sectionMeta}>
                {state.pickups.length.toLocaleString("th-TH")} รายการ
              </span>
            </div>

            {state.pickups.length === 0 ? (
              <EmptyState
                title="ไม่พบ Pickup"
                description={
                  hasFilters
                    ? "ไม่มีรายการรับสินค้าที่ตรงกับตัวกรองปัจจุบัน"
                    : "หน่วยงานนี้ยังไม่มีรายการรับสินค้าที่พร้อมดำเนินการ"
                }
              />
            ) : (
              <div className={styles.list}>
                {state.pickups.map((pickup) => {
                  const isSelected =
                    selected?.pickup.pickupId === pickup.pickupId;

                  return (
                    <article
                      className={[
                        styles.row,
                        isSelected ? styles.rowSelected : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      data-attention={pickup.status === "READY" || undefined}
                      key={pickup.pickupId}
                      aria-current={isSelected ? "true" : undefined}
                      aria-label={`Pickup ${pickup.pickupId} · ${getPickupStatusLabel(pickup.status)}`}
                    >
                      <div className={styles.rowMain}>
                        <div className={styles.rowHeading}>
                          <h3 className={styles.cardTitle}>
                            Pickup {pickup.pickupId}
                          </h3>
                          <Badge tone={pickupTone(pickup.status)}>
                            {getPickupStatusLabel(pickup.status)}
                          </Badge>
                        </div>

                        <div className={styles.metaRow}>
                          <span className={styles.token}>
                            {pickup.token}
                          </span>
                          <span className={styles.meta}>
                            Order: {pickup.orderId}
                          </span>
                          <time className={styles.meta} dateTime={pickup.updatedAt}>
                            อัปเดต {formatIsoDateTime(pickup.updatedAt)}
                          </time>
                        </div>

                        {pickup.status === "READY" ? (
                          <div className={styles.queuePriority} role="note">
                            <span className={styles.queuePriorityLabel}>
                              พร้อมดำเนินการ
                            </span>
                            <strong>ตรวจ Token และยืนยันการรับสินค้า</strong>
                          </div>
                        ) : null}
                      </div>

                      <div className={styles.cardActions}>
                        <Button
                          variant="secondary"
                          aria-label={`${isSelected ? "กำลังดู" : "ดูรายละเอียด"} Pickup ${pickup.pickupId}`}
                          pending={
                            detailLoadingId === pickup.pickupId
                          }
                          pendingLabel="กำลังโหลด"
                          disabled={confirmPending}
                          onClick={() => {
                            void selectPickup(pickup);
                          }}
                        >
                          {isSelected ? "กำลังดูรายการนี้" : "ดูรายละเอียด"}
                        </Button>
                      </div>
                    </article>
                  );
                })}
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

          <aside aria-label="รายละเอียด Pickup">
            {selected ? (
              <div className={styles.detailPanel}>
                <div className={styles.detailHeader}>
                  <div className={styles.detailCopy}>
                    <span className={styles.detailLabel}>
                      รายการที่กำลังตรวจสอบ
                    </span>
                    <h2 className={styles.detailTitle}>
                      Pickup {selected.pickup.pickupId}
                    </h2>
                  </div>

                  <Badge
                    tone={pickupTone(selected.pickup.status)}
                  >
                    {getPickupStatusLabel(
                      selected.pickup.status,
                    )}
                  </Badge>
                </div>

                <div className={styles.tokenPanel}>
                  <span className={styles.tokenLabel}>Pickup token</span>
                  <strong className={styles.tokenValue}>
                    {selected.pickup.token}
                  </strong>
                  <span className={styles.tokenHint}>
                    ตรวจให้ตรงกับ Token หรือ QR ที่ผู้รับแสดงก่อนยืนยัน
                  </span>
                </div>

                <section
                  className={styles.verificationGuide}
                  aria-label="ลำดับตรวจสอบก่อนยืนยันรับสินค้า"
                >
                  <div className={styles.verificationStep}>
                    <span className={styles.verificationIndex} aria-hidden="true">1</span>
                    <div>
                      <strong>เทียบ Token หรือ QR</strong>
                      <span>ตรวจให้ตรงกับข้อมูล Pickup ที่ระบบโหลดล่าสุด</span>
                    </div>
                  </div>
                  <div className={styles.verificationStep}>
                    <span className={styles.verificationIndex} aria-hidden="true">2</span>
                    <div>
                      <strong>ตรวจ Order ที่เกี่ยวข้อง</strong>
                      <span>ตรวจผู้รับ แคมเปญ ยอดรวม และสถานะคำสั่งซื้อ</span>
                    </div>
                  </div>
                  <div className={styles.verificationStep}>
                    <span className={styles.verificationIndex} aria-hidden="true">3</span>
                    <div>
                      <strong>
                        {selected.pickup.status === "READY"
                          ? "ยืนยันเมื่อส่งมอบจริง"
                          : "ยืนยันแล้ว"}
                      </strong>
                      <span>
                        {selected.pickup.status === "READY"
                          ? "ใช้ action ยืนยันหลังตรวจข้อมูลและส่งมอบสินค้าแล้ว"
                          : "รายการนี้ไม่มี action ยืนยันซ้ำ"}
                      </span>
                    </div>
                  </div>
                </section>

                <section
                  className={styles.orderPanel}
                  aria-labelledby="pickup-order-title"
                >
                  <div className={styles.orderHeader}>
                    <div>
                      <h3
                        className={styles.sectionTitle}
                        id="pickup-order-title"
                      >
                        Order ที่เกี่ยวข้อง
                      </h3>
                      <span className={styles.meta}>
                        {selected.order.orderId}
                      </span>
                    </div>
                    <OrderStatusBadge
                      status={selected.order.status}
                    />
                  </div>

                  <dl className={styles.orderSummary}>
                    <div>
                      <dt className={styles.metaLabel}>ลูกค้า</dt>
                      <dd>{selected.order.customerId}</dd>
                    </div>
                    <div>
                      <dt className={styles.metaLabel}>แคมเปญ</dt>
                      <dd>{selected.order.campaignId}</dd>
                    </div>
                    <div>
                      <dt className={styles.metaLabel}>ยอดรวม</dt>
                      <dd data-numeric>{formatSatang(selected.order.total)}</dd>
                    </div>
                  </dl>
                </section>

                <dl className={styles.metaGrid}>
                  <div className={styles.metaItem}>
                    <dt className={styles.metaLabel}>อัปเดต Pickup</dt>
                    <dd className={styles.metaValue}>
                      <time dateTime={selected.pickup.updatedAt}>
                        {formatIsoDateTime(selected.pickup.updatedAt)}
                      </time>
                    </dd>
                  </div>
                  <div className={styles.metaItem}>
                    <dt className={styles.metaLabel}>รับโดย User ID</dt>
                    <dd className={styles.metaValue}>
                      {selected.pickup.receivedBy ??
                        "ยังไม่ได้รับสินค้า"}
                    </dd>
                  </div>
                  <div className={styles.metaItem}>
                    <dt className={styles.metaLabel}>เวลารับสินค้า</dt>
                    <dd className={styles.metaValue}>
                      {selected.pickup.receivedAt ? (
                        <time dateTime={selected.pickup.receivedAt}>
                          {formatIsoDateTime(selected.pickup.receivedAt)}
                        </time>
                      ) : (
                        "ยังไม่ได้รับสินค้า"
                      )}
                    </dd>
                  </div>
                </dl>

                {selected.pickup.status === "RECEIVED" ? (
                  <Notice tone="success" title="รับสินค้าแล้ว">
                    Pickup นี้รับสินค้าเรียบร้อยแล้ว
                    {selected.pickup.receivedAt
                      ? " เมื่อ " +
                        formatIsoDateTime(
                          selected.pickup.receivedAt,
                        )
                      : ""}
                  </Notice>
                ) : (
                  <Notice
                    tone="warning"
                    title="ตรวจสอบก่อนยืนยัน"
                  >
                    ยืนยันเฉพาะเมื่อ Token และ Order ตรงกับผู้มารับสินค้า และสินค้าถูกส่งมอบจริงแล้ว
                  </Notice>
                )}

                <div className={styles.detailActions}>
                  {canConfirmPickup(
                    selected.pickup.status,
                  ) ? (
                    <ConfirmDialog
                      trigger={
                        <Button disabled={confirmPending}>
                          ยืนยันรับสินค้า
                        </Button>
                      }
                      title="ยืนยันการรับสินค้า"
                      description="หลังยืนยัน รายการรับสินค้าและคำสั่งซื้อจะเปลี่ยนเป็นรับสินค้าแล้ว และไม่ควรยืนยันซ้ำ"
                      confirmLabel="ยืนยันรับสินค้า"
                      pending={confirmPending}
                      onConfirm={() => {
                        void handleConfirm();
                      }}
                    />
                  ) : null}
                </div>
              </div>
            ) : (
              <div className={styles.emptyDetail}>
                <strong>เลือก Pickup เพื่อเริ่มตรวจสอบ</strong>
                <span>
                  ระบบจะโหลด Pickup และ Order ล่าสุดก่อนเปิด action ยืนยันรับสินค้า
                </span>
              </div>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
