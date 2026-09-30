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
import { formatIsoDateTime } from "@/utils";

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
      return "ไม่พบข้อมูล Pickup นี้แล้ว กรุณารีเฟรชรายการ";
    }

    if (error.code === "PICKUP_ALREADY_RECEIVED") {
      return "Pickup นี้ถูกรับสินค้าไปแล้ว ระบบจะโหลดสถานะล่าสุดจาก Backend";
    }

    if (error.code === "ORDER_NOT_READY_FOR_PICKUP") {
      return "Order นี้ไม่อยู่ในสถานะพร้อมรับสินค้าแล้ว";
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

      setState({
        status: "success",
        pickups: [...state.pickups, ...result.items],
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
          "Pickup นี้ถูกรับสินค้าไปแล้ว ระบบได้โหลดสถานะล่าสุดจาก Backend",
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

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.header}>
          <div className={styles.headerCopy} data-ledger-heading>
            <span className={styles.eyebrow}>
              Pickup operations
            </span>
            <h1 className={styles.title}>รับสินค้า</h1>
            <p className={styles.description}>
              Staff และ Organization Admin สามารถค้นหา Pickup
              ด้วย token หรือ Order ID ตรวจรายละเอียด และยืนยันการรับสินค้า
              โดย Backend เป็นผู้ตัดสินสถานะและป้องกันการยืนยันซ้ำ
            </p>
          </div>

          <Badge tone="info">
            {state.pickups.length} รายการในหน้าปัจจุบัน
          </Badge>
        </header>

        <form
          className={styles.filterPanel}
          onSubmit={applyFilters}
        >
          <div className={styles.filters}>
            <TextField
              id="pickup-token-filter"
              label="Pickup token"
              value={draftToken}
              onChange={(event) =>
                setDraftToken(event.target.value)
              }
              placeholder="ค้นหาด้วย token"
              disabled={filtering}
            />

            <TextField
              id="pickup-order-filter"
              label="Order ID"
              value={draftOrderId}
              onChange={(event) =>
                setDraftOrderId(event.target.value)
              }
              placeholder="ค้นหาด้วย Order ID"
              disabled={filtering}
            />

            <TextField
              id="pickup-campaign-filter"
              label="Campaign ID"
              value={draftCampaignId}
              onChange={(event) =>
                setDraftCampaignId(event.target.value)
              }
              placeholder="กรองด้วย Campaign ID"
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
          <div className={styles.errorBox} role="alert">
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
            aria-labelledby="pickup-list"
          >
            <h2 className={styles.sectionTitle} id="pickup-list">
              รายการ Pickup
            </h2>

            {state.pickups.length === 0 ? (
              <EmptyState
                title="ไม่พบ Pickup"
                description={
                  hasFilters
                    ? "ไม่มี Pickup ที่ตรงกับตัวกรองปัจจุบัน"
                    : "หน่วยงานนี้ยังไม่มี Pickup ที่พร้อมดำเนินการ"
                }
              />
            ) : (
              <div className={styles.list}>
                {state.pickups.map((pickup) => (
                  <article
                    className={styles.card}
                    key={pickup.pickupId}
                  >
                    <div className={styles.cardCopy}>
                      <h3 className={styles.cardTitle}>
                        Pickup {pickup.pickupId}
                      </h3>

                      <div className={styles.metaGrid}>
                        <div className={styles.metaItem}>
                          <span className={styles.metaLabel}>
                            Order ID
                          </span>
                          <span className={styles.metaValue}>
                            {pickup.orderId}
                          </span>
                        </div>

                        <div className={styles.metaItem}>
                          <span className={styles.metaLabel}>
                            Pickup token
                          </span>
                          <span className={styles.token}>
                            {pickup.token}
                          </span>
                        </div>

                        <div className={styles.metaItem}>
                          <span className={styles.metaLabel}>
                            สร้างเมื่อ
                          </span>
                          <span className={styles.metaValue}>
                            {formatIsoDateTime(pickup.createdAt)}
                          </span>
                        </div>

                        <div className={styles.metaItem}>
                          <span className={styles.metaLabel}>
                            อัปเดตล่าสุด
                          </span>
                          <span className={styles.metaValue}>
                            {formatIsoDateTime(pickup.updatedAt)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className={styles.cardAside}>
                      <Badge tone={pickupTone(pickup.status)}>
                        {getPickupStatusLabel(pickup.status)}
                      </Badge>

                      <div className={styles.cardActions}>
                        <Button
                          variant="secondary"
                          pending={
                            detailLoadingId === pickup.pickupId
                          }
                          pendingLabel="กำลังโหลด"
                          disabled={confirmPending}
                          onClick={() => {
                            void selectPickup(pickup);
                          }}
                        >
                          ดูรายละเอียด
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

          <aside aria-label="รายละเอียด Pickup">
            {selected ? (
              <div className={styles.detailPanel}>
                <div className={styles.detailHeader}>
                  <div className={styles.detailCopy}>
                    <span className={styles.eyebrow}>
                      Pickup detail
                    </span>
                    <h2 className={styles.detailTitle}>
                      {selected.pickup.pickupId}
                    </h2>
                    <span className={styles.token}>
                      {selected.pickup.token}
                    </span>
                  </div>

                  <Badge
                    tone={pickupTone(selected.pickup.status)}
                  >
                    {getPickupStatusLabel(
                      selected.pickup.status,
                    )}
                  </Badge>
                </div>

                <div className={styles.metaGrid}>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>
                      Order ID
                    </span>
                    <span className={styles.metaValue}>
                      {selected.pickup.orderId}
                    </span>
                  </div>

                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>
                      อัปเดต Pickup
                    </span>
                    <span className={styles.metaValue}>
                      {formatIsoDateTime(
                        selected.pickup.updatedAt,
                      )}
                    </span>
                  </div>

                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>
                      รับโดย User ID
                    </span>
                    <span className={styles.metaValue}>
                      {selected.pickup.receivedBy ??
                        "ยังไม่ได้รับสินค้า"}
                    </span>
                  </div>

                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>
                      เวลารับสินค้า
                    </span>
                    <span className={styles.metaValue}>
                      {formatIsoDateTime(
                        selected.pickup.receivedAt,
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
                        Customer ID
                      </span>
                      <span className={styles.metaValue}>
                        {selected.order.customerId}
                      </span>
                    </div>

                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>
                        Campaign ID
                      </span>
                      <span className={styles.metaValue}>
                        {selected.order.campaignId}
                      </span>
                    </div>
                  </div>
                </div>

                {selected.pickup.status === "RECEIVED" ? (
                  <div className={styles.receivedBox} role="status">
                    Pickup นี้รับสินค้าเรียบร้อยแล้ว
                    {selected.pickup.receivedAt
                      ? " เมื่อ " +
                        formatIsoDateTime(
                          selected.pickup.receivedAt,
                        )
                      : ""}
                  </div>
                ) : (
                  <div className={styles.infoBox}>
                    ตรวจสอบ Pickup token และ Order
                    ให้ตรงกับผู้มารับสินค้าก่อนยืนยัน
                  </div>
                )}

                <div className={styles.detailActions}>
                  {canConfirmPickup(
                    selected.pickup.status,
                  ) ? (
                    <ConfirmDialog
                      trigger={
                        <Button
                          disabled={confirmPending}
                        >
                          ยืนยันรับสินค้า
                        </Button>
                      }
                      title="ยืนยันการรับสินค้า"
                      description="Backend จะตรวจว่า Pickup และ Order ยังอยู่ในสถานะพร้อมรับสินค้า ก่อนเปลี่ยนทั้ง Pickup และ Order เป็น RECEIVED"
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
                เลือก Pickup จากรายการเพื่อดูรายละเอียด Order
                และยืนยันการรับสินค้า
              </div>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
