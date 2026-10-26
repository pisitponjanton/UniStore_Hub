"use client";


import { ManagementModal } from "@/components/ui/management-modal";
import { AsyncPageFallback } from "@/components/ui/async-page";
import { searchLoadedItems, visibleLoadedItems } from "@/modules/organization-directory/loaded-directory-helpers";

import Link from "next/link";
import { campaignDetailHref, storeWorkspaceHref } from "@/modules/stores/store-workspace";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Info, Search, X } from "lucide-react";

import {
  Badge,
  Button,
  EmptyState,
  ErrorSummary,
  useErrorSummaryFocus,
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
import { productionHref } from "@/modules/production/production-helpers";
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

type CampaignGroup = "all" | "draft" | "active" | "ended";

function inCampaignGroup(status: CampaignStatus, group: CampaignGroup) {
  if (group === "all") return true;
  if (group === "draft") return status === "DRAFT";
  if (group === "ended") return status === "COMPLETED" || status === "CANCELLED";
  return ["OPEN", "CLOSED", "PRODUCING", "READY_FOR_PICKUP"].includes(status);
}

const campaignDay = new Intl.DateTimeFormat("th-TH", {
  day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok",
});

function campaignPeriod(campaign: CampaignDTO) {
  const start = campaign.openAt ? campaignDay.format(new Date(campaign.openAt)) : null;
  const end = campaign.closeAt ? campaignDay.format(new Date(campaign.closeAt)) : null;
  if (start && end) return `${start} – ${end}`;
  if (start) return `เปิดตามแผน ${start}`;
  if (end) return `ปิดตามแผน ${end}`;
  return "ยังไม่กำหนดช่วงขาย";
}

function PlanningHelp() {
  return <details className={styles.planningHelp}>
    <summary><Info size={15} aria-hidden="true" /> วันเวลาเป็นข้อมูลวางแผน</summary>
    <p>วันเปิด ปิด ชำระเงิน และรับสินค้า ไม่ทำให้สถานะแคมเปญเปลี่ยนอัตโนมัติ ผู้ดูแลต้องยืนยันการเปลี่ยนสถานะเอง</p>
  </details>;
}

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
  onBlur,
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onBlur?: () => void;
}) {
  return (
    <TextField
      id={id}
      type="datetime-local"
      label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      error={error}
      announceError={false}
      disabled={disabled}
      onBlur={onBlur}
    />
  );
}

function ScheduleValue({ value }: { value: string | null }) {
  return value ? (
    <time dateTime={value}>{formatIsoDateTime(value)}</time>
  ) : (
    <>ยังไม่กำหนด</>
  );
}

const CAMPAIGN_ERROR_FIELDS: Array<
  [keyof CampaignFormErrors, string]
> = [
  ["storeId", "store"],
  ["name", "name"],
  ["openAt", "open"],
  ["closeAt", "close"],
  ["paymentDeadline", "payment"],
  ["pickupAt", "pickup"],
];

