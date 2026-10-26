"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { LoadingState, Notice, ConfirmDialog, Button } from "@/components";
import { AuthenticatedShell, OrganizationBoundary, authSession, isDefinitiveSessionFailure } from "@/modules/auth";
import { ApiClientError } from "@/services";
import { storeService } from "./store-service";
import { validateStoreForm, storeStatusLabel, toggledStoreStatus } from "./store-helpers";
import { StoreCoverField } from "./store-cover-field";
import { uploadStoreImage } from "./store-image-upload";
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
  const [file, setFile] = useState<File | null>(null);
  const [imageError, setImageError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const dirty = name !== store.name || description !== store.description;
  const busy = saving || uploading || changingStatus;
  const nextStatus = toggledStoreStatus(store.status);
  useEffect(() => {
    onDirtyChange(dirty || Boolean(file));
    return () => onDirtyChange(false);
  }, [dirty, file, onDirtyChange]);

  useEffect(() => {
    const listener = (event: BeforeUnloadEvent) => {
      if (dirty || file) event.preventDefault();
    };
    window.addEventListener("beforeunload", listener);
    return () => window.removeEventListener("beforeunload", listener);
  }, [dirty, file]);

  function reportError(err: unknown, fallback: string) {
    if (isDefinitiveSessionFailure(err)) { authSession.logout(); return; }
    setError(err instanceof ApiClientError ? err.userMessage : err instanceof Error ? err.message : fallback);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy || !dirty) return;
    const form = validateStoreForm({ name, description });
    if (!form.valid) { setError(form.errors.name ?? "ข้อมูลไม่ถูกต้อง"); return; }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const updated = await storeService.update(organizationId, store.storeId, form.values);
      onUpdate(updated);
      setName(updated.name);
      setDescription(updated.description);
      setMessage("บันทึกข้อมูลร้านค้าแล้ว");
    } catch (err) { reportError(err, "บันทึกไม่สำเร็จ กรุณาลองใหม่"); }
    finally { setSaving(false); }
  }

  async function saveCover() {
    if (busy || !file) return;
    setUploading(true);
    setError("");
    setMessage("");
    try {
      const updated = await uploadStoreImage(organizationId, store.storeId, file);
      onUpdate(updated);
      setFile(null);
      setImageError("");
      setMessage("อัปโหลดรูปหน้าร้านแล้ว");
    } catch (err) { reportError(err, "ไม่สามารถอัปโหลดรูปได้ กรุณาลองอีกครั้ง"); }
    finally { setUploading(false); }
  }

  async function toggleStatus() {
    if (busy || dirty || file) return;
    setChangingStatus(true);
    setError("");
    setMessage("");
    try {
      const updated = await storeService.update(organizationId, store.storeId, { status: nextStatus });
      onUpdate(updated);
      setStatusDialogOpen(false);
      setMessage(nextStatus === "ACTIVE" ? "เปิดใช้งานร้านแล้ว" : "ปิดใช้งานร้านแล้ว");
    } catch (err) { reportError(err, "เปลี่ยนสถานะร้านไม่สำเร็จ"); }
    finally { setChangingStatus(false); }
  }

  return <div className={styles.settings}>
    <header className={styles.settingsHeading}>
      <div>
        <h2>ตั้งค่าร้านค้า</h2>
        <p>จัดการรูปปกและข้อมูลที่ลูกค้าจะเห็นในร้าน</p>
      </div>
      <span className={styles.statusLabel}>{storeStatusLabel(store.status)}</span>
    </header>

    {error ? <Notice tone="danger" role="alert" title="ดำเนินการไม่สำเร็จ">{error}</Notice> : null}
    {message ? <p className={styles.inlineNotice} role="status">{message}</p> : null}

    <section className={styles.coverSection} aria-labelledby="store-cover-title">
      <div className={styles.settingsSectionHeading}>
        <div>
          <h3 id="store-cover-title">รูปหน้าร้าน</h3>
          <p>รูปปกหน้าร้านสัดส่วน 16:9 แสดงให้ลูกค้าเห็นในหน้าร้าน</p>
        </div>
        <span className={styles.imageRequirement}>JPG, PNG, WebP · สูงสุด 5 MiB</span>
      </div>
      <StoreCoverField id="workspace-store-cover" file={file} store={store}
        disabled={busy} onFileChange={setFile} error={imageError} onError={setImageError} />
      <div className={styles.coverActions}>
        <Button onClick={() => void saveCover()} disabled={!file || busy}>
          {uploading ? "กำลังอัปโหลด…" : "บันทึกรูปหน้าร้าน"}
        </Button>
      </div>
    </section>

    <form className={styles.settingsForm} onSubmit={save}>
      <div className={styles.settingsSectionHeading}>
        <div>
          <h3>ข้อมูลร้านค้า</h3>
          <p>แก้ไขชื่อร้านและคำอธิบายที่แสดงต่อลูกค้า</p>
        </div>
      </div>
      <div className={styles.field}>
        <label htmlFor="workspace-store-name">ชื่อร้านค้า</label>
        <input id="workspace-store-name" required value={name} disabled={busy}
          onChange={e => { setName(e.target.value); setError(""); }} />
      </div>
      <div className={styles.field}>
        <label htmlFor="workspace-store-description">คำอธิบาย</label>
        <textarea id="workspace-store-description" value={description} disabled={busy}
          onChange={e => setDescription(e.target.value)} />
      </div>
      <div className={styles.formActions}>
        <button type="submit" disabled={!dirty || busy}>
          {saving ? "กำลังบันทึก…" : "บันทึกข้อมูล"}
        </button>
      </div>
    </form>

    <section className={styles.statusSection} aria-label="สถานะร้านค้า">
      <div>
        <h3>สถานะร้านค้า</h3>
        <p>ร้านที่ปิดใช้งานจะไม่ปรากฏให้ลูกค้าเข้าชม แต่ข้อมูลสินค้าและแคมเปญยังอยู่</p>
      </div>
      <ConfirmDialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}
        trigger={<Button variant={nextStatus === "INACTIVE" ? "danger" : "secondary"}
          disabled={busy || dirty || Boolean(file)}>
          {nextStatus === "ACTIVE" ? "เปิดใช้งานร้าน" : "ปิดใช้งานร้าน"}
        </Button>}
        title={nextStatus === "ACTIVE" ? "ยืนยันเปิดใช้งานร้าน" : "ยืนยันปิดใช้งานร้าน"}
        description={nextStatus === "ACTIVE"
          ? `เปิดร้าน ${store.name} ให้ลูกค้าเข้าชมหรือไม่?`
          : `ปิดร้าน ${store.name} ไม่ให้ลูกค้าเข้าชมชั่วคราวหรือไม่?`}
        confirmLabel={nextStatus === "ACTIVE" ? "เปิดใช้งาน" : "ปิดใช้งาน"}
        danger={nextStatus === "INACTIVE"}
        pending={changingStatus}
        onConfirm={() => void toggleStatus()}
      />
    </section>
  </div>;
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
