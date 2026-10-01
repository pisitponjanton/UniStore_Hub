"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  Notice,
  SelectField,
  TextField,
} from "@/components";
import {
  authSession,
  isDefinitiveSessionFailure,
} from "@/modules/auth";
import { storeService } from "@/modules/stores";
import { ApiClientError } from "@/services";
import {
  CAMPAIGN_STATUSES,
  type CampaignDTO,
  type CampaignStatus,
  type Cursor,
  type StoreDTO,
} from "@/types";
import { formatIsoDateTime } from "@/utils";

import { CampaignLifecycleActions } from "./campaign-lifecycle-actions";
import {
  campaignStatusLabel,
  campaignToFormValues,
  type CampaignFormErrors,
  type CampaignFormValues,
  validateCampaignForm,
} from "./campaign-helpers";
import { campaignService } from "./campaign-service";
import styles from "./campaign-view.module.css";

type CampaignState =
  | { status: "loading" }
  | { status: "error" }
  | {
      status: "success";
      campaigns: CampaignDTO[];
      stores: StoreDTO[];
      nextCursor: Cursor | null;
    };

const EMPTY_FORM: CampaignFormValues = {
  storeId: "",
  name: "",
  openAt: "",
  closeAt: "",
  paymentDeadline: "",
  pickupAt: "",
};

function statusTone(
  status: CampaignStatus,
): "neutral" | "info" | "warning" | "success" | "danger" {
  switch (status) {
    case "DRAFT":
      return "neutral";
    case "OPEN":
      return "info";
    case "CLOSED":
    case "PRODUCING":
      return "warning";
    case "READY_FOR_PICKUP":
    case "COMPLETED":
      return "success";
    case "CANCELLED":
      return "danger";
  }
}

function operationErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.code === "CAMPAIGN_NOT_FOUND") {
      return "ไม่พบแคมเปญนี้แล้ว กรุณารีเฟรชรายการ";
    }

    if (error.code === "STORE_NOT_FOUND") {
      return "ไม่พบร้านค้าที่เลือกแล้ว กรุณารีเฟรชข้อมูลร้านค้า";
    }

    if (error.code === "INVALID_STATUS_TRANSITION") {
      return "แคมเปญนี้ไม่ได้อยู่ในสถานะฉบับร่างแล้ว จึงไม่สามารถแก้ไขข้อมูลได้";
    }

    return error.userMessage;
  }

  return "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง";
}

function DateField({
  id,
  label,
  value,
  error,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <TextField
      id={id}
      type="datetime-local"
      label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      error={error}
      disabled={disabled}
    />
  );
}

function scheduleValue(value: string | null): string {
  return value ? formatIsoDateTime(value) : "ยังไม่กำหนด";
}

function formChanged(
  values: CampaignFormValues,
  campaign: CampaignDTO,
): boolean {
  const original = campaignToFormValues(campaign);

  return (
    values.storeId !== original.storeId ||
    values.name !== original.name ||
    values.openAt !== original.openAt ||
    values.closeAt !== original.closeAt ||
    values.paymentDeadline !== original.paymentDeadline ||
    values.pickupAt !== original.pickupAt
  );
}