function campaignErrorItems(
  prefix: "campaign-create" | "campaign-edit",
  errors: CampaignFormErrors,
) {
  return CAMPAIGN_ERROR_FIELDS.flatMap(([field, suffix]) => {
    const message = errors[field];

    return message
      ? [{ fieldId: `${prefix}-${suffix}`, message }]
      : [];
  });
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
  organizationId, fixedStoreId, storeName, storeActive = true, detailCampaignId, standaloneDetail = false, onDirtyChange,
}: {
  organizationId: string;
  fixedStoreId?: string;
  storeName?: string;
  storeActive?: boolean;
  detailCampaignId?: string;
  standaloneDetail?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const focusErrorSummary = useErrorSummaryFocus();
  const [directoryQuery, setDirectoryQuery] = useState("");
  const [directoryLimit, setDirectoryLimit] = useState(24);
  const [statusGroup, setStatusGroup] = useState<CampaignGroup>("all");
  const [state, setState] = useState<CampaignState>({
    status: "loading",
  });

  const [filterStoreId, setFilterStoreId] = useState(fixedStoreId ?? "");
  const [filterStatus, setFilterStatus] = useState<
    CampaignStatus | ""
  >("");
  const [listLoading, setListLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [createValues, setCreateValues] =
    useState<CampaignFormValues>({ ...EMPTY_FORM, storeId: fixedStoreId ?? "" });
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
  const [listFeedback, setListFeedback] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const [stores, campaigns] = await Promise.all([
          fixedStoreId
            ? storeService.get(organizationId, fixedStoreId, {
                signal: controller.signal,
              }).then(store => [store])
            : storeService.list(organizationId, {
                signal: controller.signal,
              }),
          detailCampaignId ? Promise.resolve({ items: [], nextCursor: null }) : campaignService.list(organizationId, {
            storeId: fixedStoreId ?? null,
            signal: controller.signal,
          }),
        ]);

        if (controller.signal.aborted) {
          return;
        }

        setState({
          status: "success",
          stores,
          campaigns: fixedStoreId ? campaigns.items.filter(campaign => campaign.storeId === fixedStoreId) : campaigns.items,
          nextCursor: campaigns.nextCursor,
        });

        const firstStore =
          stores.find((store) => store.status === "ACTIVE") ??
          stores[0];

        setCreateValues((current) => ({
          ...current,
          storeId: fixedStoreId ?? firstStore?.storeId ?? "",
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
  }, [organizationId, fixedStoreId, detailCampaignId]);

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
        storeId: (fixedStoreId ?? storeId) || null,
        status: status || null,
      });

      setState({
        ...state,
        campaigns: fixedStoreId ? result.items.filter(campaign => campaign.storeId === fixedStoreId) : result.items,
        nextCursor: result.nextCursor,
      });
      setSelectedCampaign(null);

      const storeLabel = storeId
        ? storeNames.get(storeId) ?? storeId
        : "ทุกร้านค้า";
      const statusLabel = status
        ? campaignStatusLabel(status)
        : "ทุกสถานะ";
      setListFeedback(
        `แสดง ${result.items.length.toLocaleString("th-TH")} แคมเปญ · ${storeLabel} · ${statusLabel}`,
      );
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
        storeId: (fixedStoreId ?? filterStoreId) || null,
        status: filterStatus || null,
        cursor: state.nextCursor,
      });

      const nextCampaigns = [...state.campaigns, ...result.items];

      setState({
        ...state,
        campaigns: fixedStoreId ? nextCampaigns.filter(campaign => campaign.storeId === fixedStoreId) : nextCampaigns,
        nextCursor: result.nextCursor,
      });
      setListFeedback(
        `โหลดเพิ่มเติมแล้ว ตอนนี้แสดง ${nextCampaigns.length.toLocaleString("th-TH")} แคมเปญ`,
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

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (creating) {
      return;
    }

    const validation = validateCampaignForm({ ...createValues, storeId: fixedStoreId ?? createValues.storeId });
    setCreateErrors(validation.errors);
    setInlineError(null);
    setNotice(null);

    if (!validation.valid || !validation.values) {
      focusErrorSummary("campaign-create-error-summary");
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
      setShowCreate(false);
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
      if (fixedStoreId && fresh.storeId !== fixedStoreId) throw new Error("Campaign does not belong to current store");

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
      focusErrorSummary("campaign-edit-error-summary");
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

  useEffect(() => {
    if (!detailCampaignId || state.status !== "success") return;
    const controller = new AbortController();
    campaignService.get(organizationId, detailCampaignId, { signal: controller.signal }).then(campaign => {
      if (controller.signal.aborted) return;
      if (fixedStoreId && campaign.storeId !== fixedStoreId) {
        setInlineError("แคมเปญนี้ไม่ได้อยู่ในร้านที่เลือก");
        return;
      }
      setSelectedCampaign(campaign);
      setEditValues(campaignToFormValues(campaign));
      setEditErrors({});
    }).catch(error => {
      if (controller.signal.aborted) return;
      if (isDefinitiveSessionFailure(error)) { authSession.logout(); return; }
      setInlineError(operationErrorMessage(error));
    });
    return () => controller.abort();
  }, [organizationId, fixedStoreId, detailCampaignId, state.status]);

  const editDirtyForWorkspace = selectedCampaign?.status === "DRAFT" &&
    formChanged(editValues, selectedCampaign);
  useEffect(() => {
    onDirtyChange?.(Boolean(editDirtyForWorkspace));
    return () => onDirtyChange?.(false);
  }, [editDirtyForWorkspace, onDirtyChange]);

  if (state.status !== "success") {
    return (
      <div className={styles.page}>
        <main className={styles.stateWrap}>
          <AsyncPageFallback
            status={state.status}
            pageTitle="แคมเปญ"
            pageDescription="ติดตามรอบการขายและสถานะแคมเปญ"
            loadingTitle="กำลังโหลดแคมเปญ"
            errorTitle="ไม่สามารถโหลดแคมเปญได้"
            backHref="/org/select/"
            backLabel="กลับไปพื้นที่ทำงาน"
          />
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
  const hasFilters = Boolean((!fixedStoreId && filterStoreId) || filterStatus);
  const selectedDirty =
    selectedCampaign?.status === "DRAFT" &&
    formChanged(editValues, selectedCampaign);

  const defaultCreateStoreId = fixedStoreId ?? ((state.stores.find(store => store.status === "ACTIVE") ?? state.stores[0])?.storeId ?? "");
  const createDirty = Object.entries(createValues).some(([field, value]) =>
    field === "storeId" ? value !== defaultCreateStoreId : Boolean(value.trim()),
  );

  function closeCreate() {
    setShowCreate(false);
    setCreateValues({ ...EMPTY_FORM, storeId: defaultCreateStoreId });
    setCreateErrors({});
    setInlineError(null);
  }

  // Group pills and search apply to the loaded slice; the exact status dropdown is API-backed.
  const directoryMatches = searchLoadedItems(
    state.campaigns.filter(campaign =>
      (!fixedStoreId || campaign.storeId === fixedStoreId) && inCampaignGroup(campaign.status, statusGroup),
    ),
    directoryQuery,
    campaign => [campaign.name, campaign.campaignId, storeNames.get(campaign.storeId), campaign.status],
  );
  const directoryVisible = visibleLoadedItems(directoryMatches, directoryLimit);

  return (
    <div className={standaloneDetail ? styles.standalonePage : styles.page}>
      <main className={styles.main}>
        {!standaloneDetail ? <header className={styles.header}>
          <div className={styles.headerCopy}>
            {detailCampaignId ? <h2 className={styles.title}>รายละเอียดแคมเปญ</h2> : fixedStoreId ? <h2 className={styles.title}>แคมเปญ</h2> : <h1 className={styles.title}>แคมเปญ</h1>}
            <p className={styles.description}>
              {fixedStoreId ? `จัดการรอบการขายของร้าน ${storeName ?? "ที่เลือก"}` : "จัดการรอบการขายของร้านค้าในหน่วยงาน"}
            </p>
          </div>
          <div className={styles.headerActions}>
            {selectedCampaign && !detailCampaignId ? (
              <Button variant="secondary" onClick={() => setSelectedCampaign(null)}>กลับไปรายการ</Button>
            ) : null}
            {!detailCampaignId ? <Button onClick={() => setShowCreate(true)}>+ สร้างแคมเปญ</Button> : null}
          </div>
        </header> : null}

        {!detailCampaignId && !selectedCampaign && state.campaigns.length > 0 ? (
          <div className={styles.summaryStrip} role="group" aria-label="กรองกลุ่มแคมเปญที่โหลด">
            {([
              ["all", "ทั้งหมด", state.campaigns.length],
              ["draft", "ฉบับร่าง", draftCount],
              ["active", "กำลังดำเนินงาน", inProgressCount],
              ["ended", "สิ้นสุด", finishedCount],
            ] as const).map(([group, label, count]) => (
              <button type="button" key={group}
                className={styles.groupButton}
                aria-pressed={statusGroup === group}
                disabled={listLoading}
                onClick={() => {
                  setStatusGroup(group);
                  setDirectoryLimit(24);
                  if (filterStatus) {
                    setFilterStatus("");
                    void replaceList(filterStoreId, "");
                  }
                }}>
                {label} <strong>{count.toLocaleString("th-TH")}</strong>
              </button>
            ))}
            <span className={styles.groupScope}>จากรายการที่โหลด</span>
          </div>
        ) : null}

        {inlineError && !showCreate ? (
          <Notice tone="danger" role="alert" title="ดำเนินการไม่สำเร็จ">
            {inlineError}
          </Notice>
        ) : null}

        {notice ? (
          <Notice tone="success" role="status" title="อัปเดตแล้ว">
            {notice}
          </Notice>
        ) : null}

        {!detailCampaignId && !selectedCampaign ? <div className={styles.grid}>
          <section className={styles.section} aria-label="รายการแคมเปญ">
            <div className={styles.toolbar} aria-busy={listLoading}>
              <label className={styles.searchBox} htmlFor="campaigns-directory-search">
                <Search size={17} aria-hidden="true" />
                <input id="campaigns-directory-search" type="search" autoComplete="off"
                  placeholder="ค้นหาชื่อหรือรหัสแคมเปญ"
                  aria-label="ค้นหาแคมเปญ"
                  value={directoryQuery} disabled={listLoading}
                  onChange={event => { setDirectoryQuery(event.target.value); setDirectoryLimit(24); }} />
                {directoryQuery ? <button type="button" aria-label="ล้างคำค้นหา"
                  disabled={listLoading}
                  onClick={event => { event.preventDefault(); setDirectoryQuery(""); setDirectoryLimit(24); }}>
                  <X size={15} aria-hidden="true" />
                </button> : null}
              </label>
              {!fixedStoreId ? <label className={styles.selectBox}>
                <span className={styles.filterLabel}>ร้านค้า</span>
                <select id="campaign-store-filter" value={filterStoreId} aria-label="ร้านค้า"
                  disabled={listLoading}
                  onChange={event => {
                    const value = event.target.value;
                    setFilterStoreId(value);
                    setDirectoryLimit(24);
                    void replaceList(value, filterStatus);
                  }}>
                  <option value="">ทุกร้านค้า</option>
                  {state.stores.map(store => <option key={store.storeId} value={store.storeId}>
                    {store.name}{store.status === "INACTIVE" ? " (ปิดใช้งาน)" : ""}
                  </option>)}
                </select>
              </label> : null}
              <label className={styles.selectBox}>
                <span className={styles.filterLabel}>สถานะ</span>
                <select id="campaign-status-filter" aria-label="สถานะ" value={filterStatus}
                  disabled={listLoading}
                  onChange={event => {
                    const value = event.target.value as CampaignStatus | "";
                    setFilterStatus(value);
                    setStatusGroup("all");
                    setDirectoryLimit(24);
                    void replaceList(filterStoreId, value);
                  }}>
                  <option value="">ทุกสถานะ</option>
                  {CAMPAIGN_STATUSES.map(status => <option key={status} value={status}>
                    {campaignStatusLabel(status)}
                  </option>)}
                </select>
              </label>
              {hasFilters ? <button className={styles.clearFilters} type="button"
                disabled={listLoading}
                onClick={() => {
                  setFilterStoreId(fixedStoreId ?? "");
                  setFilterStatus("");
                  setStatusGroup("all");
                  setDirectoryLimit(24);
                  void replaceList(fixedStoreId ?? "", "");
                }}>แสดงทั้งหมด</button> : null}
            </div>
            {listFeedback ? <p className={styles.listFeedback} role="status" aria-live="polite">{listFeedback}</p> : null}
            {directoryQuery || statusGroup !== "all" || state.nextCursor ? (
              <p className={styles.resultsMeta} aria-live="polite">
                แสดง {directoryVisible.length.toLocaleString("th-TH")} จาก {directoryMatches.length.toLocaleString("th-TH")} รายการที่ตรงเงื่อนไขในข้อมูลที่โหลดแล้ว
                {state.nextCursor ? " · ยังมีรายการในหน้าถัดไป" : ""}
              </p>
            ) : null}

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
                    : "กดสร้างแคมเปญเพื่อเริ่มรอบขายแรก"
                }
              />
            ) : directoryMatches.length === 0 ? (
              <EmptyState
                title={directoryQuery ? "ไม่พบรายการที่ตรงคำค้นหา ลองเปลี่ยนคำหรือกดล้าง" : "ไม่มีแคมเปญในกลุ่มนี้"}
                description={directoryQuery ? "ลองปรับคำค้นหา หรือเลือกกลุ่มและสถานะอื่น" : "เลือกกลุ่มหรือสถานะอื่นเพื่อดูแคมเปญ"}
              />
            ) : (
              <div className={styles.list}>
                {directoryVisible.map(campaign => {
                  const loading = loadingCampaignId === campaign.campaignId;
                  return (
                    <article key={campaign.campaignId} className={styles.row}>
                      <div className={styles.rowMain}>
                        <div className={styles.rowHeading}>
                          <h3 className={styles.cardTitle}>{campaign.name}</h3>
                          <Badge tone={statusTone(campaign.status)}>{campaignStatusLabel(campaign.status)}</Badge>
                        </div>
                        <div className={styles.metaRow}>
                          {!fixedStoreId ? <span className={styles.meta}>{storeNames.get(campaign.storeId) ?? campaign.storeId}</span> : null}
                          <span className={styles.meta}>{campaignPeriod(campaign)}</span>
                        </div>
                      </div>
                      <div className={styles.actions}>
                        {fixedStoreId ? (
                          <Link className={styles.detailLink}
                            href={campaignDetailHref(organizationId, fixedStoreId, campaign.campaignId)}>
                            {campaign.status === "DRAFT" ? "ดูและแก้ไข" : "ดูรายละเอียด"}
                          </Link>
                        ) : (
                          <Button variant="secondary" pending={loading} pendingLabel="กำลังโหลด"
                            disabled={savingCampaignId !== null}
                            onClick={() => { void handleSelect(campaign); }}>
                            {campaign.status === "DRAFT" ? "ดูและแก้ไข" : "ดูรายละเอียด"}
                          </Button>
                        )}
                        {["PRODUCING", "READY_FOR_PICKUP", "COMPLETED"].includes(campaign.status) ? (
                          <Link className={styles.productionLink}
                            href={productionHref(organizationId, campaign.campaignId)}
                            aria-label={"เปิดสรุปงานผลิต แคมเปญ " + campaign.name}>ดูยอดผลิต</Link>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
            {directoryMatches.length > directoryVisible.length ? (
              <div className={styles.showMoreLoaded}>
                <button type="button" onClick={() => setDirectoryLimit(limit => limit + 24)}>
                  แสดงเพิ่มอีก {Math.min(24, directoryMatches.length - directoryVisible.length)} รายการที่โหลด
                </button>
              </div>
            ) : null}

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

          </div> : null}

          {showCreate ? <ManagementModal title="สร้างแคมเปญ"
            description="สร้างรอบขายใหม่เป็นฉบับร่าง ก่อนเปิดรับคำสั่งซื้อ"
            size="large" formId="campaign-create-form" submitLabel="สร้างแคมเปญ"
            submitting={creating} submitDisabled={!fixedStoreId && state.stores.length === 0}
            dirty={createDirty} onClose={closeCreate}><div className={styles.modalContents}>
            {inlineError ? <Notice tone="danger" role="alert" title="ดำเนินการไม่สำเร็จ">{inlineError}</Notice> : null}
            {fixedStoreId && !storeActive ? <Notice tone="neutral" title="ร้านค้าปิดใช้งาน">
              สามารถเตรียมข้อมูลภายในร้านได้ แต่ลูกค้าจะยังไม่เห็นร้านนี้จนกว่าจะเปิดใช้งาน
            </Notice> : null}
            <aside className={styles.panel}>
            {!fixedStoreId && state.stores.length === 0 ? (
              <Notice tone="warning" title="ยังสร้างแคมเปญไม่ได้">
                ต้องมีร้านค้าในหน่วยงานอย่างน้อยหนึ่งร้านก่อน
              </Notice>
            ) : null}

            <form id="campaign-create-form" className={styles.form} onSubmit={handleCreate} noValidate>
              <ErrorSummary
                id="campaign-create-error-summary"
                items={campaignErrorItems("campaign-create", createErrors)}
              />
              {fixedStoreId ? <p className={styles.sectionDescription}>สร้างแคมเปญในร้าน {storeName ?? fixedStoreId}</p> : (
              <SelectField
                id="campaign-create-store"
                label="ร้านค้า"
                value={createValues.storeId}
                onChange={(event) =>
                  updateCreateField("storeId", event.target.value)
                }
                error={createErrors.storeId}
                announceError={false}
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
              )}

              <TextField
                id="campaign-create-name"
                label="ชื่อแคมเปญ"
                value={createValues.name}
                onChange={(event) =>
                  updateCreateField("name", event.target.value)
                }
                error={createErrors.name}
                announceError={false}
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
              <PlanningHelp />

            </form>
          </aside></div></ManagementModal> : null}

        {detailCampaignId && !selectedCampaign && !inlineError ? <LoadingState title="กำลังโหลดรายละเอียดแคมเปญ" /> : null}
        {selectedCampaign && !showCreate ? (
          <section
            className={styles.detailPanel}
            aria-labelledby="campaign-detail-title"
          >
            <div className={styles.detailHeader}>
              <div className={styles.detailMeta}>
                <div className={styles.detailTitleRow}>
                  {standaloneDetail ? <h1 className={styles.detailPageTitle} id="campaign-detail-title">{selectedCampaign.name}</h1> :
                    <h2 className={styles.sectionTitle} id="campaign-detail-title">{selectedCampaign.name}</h2>}
                  <Badge tone={statusTone(selectedCampaign.status)}>
                    {campaignStatusLabel(selectedCampaign.status)}
                  </Badge>
                </div>
                {!standaloneDetail ? <div className={styles.metaRow}>
                  <span className={styles.meta}>ร้านค้า: {storeNames.get(selectedCampaign.storeId) ?? selectedCampaign.storeId}</span>
                  <span className={styles.meta}>รหัสแคมเปญ: {selectedCampaign.campaignId}</span>
                  <time className={styles.meta} dateTime={selectedCampaign.updatedAt}>
                    อัปเดตล่าสุด {formatIsoDateTime(selectedCampaign.updatedAt)}
                  </time>
                </div> : null}
              </div>
              {standaloneDetail ? null : detailCampaignId && fixedStoreId ? (
                <Link className={styles.detailLink} href={storeWorkspaceHref(organizationId, fixedStoreId, "campaigns")}>← กลับไปรายการแคมเปญ</Link>
              ) : (
              <Button
                variant="quiet"
                size="small"
                onClick={() => setSelectedCampaign(null)}
              >
                ปิดรายละเอียด
              </Button>
              )}
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

                  <form className={styles.form} onSubmit={handleSave} noValidate>
                    <ErrorSummary
                      id="campaign-edit-error-summary"
                      items={campaignErrorItems("campaign-edit", editErrors)}
                    />
                    {!fixedStoreId ? (<SelectField
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
                      announceError={false}
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
                    </SelectField>) : !standaloneDetail ? <p className={styles.sectionDescription}>ร้านค้า: {storeName ?? fixedStoreId}</p> : null}

                    <TextField
                      id="campaign-edit-name"
                      label="ชื่อแคมเปญ"
                      value={editValues.name}
                      onChange={(event) =>
                        updateEditField("name", event.target.value)
                      }
                      error={editErrors.name}
                      announceError={false}
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
                    <PlanningHelp />

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
                    compact={standaloneDetail}
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

                  <dl className={styles.scheduleGrid}>
                    <div className={styles.scheduleItem}>
                      <dt className={styles.scheduleLabel}>เปิดตามแผน</dt>
                      <dd className={styles.scheduleValue}>
                        <ScheduleValue value={selectedCampaign.openAt} />
                      </dd>
                    </div>
                    <div className={styles.scheduleItem}>
                      <dt className={styles.scheduleLabel}>ปิดตามแผน</dt>
                      <dd className={styles.scheduleValue}>
                        <ScheduleValue value={selectedCampaign.closeAt} />
                      </dd>
                    </div>
                    <div className={styles.scheduleItem}>
                      <dt className={styles.scheduleLabel}>กำหนดชำระเงิน</dt>
                      <dd className={styles.scheduleValue}>
                        <ScheduleValue value={selectedCampaign.paymentDeadline} />
                      </dd>
                    </div>
                    <div className={styles.scheduleItem}>
                      <dt className={styles.scheduleLabel}>วันรับสินค้า</dt>
                      <dd className={styles.scheduleValue}>
                        <ScheduleValue value={selectedCampaign.pickupAt} />
                      </dd>
                    </div>
                  </dl>
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
                    compact={standaloneDetail}
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
            {standaloneDetail ? <details className={styles.technicalDetails}>
              <summary>ข้อมูลระบบ</summary>
              <p>รหัสแคมเปญ: {selectedCampaign.campaignId}</p>
              <p>อัปเดตล่าสุด: <time dateTime={selectedCampaign.updatedAt}>
                {formatIsoDateTime(selectedCampaign.updatedAt)}</time></p>
            </details> : null}
          </section>
        ) : null}
      </main>
    </div>
  );
}
