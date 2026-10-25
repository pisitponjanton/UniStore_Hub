"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { LoadingState, Notice } from "@/components";
import { AuthenticatedShell, OrganizationBoundary, authSession, isDefinitiveSessionFailure } from "@/modules/auth";
import { ApiClientError } from "@/services";
import { storeService } from "./store-service";
import { validateStoreForm, storeStatusLabel } from "./store-helpers";
import { ProductManagementView } from "@/modules/products/product-view";
import { CampaignManagementView } from "@/modules/campaigns/campaign-view";
import type { StoreDTO } from "@/types";
import { getRequiredQueryId } from "@/utils";
import styles from "./store-workspace.module.css";

export type StoreTab = "products" | "campaigns" | "settings";
export function storeWorkspaceHref(organizationId: string, storeId: string, tab: StoreTab = "products") {
  return "/org/stores/view/?" +
    new URLSearchParams({ organizationId, storeId, tab }).toString();
}

export function productDetailHref(organizationId: string, storeId: string, productId: string) {
  return "/org/stores/product/?" + new URLSearchParams({ organizationId, storeId, productId }).toString();
}
export function campaignDetailHref(organizationId: string, storeId: string, campaignId: string) {
  return "/org/stores/campaign/?" + new URLSearchParams({ organizationId, storeId, campaignId }).toString();
}

function StoreSettings({ organizationId, store, onUpdate, onDirtyChange }: {
  organizationId: string; store: StoreDTO; onUpdate: (store: StoreDTO) => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [name, setName] = useState(store.name);
  const [description, setDescription] = useState(store.description);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const dirty = name !== store.name || description !== store.description;
  useEffect(() => {
    onDirtyChange(dirty);
    return () => onDirtyChange(false);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    const listener = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener("beforeunload", listener);
    return () => window.removeEventListener("beforeunload", listener);
  }, [dirty]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    const form = validateStoreForm({ name, description });
    if (!form.valid) { setError(form.errors.name ?? "ข้อมูลไม่ถูกต้อง"); return; }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const updated = await storeService.update(organizationId, store.storeId, form.values);
      onUpdate(updated);
      setMessage("บันทึกข้อมูลร้านค้าแล้ว");
    } catch (err) {
      if (isDefinitiveSessionFailure(err)) { authSession.logout(); return; }
      setError(err instanceof ApiClientError ? err.userMessage : "บันทึกไม่สำเร็จ กรุณาลองใหม่");
    } finally { setSaving(false); }
  }

  return (
    <form className={styles.form} onSubmit={save}>
      <h2>ข้อมูลร้านค้า</h2>
      {error ? <Notice tone="danger" role="alert" title="ไม่สามารถบันทึกได้">{error}</Notice> : null}
      {message ? <Notice tone="success" role="status" title="บันทึกเรียบร้อย">{message}</Notice> : null}
      <div className={styles.field}><label htmlFor="workspace-store-name">ชื่อร้านค้า</label>
        <input id="workspace-store-name" required value={name} disabled={saving}
          onChange={e => { setName(e.target.value); setError(""); }} /></div>
      <div className={styles.field}><label htmlFor="workspace-store-description">คำอธิบาย</label>
        <textarea id="workspace-store-description" value={description} disabled={saving}
          onChange={e => setDescription(e.target.value)} /></div>
      <div className={styles.formActions}><button type="submit" disabled={!dirty || saving}>
        {saving ? "กำลังบันทึก…" : "บันทึกการเปลี่ยนแปลง"}
      </button><span className={styles.message}>สถานะ: {storeStatusLabel(store.status)}</span></div>
    </form>
  );
}

export function StoreWorkspaceRoute() {
  const query = useSearchParams();
  const org = getRequiredQueryId(new URLSearchParams(query.toString()), "organizationId");
  const organizationId = org.ok ? org.value : null;
  const storeId = query.get("storeId")?.trim() || null;
  const rawTab = query.get("tab");
  const tab: StoreTab = rawTab === "campaigns" || rawTab === "settings" ? rawTab : "products";
  return (
    <OrganizationBoundary organizationId={organizationId} allowedRoles={["ORGANIZATION_ADMIN"]}>
      <AuthenticatedShell organizationId={organizationId}>
        {organizationId && storeId ? (
          <StoreWorkspaceContent key={organizationId + ":" + storeId}
            organizationId={organizationId} storeId={storeId} tab={tab}/>
        ) : organizationId ? (
          <main className={styles.page}>
            <p role="alert">กรุณาเลือกร้านค้าจากหน้ารายการร้านค้า</p>
            <Link className={styles.back} href={"/org/stores/?" + new URLSearchParams({ organizationId }).toString()}>
              กลับไปรายการร้านค้า
            </Link>
          </main>
        ) : null}
      </AuthenticatedShell>
    </OrganizationBoundary>
  );
}

