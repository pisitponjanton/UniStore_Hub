"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
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
      return "ไม่พบ Campaign นี้แล้ว กรุณารีเฟรชรายการ";
    }

    if (error.code === "STORE_NOT_FOUND") {
      return "ไม่พบร้านค้าที่เลือกแล้ว กรุณารีเฟรชข้อมูลร้านค้า";
    }

    if (error.code === "INVALID_STATUS_TRANSITION") {
      return "Campaign นี้ไม่อยู่ในสถานะ DRAFT แล้ว จึงไม่สามารถแก้ไขข้อมูลได้";
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
      setNotice(`สร้าง Campaign ${created.name} เป็น DRAFT แล้ว`);
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

      setNotice(`บันทึก Campaign ${updated.name} แล้ว`);
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
            <LoadingState title="กำลังโหลด Campaign" />
          ) : (
            <ErrorState
              title="ไม่สามารถโหลด Campaign ได้"
              description="กรุณาลองโหลดหน้านี้ใหม่อีกครั้ง"
            />
          )}
        </main>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.header}>
          <div className={styles.headerCopy} data-ledger-heading>
            <span className={styles.eyebrow}>Campaign management</span>
            <h1 className={styles.title}>Campaign</h1>
            <p className={styles.description}>
              จัดการรายการ สร้าง และแก้ไข Campaign ที่ยังเป็น DRAFT
              วันเวลาที่กำหนดเป็นข้อมูลวางแผนเท่านั้น
              Frontend จะไม่เปลี่ยนสถานะ Campaign ตามนาฬิกาอัตโนมัติ
            </p>
          </div>
          <Badge tone="info">
            {state.campaigns.length} รายการในหน้าปัจจุบัน
          </Badge>
        </header>

        {inlineError ? (
          <div className={styles.error} role="alert">
            {inlineError}
          </div>
        ) : null}

        {notice ? (
          <div className={styles.notice} role="status">
            {notice}
          </div>
        ) : null}

        <div className={styles.grid}>
          <section className={styles.section} aria-labelledby="campaign-list">
            <h2 className={styles.sectionTitle} id="campaign-list">
              รายการ Campaign
            </h2>

            <div className={styles.toolbar}>
              <SelectField
                id="campaign-store-filter"
                label="กรองตามร้านค้า"
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
                label="กรองตามสถานะ"
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
                disabled={
                  (!filterStoreId && !filterStatus) || listLoading
                }
                onClick={() => {
                  setFilterStoreId("");
                  setFilterStatus("");
                  void replaceList("", "");
                }}
              >
                ล้างตัวกรอง
              </Button>
            </div>

            {listLoading ? (
              <LoadingState title="กำลังโหลดรายการ Campaign" />
            ) : state.campaigns.length === 0 ? (
              <EmptyState
                title="ไม่พบ Campaign"
                description="ยังไม่มี Campaign ที่ตรงกับตัวกรองนี้"
              />
            ) : (
              <div className={styles.list}>
                {state.campaigns.map((campaign) => (
                  <article
                    className={styles.card}
                    key={campaign.campaignId}
                  >
                    <div className={styles.cardHeader}>
                      <div className={styles.cardCopy}>
                        <h3 className={styles.cardTitle}>
                          {campaign.name}
                        </h3>
                        <div className={styles.metaRow}>
                          <span className={styles.meta}>
                            ร้านค้า:{" "}
                            {storeNames.get(campaign.storeId) ??
                              campaign.storeId}
                          </span>
                          <span className={styles.meta}>
                            เปิดตามแผน{" "}
                            {formatIsoDateTime(campaign.openAt)}
                          </span>
                          <span className={styles.meta}>
                            ปิดตามแผน{" "}
                            {formatIsoDateTime(campaign.closeAt)}
                          </span>
                        </div>
                      </div>

                      <Badge tone={statusTone(campaign.status)}>
                        {campaignStatusLabel(campaign.status)}
                      </Badge>
                    </div>

                    <div className={styles.actions}>
                      <Button
                        variant="secondary"
                        pending={
                          loadingCampaignId === campaign.campaignId
                        }
                        pendingLabel="กำลังโหลด"
                        disabled={savingCampaignId !== null}
                        onClick={() => {
                          void handleSelect(campaign);
                        }}
                      >
                        {campaign.status === "DRAFT"
                          ? "ดู / แก้ไข"
                          : "ดูรายละเอียด"}
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {state.nextCursor && !listLoading ? (
              <div className={styles.loadMore}>
                <Button
                  variant="secondary"
                  pending={loadingMore}
                  pendingLabel="กำลังโหลด"
                  onClick={handleLoadMore}
                >
                  โหลดเพิ่มเติม
                </Button>
              </div>
            ) : null}
          </section>

          <div className={styles.side}>
            <section className={styles.panel}>
              <div>
                <h2 className={styles.sectionTitle}>
                  สร้าง Campaign ใหม่
                </h2>
                <p className={styles.description}>
                  Campaign ใหม่จะเริ่มต้นเป็น DRAFT
                  และวันเวลาทั้งหมดเป็น planning fields
                </p>
              </div>

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
                  label="ชื่อ Campaign"
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
                    label="วันเวลาเปิดตามแผน"
                    value={createValues.openAt}
                    error={createErrors.openAt}
                    disabled={creating}
                    onChange={(value) =>
                      updateCreateField("openAt", value)
                    }
                  />
                  <DateField
                    id="campaign-create-close"
                    label="วันเวลาปิดตามแผน"
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
                    label="วันเวลารับสินค้า"
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
                  pending={creating}
                  pendingLabel="กำลังสร้าง"
                  disabled={state.stores.length === 0}
                >
                  สร้าง Campaign
                </Button>
              </form>
            </section>

            {selectedCampaign ? (
              <section className={styles.panel}>
                <div className={styles.detailHeader}>
                  <div className={styles.detailMeta}>
                    <h2 className={styles.sectionTitle}>
                      รายละเอียด Campaign
                    </h2>
                    <span className={styles.meta}>
                      Campaign ID: {selectedCampaign.campaignId}
                    </span>
                  </div>
                  <Badge tone={statusTone(selectedCampaign.status)}>
                    {campaignStatusLabel(selectedCampaign.status)}
                  </Badge>
                </div>

                {selectedCampaign.status === "DRAFT" ? (
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
                        savingCampaignId ===
                        selectedCampaign.campaignId
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
                      label="ชื่อ Campaign"
                      value={editValues.name}
                      onChange={(event) =>
                        updateEditField(
                          "name",
                          event.target.value,
                        )
                      }
                      error={editErrors.name}
                      required
                      disabled={
                        savingCampaignId ===
                        selectedCampaign.campaignId
                      }
                    />

                    <div className={styles.dateGrid}>
                      <DateField
                        id="campaign-edit-open"
                        label="วันเวลาเปิดตามแผน"
                        value={editValues.openAt}
                        error={editErrors.openAt}
                        disabled={
                          savingCampaignId ===
                          selectedCampaign.campaignId
                        }
                        onChange={(value) =>
                          updateEditField("openAt", value)
                        }
                      />
                      <DateField
                        id="campaign-edit-close"
                        label="วันเวลาปิดตามแผน"
                        value={editValues.closeAt}
                        error={editErrors.closeAt}
                        disabled={
                          savingCampaignId ===
                          selectedCampaign.campaignId
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
                          savingCampaignId ===
                          selectedCampaign.campaignId
                        }
                        onChange={(value) =>
                          updateEditField(
                            "paymentDeadline",
                            value,
                          )
                        }
                      />
                      <DateField
                        id="campaign-edit-pickup"
                        label="วันเวลารับสินค้า"
                        value={editValues.pickupAt}
                        error={editErrors.pickupAt}
                        disabled={
                          savingCampaignId ===
                          selectedCampaign.campaignId
                        }
                        onChange={(value) =>
                          updateEditField("pickupAt", value)
                        }
                      />
                    </div>

                    <div className={styles.actions}>
                      <Button
                        type="submit"
                        pending={
                          savingCampaignId ===
                          selectedCampaign.campaignId
                        }
                        pendingLabel="กำลังบันทึก"
                      >
                        บันทึก DRAFT
                      </Button>
                      <Button
                        type="button"
                        variant="quiet"
                        disabled={savingCampaignId !== null}
                        onClick={() =>
                          setSelectedCampaign(null)
                        }
                      >
                        ปิด
                      </Button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className={styles.readOnly}>
                      Campaign นี้ไม่ใช่ DRAFT แล้ว
                      จึงแสดงข้อมูลแบบอ่านอย่างเดียวใน Phase นี้
                      การเปลี่ยนสถานะจะทำผ่าน lifecycle actions
                      ของ Backend ใน Phase ถัดไป
                    </div>

                    <div className={styles.scheduleGrid}>
                      <div className={styles.scheduleItem}>
                        <span className={styles.scheduleLabel}>
                          ร้านค้า
                        </span>
                        <span className={styles.scheduleValue}>
                          {storeNames.get(selectedCampaign.storeId) ??
                            selectedCampaign.storeId}
                        </span>
                      </div>
                      <div className={styles.scheduleItem}>
                        <span className={styles.scheduleLabel}>
                          วันเวลาเปิดตามแผน
                        </span>
                        <span className={styles.scheduleValue}>
                          {formatIsoDateTime(selectedCampaign.openAt)}
                        </span>
                      </div>
                      <div className={styles.scheduleItem}>
                        <span className={styles.scheduleLabel}>
                          วันเวลาปิดตามแผน
                        </span>
                        <span className={styles.scheduleValue}>
                          {formatIsoDateTime(selectedCampaign.closeAt)}
                        </span>
                      </div>
                      <div className={styles.scheduleItem}>
                        <span className={styles.scheduleLabel}>
                          กำหนดชำระเงิน
                        </span>
                        <span className={styles.scheduleValue}>
                          {formatIsoDateTime(
                            selectedCampaign.paymentDeadline,
                          )}
                        </span>
                      </div>
                      <div className={styles.scheduleItem}>
                        <span className={styles.scheduleLabel}>
                          วันเวลารับสินค้า
                        </span>
                        <span className={styles.scheduleValue}>
                          {formatIsoDateTime(
                            selectedCampaign.pickupAt,
                          )}
                        </span>
                      </div>
                    </div>

                    <Button
                      variant="quiet"
                      onClick={() => setSelectedCampaign(null)}
                    >
                      ปิดรายละเอียด
                    </Button>
                  </>
                )}

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
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