export function CampaignManagementView({
  organizationId,
}: {
  organizationId: string;
}) {
  const [state, setState] = useState<CampaignState>({
    status: "loading",
  });

  const [filterStoreId, setFilterStoreId] = useState("");
  const [filterStatus, setFilterStatus] = useState<
    CampaignStatus | ""
  >("");
  const [listLoading, setListLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [createValues, setCreateValues] =
    useState<CampaignFormValues>(EMPTY_FORM);
  const [createErrors, setCreateErrors] =
    useState<CampaignFormErrors>({});
  const [creating, setCreating] = useState(false);

  const [selectedCampaign, setSelectedCampaign] =
    useState<CampaignDTO | null>(null);
  const [editValues, setEditValues] =
    useState<CampaignFormValues>(EMPTY_FORM);
  const [editErrors, setEditErrors] =
    useState<CampaignFormErrors>({});
  const [loadingCampaignId, setLoadingCampaignId] =
    useState<string | null>(null);
  const [savingCampaignId, setSavingCampaignId] =
    useState<string | null>(null);

  const [inlineError, setInlineError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const [stores, campaigns] = await Promise.all([
          storeService.list(organizationId, {
            signal: controller.signal,
          }),
          campaignService.list(organizationId, {
            signal: controller.signal,
          }),
        ]);

        if (controller.signal.aborted) {
          return;
        }

        setState({
          status: "success",
          stores,
          campaigns: campaigns.items,
          nextCursor: campaigns.nextCursor,
        });

        const firstStore =
          stores.find((store) => store.status === "ACTIVE") ??
          stores[0];

        setCreateValues((current) => ({
          ...current,
          storeId: firstStore?.storeId ?? "",
        }));
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

        setState({ status: "error" });
      }
    }

    void load();

    return () => controller.abort();
  }, [organizationId]);

  const storeNames = useMemo(() => {
    if (state.status !== "success") {
      return new Map<string, string>();
    }

    return new Map(
      state.stores.map((store) => [store.storeId, store.name]),
    );
  }, [state]);

  function updateCreateField(
    field: keyof CampaignFormValues,
    value: string,
  ) {
    setCreateValues((current) => ({
      ...current,
      [field]: value,
    }));
    setCreateErrors((current) => ({
      ...current,
      [field]: undefined,
    }));
    setInlineError(null);
  }

  function updateEditField(
    field: keyof CampaignFormValues,
    value: string,
  ) {
    setEditValues((current) => ({
      ...current,
      [field]: value,
    }));
    setEditErrors((current) => ({
      ...current,
      [field]: undefined,
    }));
    setInlineError(null);
  }

  async function replaceList(
    storeId: string,
    status: CampaignStatus | "",
  ) {
    if (state.status !== "success" || listLoading) {
      return;
    }

    setListLoading(true);
    setInlineError(null);
    setNotice(null);

    try {
      const result = await campaignService.list(organizationId, {
        storeId: storeId || null,
        status: status || null,
      });

      setState({
        ...state,
        campaigns: result.items,
        nextCursor: result.nextCursor,
      });
      setSelectedCampaign(null);
    } catch (error) {
      if (isDefinitiveSessionFailure(error)) {
        authSession.logout();
        return;
      }

      setInlineError(operationErrorMessage(error));
    } finally {
      setListLoading(false);
    }
  }

  async function handleLoadMore() {
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
      const result = await campaignService.list(organizationId, {
        storeId: filterStoreId || null,
        status: filterStatus || null,
        cursor: state.nextCursor,
      });

      setState({
        ...state,
        campaigns: [...state.campaigns, ...result.items],
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

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (creating) {
      return;
    }

    const validation = validateCampaignForm(createValues);
    setCreateErrors(validation.errors);
    setInlineError(null);
    setNotice(null);

    if (!validation.valid || !validation.values) {
      return;
    }

    setCreating(true);

    try {
      const created = await campaignService.create(
        organizationId,
        validation.values,
      );

      if (
        state.status === "success" &&
        (!filterStoreId || filterStoreId === created.storeId) &&
        (!filterStatus || filterStatus === created.status)
      ) {
        setState({
          ...state,
          campaigns: [created, ...state.campaigns],
        });
      }

      setCreateValues((current) => ({
        ...EMPTY_FORM,
        storeId: current.storeId,
      }));
      setCreateErrors({});
      setNotice(`สร้างแคมเปญ ${created.name} เป็นฉบับร่างแล้ว`);
    } catch (error) {
      if (isDefinitiveSessionFailure(error)) {
        authSession.logout();
        return;
      }

      setInlineError(operationErrorMessage(error));
    } finally {
      setCreating(false);
    }
  }

  async function handleSelect(campaign: CampaignDTO) {
    if (loadingCampaignId || savingCampaignId) {
      return;
    }

    setLoadingCampaignId(campaign.campaignId);
    setInlineError(null);
    setNotice(null);

    try {
      const fresh = await campaignService.get(
        organizationId,
        campaign.campaignId,
      );

      setSelectedCampaign(fresh);
      setEditValues(campaignToFormValues(fresh));
      setEditErrors({});
    } catch (error) {
      if (isDefinitiveSessionFailure(error)) {
        authSession.logout();
        return;
      }

      setInlineError(operationErrorMessage(error));
    } finally {
      setLoadingCampaignId(null);
    }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      !selectedCampaign ||
      selectedCampaign.status !== "DRAFT" ||
      savingCampaignId
    ) {
      return;
    }

    const validation = validateCampaignForm(editValues);
    setEditErrors(validation.errors);
    setInlineError(null);
    setNotice(null);

    if (!validation.valid || !validation.values) {
      return;
    }

    setSavingCampaignId(selectedCampaign.campaignId);

    try {
      const updated = await campaignService.update(
        organizationId,
        selectedCampaign.campaignId,
        validation.values,
      );

      setSelectedCampaign(updated);
      setEditValues(campaignToFormValues(updated));

      setState((current) =>
        current.status === "success"
          ? {
              ...current,
              campaigns: current.campaigns.map((campaign) =>
                campaign.campaignId === updated.campaignId
                  ? updated
                  : campaign,
              ),
            }
          : current,
      );

      setNotice(`บันทึกแคมเปญ ${updated.name} แล้ว`);
    } catch (error) {
      if (isDefinitiveSessionFailure(error)) {
        authSession.logout();
        return;
      }

      setInlineError(operationErrorMessage(error));

      if (
        error instanceof ApiClientError &&
        error.code === "INVALID_STATUS_TRANSITION"
      ) {
        try {
          const refreshed = await campaignService.get(
            organizationId,
            selectedCampaign.campaignId,
          );
          setSelectedCampaign(refreshed);
          setEditValues(campaignToFormValues(refreshed));
        } catch {
          // Keep the original server error visible.
        }
      }
    } finally {
      setSavingCampaignId(null);
    }
  }

  if (state.status !== "success") {
    return (
      <div className={styles.page}>
        <main className={styles.stateWrap}>
          {state.status === "loading" ? (
            <LoadingState
              title="กำลังโหลดแคมเปญ"
              description="กำลังดึงรายการ ร้านค้า และสถานะล่าสุด"
            />
          ) : (
            <ErrorState
              title="ไม่สามารถโหลดแคมเปญได้"
              description="กรุณาลองโหลดหน้านี้ใหม่อีกครั้ง"
            />
          )}
        </main>
      </div>
    );
  }

  const draftCount = state.campaigns.filter(
    (campaign) => campaign.status === "DRAFT",
  ).length;
  const inProgressCount = state.campaigns.filter((campaign) =>
    ["OPEN", "CLOSED", "PRODUCING", "READY_FOR_PICKUP"].includes(
      campaign.status,
    ),
  ).length;
  const finishedCount = state.campaigns.filter((campaign) =>
    ["COMPLETED", "CANCELLED"].includes(campaign.status),
  ).length;
  const hasFilters = Boolean(filterStoreId || filterStatus);
  const selectedDirty =
    selectedCampaign?.status === "DRAFT" &&
    formChanged(editValues, selectedCampaign);

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.header}>
          <div className={styles.headerCopy} data-ledger-heading>
            <h1 className={styles.title}>แคมเปญ</h1>
            <p className={styles.description}>
              วางแผนช่วงเวลา เปิดหรือปิดรับคำสั่งซื้อ และเดินสถานะแคมเปญตามขั้นตอนของงาน
            </p>
          </div>
        </header>

        <section className={styles.summaryStrip} aria-label="สรุปแคมเปญที่โหลด">
          <div>
            <span className={styles.summaryLabel}>รายการที่โหลด</span>
            <strong>{state.campaigns.length}</strong>
          </div>
          <div>
            <span className={styles.summaryLabel}>ฉบับร่าง</span>
            <strong>{draftCount}</strong>
          </div>
          <div>
            <span className={styles.summaryLabel}>กำลังดำเนินงาน</span>
            <strong>{inProgressCount}</strong>
          </div>
          <div>
            <span className={styles.summaryLabel}>สิ้นสุดแล้ว</span>
            <strong>{finishedCount}</strong>
          </div>
        </section>

        <Notice tone="info" title="วันเวลาเป็นข้อมูลวางแผน">
          การถึงวันเวลาเปิด ปิด ชำระเงิน หรือรับสินค้า จะไม่เปลี่ยนสถานะแคมเปญอัตโนมัติ การเปลี่ยนสถานะเกิดขึ้นเมื่อผู้ดูแลสั่งดำเนินการและระบบยืนยันเท่านั้น
        </Notice>

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

        <div className={styles.grid}>
          <section className={styles.section} aria-labelledby="campaign-list">
            <div className={styles.sectionHeading}>
              <div>
                <h2 className={styles.sectionTitle} id="campaign-list">
                  รายการแคมเปญ
                </h2>
                <p className={styles.sectionDescription}>
                  เลือกรายการเพื่อดูรายละเอียด แก้ไขฉบับร่าง หรือดำเนินสถานะถัดไป
                </p>
              </div>
              <span className={styles.sectionMeta}>
                {hasFilters ? "กำลังใช้ตัวกรอง" : "ทุกขอบเขตที่โหลด"}
              </span>
            </div>

            <div className={styles.toolbar}>
              <SelectField
                id="campaign-store-filter"
                label="ร้านค้า"
                value={filterStoreId}
                disabled={listLoading}
                onChange={(event) => {
                  const value = event.target.value;
                  setFilterStoreId(value);
                  void replaceList(value, filterStatus);
                }}
              >
                <option value="">ทุกร้านค้า</option>
                {state.stores.map((store) => (
                  <option key={store.storeId} value={store.storeId}>
                    {store.name}
                    {store.status === "INACTIVE"
                      ? " (ปิดใช้งาน)"
                      : ""}
                  </option>
                ))}
              </SelectField>

              <SelectField
                id="campaign-status-filter"
                label="สถานะ"
                value={filterStatus}
                disabled={listLoading}
                onChange={(event) => {
                  const value = event.target.value as
                    | CampaignStatus
                    | "";
                  setFilterStatus(value);
                  void replaceList(filterStoreId, value);
                }}
              >
                <option value="">ทุกสถานะ</option>
                {CAMPAIGN_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {campaignStatusLabel(status)}
                  </option>
                ))}
              </SelectField>

              <Button
                variant="quiet"
                disabled={!hasFilters || listLoading}
                onClick={() => {
                  setFilterStoreId("");
                  setFilterStatus("");
                  void replaceList("", "");
                }}
              >
                แสดงทั้งหมด
              </Button>
            </div>

            {listLoading ? (
              <LoadingState
                title="กำลังโหลดรายการแคมเปญ"
                description="กำลังใช้ตัวกรองที่เลือก"
              />
            ) : state.campaigns.length === 0 ? (
              <EmptyState
                title="ไม่พบแคมเปญ"
                description={
                  hasFilters
                    ? "ไม่มีแคมเปญที่ตรงกับตัวกรองนี้"
                    : "สร้างแคมเปญแรกจากแบบฟอร์มด้านข้าง"
                }
              />
            ) : (
              <div className={styles.list}>
                {state.campaigns.map((campaign) => {
                  const selected =
                    selectedCampaign?.campaignId === campaign.campaignId;
                  const loading =
                    loadingCampaignId === campaign.campaignId;

                  return (
                    <article
                      className={[
                        styles.row,
                        selected ? styles.rowSelected : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      key={campaign.campaignId}
                      aria-current={selected ? "true" : undefined}
                    >
                      <div className={styles.rowMain}>
                        <div className={styles.rowHeading}>
                          <h3 className={styles.cardTitle}>
                            {campaign.name}
                          </h3>
                          <Badge tone={statusTone(campaign.status)}>
                            {campaignStatusLabel(campaign.status)}
                          </Badge>
                        </div>

                        <div className={styles.metaRow}>
                          <span className={styles.meta}>
                            ร้านค้า:{" "}
                            {storeNames.get(campaign.storeId) ??
                              campaign.storeId}
                          </span>
                          <span className={styles.meta}>
                            เปิดตามแผน: {scheduleValue(campaign.openAt)}
                          </span>
                          <span className={styles.meta}>
                            ปิดตามแผน: {scheduleValue(campaign.closeAt)}
                          </span>
                        </div>
                      </div>

                      <div className={styles.actions}>
                        <Button
                          variant="secondary"
                          pending={loading}
                          pendingLabel="กำลังโหลด"
                          disabled={savingCampaignId !== null}
                          onClick={() => {
                            void handleSelect(campaign);
                          }}
                        >
                          {selected
                            ? "กำลังดูรายละเอียด"
                            : campaign.status === "DRAFT"
                              ? "ดูและแก้ไข"
                              : "ดูรายละเอียด"}
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {state.nextCursor && !listLoading ? (
              <div className={styles.loadMore}>
                <Button
                  variant="secondary"
                  pending={loadingMore}
                  pendingLabel="กำลังโหลดเพิ่มเติม"
                  onClick={handleLoadMore}
                >
                  โหลดเพิ่มเติม
                </Button>
              </div>
            ) : null}
          </section>

          <aside className={styles.panel}>
            <div className={styles.panelHeading}>
              <span className={styles.panelKicker}>เริ่มรอบการขายใหม่</span>
              <h2 className={styles.sectionTitle}>สร้างแคมเปญ</h2>
              <p className={styles.sectionDescription}>
                แคมเปญใหม่จะเริ่มเป็นฉบับร่าง และยังไม่เปิดรับคำสั่งซื้อจนกว่าจะสั่งเปิด
              </p>
            </div>

            {state.stores.length === 0 ? (
              <Notice tone="warning" title="ยังสร้างแคมเปญไม่ได้">
                ต้องมีร้านค้าในหน่วยงานอย่างน้อยหนึ่งร้านก่อน
              </Notice>
            ) : null}

            <form className={styles.form} onSubmit={handleCreate}>
              <SelectField
                id="campaign-create-store"
                label="ร้านค้า"
                value={createValues.storeId}
                onChange={(event) =>
                  updateCreateField("storeId", event.target.value)
                }
                error={createErrors.storeId}
                required
                disabled={creating || state.stores.length === 0}
              >
                <option value="">เลือกร้านค้า</option>
                {state.stores.map((store) => (
                  <option key={store.storeId} value={store.storeId}>
                    {store.name}
                    {store.status === "INACTIVE"
                      ? " (ปิดใช้งาน)"
                      : ""}
                  </option>
                ))}
              </SelectField>

              <TextField
                id="campaign-create-name"
                label="ชื่อแคมเปญ"
                value={createValues.name}
                onChange={(event) =>
                  updateCreateField("name", event.target.value)
                }
                error={createErrors.name}
                required
                disabled={creating}
              />

              <div className={styles.dateGrid}>
                <DateField
                  id="campaign-create-open"
                  label="เปิดตามแผน"
                  value={createValues.openAt}
                  error={createErrors.openAt}
                  disabled={creating}
                  onChange={(value) =>
                    updateCreateField("openAt", value)
                  }
                />
                <DateField
                  id="campaign-create-close"
                  label="ปิดตามแผน"
                  value={createValues.closeAt}
                  error={createErrors.closeAt}
                  disabled={creating}
                  onChange={(value) =>
                    updateCreateField("closeAt", value)
                  }
                />
                <DateField
                  id="campaign-create-payment"
                  label="กำหนดชำระเงิน"
                  value={createValues.paymentDeadline}
                  error={createErrors.paymentDeadline}
                  disabled={creating}
                  onChange={(value) =>
                    updateCreateField("paymentDeadline", value)
                  }
                />
                <DateField
                  id="campaign-create-pickup"
                  label="วันรับสินค้า"
                  value={createValues.pickupAt}
                  error={createErrors.pickupAt}
                  disabled={creating}
                  onChange={(value) =>
                    updateCreateField("pickupAt", value)
                  }
                />
              </div>

              <Button
                type="submit"
                size="large"
                pending={creating}
                pendingLabel="กำลังสร้างแคมเปญ"
                disabled={state.stores.length === 0}
              >
                สร้างแคมเปญ
              </Button>
            </form>
          </aside>
        </div>

        {selectedCampaign ? (
          <section
            className={styles.detailPanel}
            aria-labelledby="campaign-detail-title"
          >
            <div className={styles.detailHeader}>
              <div className={styles.detailMeta}>
                <div className={styles.detailTitleRow}>
                  <h2
                    className={styles.sectionTitle}
                    id="campaign-detail-title"
                  >
                    {selectedCampaign.name}
                  </h2>
                  <Badge tone={statusTone(selectedCampaign.status)}>
                    {campaignStatusLabel(selectedCampaign.status)}
                  </Badge>
                </div>
                <div className={styles.metaRow}>
                  <span className={styles.meta}>
                    ร้านค้า:{" "}
                    {storeNames.get(selectedCampaign.storeId) ??
                      selectedCampaign.storeId}
                  </span>
                  <span className={styles.meta}>
                    รหัสแคมเปญ: {selectedCampaign.campaignId}
                  </span>
                  <span className={styles.meta}>
                    อัปเดตล่าสุด {formatIsoDateTime(selectedCampaign.updatedAt)}
                  </span>
                </div>
              </div>
              <Button
                variant="quiet"
                size="small"
                onClick={() => setSelectedCampaign(null)}
              >
                ปิดรายละเอียด
              </Button>
            </div>

            {selectedCampaign.status === "DRAFT" ? (
              <div className={styles.detailGrid}>
                <section className={styles.detailSection}>
                  <div className={styles.detailSectionHeading}>
                    <h3 className={styles.detailSectionTitle}>
                      ข้อมูลฉบับร่าง
                    </h3>
                    <p className={styles.sectionDescription}>
                      แก้ไขร้านค้า ชื่อ และช่วงเวลาวางแผนได้ก่อนเปิดรับคำสั่งซื้อ
                    </p>
                  </div>

                  <form className={styles.form} onSubmit={handleSave}>
                    <SelectField
                      id="campaign-edit-store"
                      label="ร้านค้า"
                      value={editValues.storeId}
                      onChange={(event) =>
                        updateEditField(
                          "storeId",
                          event.target.value,
                        )
                      }
                      error={editErrors.storeId}
                      required
                      disabled={
                        savingCampaignId === selectedCampaign.campaignId
                      }
                    >
                      {state.stores.map((store) => (
                        <option
                          key={store.storeId}
                          value={store.storeId}
                        >
                          {store.name}
                          {store.status === "INACTIVE"
                            ? " (ปิดใช้งาน)"
                            : ""}
                        </option>
                      ))}
                    </SelectField>

                    <TextField
                      id="campaign-edit-name"
                      label="ชื่อแคมเปญ"
                      value={editValues.name}
                      onChange={(event) =>
                        updateEditField("name", event.target.value)
                      }
                      error={editErrors.name}
                      required
                      disabled={
                        savingCampaignId === selectedCampaign.campaignId
                      }
                    />

                    <div className={styles.dateGrid}>
                      <DateField
                        id="campaign-edit-open"
                        label="เปิดตามแผน"
                        value={editValues.openAt}
                        error={editErrors.openAt}
                        disabled={
                          savingCampaignId === selectedCampaign.campaignId
                        }
                        onChange={(value) =>
                          updateEditField("openAt", value)
                        }
                      />
                      <DateField
                        id="campaign-edit-close"
                        label="ปิดตามแผน"
                        value={editValues.closeAt}
                        error={editErrors.closeAt}
                        disabled={
                          savingCampaignId === selectedCampaign.campaignId
                        }
                        onChange={(value) =>
                          updateEditField("closeAt", value)
                        }
                      />
                      <DateField
                        id="campaign-edit-payment"
                        label="กำหนดชำระเงิน"
                        value={editValues.paymentDeadline}
                        error={editErrors.paymentDeadline}
                        disabled={
                          savingCampaignId === selectedCampaign.campaignId
                        }
                        onChange={(value) =>
                          updateEditField("paymentDeadline", value)
                        }
                      />
                      <DateField
                        id="campaign-edit-pickup"
                        label="วันรับสินค้า"
                        value={editValues.pickupAt}
                        error={editErrors.pickupAt}
                        disabled={
                          savingCampaignId === selectedCampaign.campaignId
                        }
                        onChange={(value) =>
                          updateEditField("pickupAt", value)
                        }
                      />
                    </div>

                    <div className={styles.editActions}>
                      <Button
                        type="submit"
                        pending={
                          savingCampaignId === selectedCampaign.campaignId
                        }
                        pendingLabel="กำลังบันทึก"
                        disabled={!selectedDirty}
                      >
                        บันทึกฉบับร่าง
                      </Button>
                      {!selectedDirty ? (
                        <span className={styles.meta}>
                          ยังไม่มีข้อมูลที่เปลี่ยนแปลง
                        </span>
                      ) : null}
                    </div>
                  </form>
                </section>

                <section className={styles.detailSection}>
                  <div className={styles.detailSectionHeading}>
                    <h3 className={styles.detailSectionTitle}>
                      ขั้นตอนถัดไป
                    </h3>
                    <p className={styles.sectionDescription}>
                      ตรวจสอบข้อมูลให้เรียบร้อยก่อนเปิดรับคำสั่งซื้อ
                    </p>
                  </div>

                  <CampaignLifecycleActions
                    organizationId={organizationId}
                    campaign={selectedCampaign}
                    onCampaignChanged={(updated) => {
                      setSelectedCampaign(updated);
                      setEditValues(campaignToFormValues(updated));
                      setState((current) =>
                        current.status === "success"
                          ? {
                              ...current,
                              campaigns: current.campaigns.map((campaign) =>
                                campaign.campaignId === updated.campaignId
                                  ? updated
                                  : campaign,
                              ),
                            }
                          : current,
                      );
                    }}
                  />
                </section>
              </div>
            ) : (
              <div className={styles.detailGrid}>
                <section className={styles.detailSection}>
                  <div className={styles.detailSectionHeading}>
                    <h3 className={styles.detailSectionTitle}>
                      กำหนดการ
                    </h3>
                    <p className={styles.sectionDescription}>
                      หลังออกจากฉบับร่าง ข้อมูลแผนจะแสดงแบบอ่านอย่างเดียว
                    </p>
                  </div>

                  <div className={styles.scheduleGrid}>
                    <div className={styles.scheduleItem}>
                      <span className={styles.scheduleLabel}>
                        เปิดตามแผน
                      </span>
                      <span className={styles.scheduleValue}>
                        {scheduleValue(selectedCampaign.openAt)}
                      </span>
                    </div>
                    <div className={styles.scheduleItem}>
                      <span className={styles.scheduleLabel}>
                        ปิดตามแผน
                      </span>
                      <span className={styles.scheduleValue}>
                        {scheduleValue(selectedCampaign.closeAt)}
                      </span>
                    </div>
                    <div className={styles.scheduleItem}>
                      <span className={styles.scheduleLabel}>
                        กำหนดชำระเงิน
                      </span>
                      <span className={styles.scheduleValue}>
                        {scheduleValue(selectedCampaign.paymentDeadline)}
                      </span>
                    </div>
                    <div className={styles.scheduleItem}>
                      <span className={styles.scheduleLabel}>
                        วันรับสินค้า
                      </span>
                      <span className={styles.scheduleValue}>
                        {scheduleValue(selectedCampaign.pickupAt)}
                      </span>
                    </div>
                  </div>
                </section>

                <section className={styles.detailSection}>
                  <div className={styles.detailSectionHeading}>
                    <h3 className={styles.detailSectionTitle}>
                      การดำเนินสถานะ
                    </h3>
                    <p className={styles.sectionDescription}>
                      แสดงเฉพาะการดำเนินการที่รองรับจากสถานะปัจจุบัน
                    </p>
                  </div>

                  <CampaignLifecycleActions
                    organizationId={organizationId}
                    campaign={selectedCampaign}
                    onCampaignChanged={(updated) => {
                      setSelectedCampaign(updated);
                      setEditValues(campaignToFormValues(updated));
                      setState((current) =>
                        current.status === "success"
                          ? {
                              ...current,
                              campaigns: current.campaigns.map((campaign) =>
                                campaign.campaignId === updated.campaignId
                                  ? updated
                                  : campaign,
                              ),
                            }
                          : current,
                      );
                    }}
                  />
                </section>
              </div>
            )}
          </section>
        ) : null}
      </main>
    </div>
  );
}