function StoreWorkspaceContent({ organizationId, storeId, tab }: {
  organizationId: string; storeId: string; tab: StoreTab;
}) {
  const [store, setStore] = useState<StoreDTO | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const onDirtyChange = useCallback((dirty: boolean) => setHasUnsavedChanges(dirty), []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    storeService.get(organizationId, storeId, { signal: controller.signal })
      .then(result => {
        if (controller.signal.aborted) return;
        if (result.storeId !== storeId || result.organizationId !== organizationId) {
          setError("ร้านค้านี้ไม่ได้อยู่ในหน่วยงานที่เลือก");
        } else { setStore(result); }
      }).catch(err => {
        if (controller.signal.aborted) return;
        if (isDefinitiveSessionFailure(err)) { authSession.logout(); return; }
        setError(err instanceof ApiClientError ? err.userMessage : "ไม่สามารถโหลดร้านค้านี้ได้");
      }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [organizationId, storeId, retryCount]);

  const base = "/org/stores/?" + new URLSearchParams({ organizationId }).toString();

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const message = "คุณมีข้อมูลที่ยังไม่ได้บันทึก ต้องการออกจากหน้านี้และทิ้งข้อมูลหรือไม่?";
    const protectNavigation = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey ||
          event.shiftKey || event.altKey || !(event.target instanceof Element)) return;
      const link = event.target.closest<HTMLAnchorElement>("a[href]");
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const destination = new URL(link.href, window.location.href);
      const current = new URL(window.location.href);
      if (destination.href === current.href) return;
      if (!window.confirm(message)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const protectReload = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    document.addEventListener("click", protectNavigation, true);
    window.addEventListener("beforeunload", protectReload);
    return () => {
      document.removeEventListener("click", protectNavigation, true);
      window.removeEventListener("beforeunload", protectReload);
    };
  }, [hasUnsavedChanges]);
  const tabs: { value: StoreTab; label: string }[] = [
    { value: "products", label: "สินค้า" },
    { value: "campaigns", label: "แคมเปญ" }, { value: "settings", label: "ตั้งค่า" },
  ];
  if (loading) return <div className={styles.page}><LoadingState title="กำลังโหลดร้านค้า" /></div>;
  if (!store) return <main className={styles.page}>
    <div className={styles.errorView} data-page-status="error">
      <h1>จัดการร้านค้า</h1>
      <p role="alert">{error || "ไม่พบร้านค้า"}</p>
      <div className={styles.errorActions}>
        <button type="button" className={styles.retry} onClick={() => {
          setError(""); setLoading(true); setRetryCount(current => current + 1);
        }}>ลองใหม่</button>
        <Link href={base} className={styles.switch}><ArrowLeft size={16} aria-hidden="true"/> กลับไปรายการร้านค้า</Link>
      </div>
    </div>
  </main>;
  const content: Record<StoreTab, ReactNode> = {
    products: <ProductManagementView key={storeId} organizationId={organizationId}
      fixedStoreId={storeId} storeName={store.name} storeActive={store.status === "ACTIVE"}
      onDirtyChange={onDirtyChange}/>,
    campaigns: <CampaignManagementView key={storeId} organizationId={organizationId}
      fixedStoreId={storeId} storeName={store.name} storeActive={store.status === "ACTIVE"}
      onDirtyChange={onDirtyChange}/>,
    settings: <StoreSettings organizationId={organizationId} store={store} onUpdate={setStore} onDirtyChange={onDirtyChange} />,
  };
  return <div className={styles.page}>
    <Link href={base} className={styles.back}><ArrowLeft size={16} aria-hidden="true" /> ร้านค้าทั้งหมด</Link>
    <header className={styles.top}>
      <div className={styles.heading}><h1>{store.name}</h1>
        <div className={styles.subtitle}>
          <span>พื้นที่จัดการร้านค้า</span>
          {store.status === "INACTIVE" ? <span className={styles.inactive}>ปิดใช้งาน</span> : null}
        </div>
      </div>
      <Link href={base} className={styles.switch}><RefreshCw size={16} aria-hidden="true"/> เปลี่ยนร้านค้า</Link>
    </header>
    {store.status === "INACTIVE" ? (
      <p className={styles.inactiveNotice} role="status">
        ร้านค้านี้ปิดการแสดงผลสำหรับลูกค้า แต่ผู้ดูแลยังจัดการสินค้าและแคมเปญภายในร้านได้
      </p>
    ) : null}
    <nav aria-label="เมนูจัดการร้านค้า" className={styles.tabs}>
      {tabs.map(item => {
        const href=storeWorkspaceHref(organizationId, storeId, item.value);
        return <Link key={item.value} className={[styles.tab, tab === item.value ? styles.selected : ""].join(" ")}
          href={href} aria-current={tab === item.value ? "page" : undefined}>{item.label}</Link>;
      })}
    </nav>
    <div className={styles.content} data-store-workspace={storeId}>{content[tab]}</div>
  </div>;
}
