"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AuthenticatedShell, OrganizationBoundary, authSession, isDefinitiveSessionFailure } from "@/modules/auth";
import { LoadingState } from "@/components";
import { ApiClientError } from "@/services";
import { ProductManagementView } from "@/modules/products/product-view";
import { CampaignManagementView } from "@/modules/campaigns/campaign-view";
import type { StoreDTO } from "@/types";
import { getRequiredQueryId } from "@/utils";
import { storeService } from "./store-service";
import { storeWorkspaceHref } from "./store-workspace";
import styles from "./store-detail-route.module.css";

type DetailType = "product" | "campaign";

export function StoreDetailRoute({ type }: { type: DetailType }) {
  const query = useSearchParams();
  const org = getRequiredQueryId(new URLSearchParams(query.toString()), "organizationId");
  const organizationId = org.ok ? org.value : null;
  const storeId = query.get("storeId")?.trim() || null;
  const detailId = query.get(type === "product" ? "productId" : "campaignId")?.trim() || null;
  const listing = organizationId && storeId
    ? storeWorkspaceHref(organizationId, storeId, type === "product" ? "products" : "campaigns")
    : organizationId ? "/org/stores/?" + new URLSearchParams({ organizationId }).toString() : "/org/select/";
  return <OrganizationBoundary organizationId={organizationId} allowedRoles={["ORGANIZATION_ADMIN"]}>
    <AuthenticatedShell organizationId={organizationId}>
      {organizationId && storeId && detailId
        ? <DetailContent key={organizationId + ":" + storeId + ":" + detailId}
            type={type} organizationId={organizationId} storeId={storeId} detailId={detailId} listing={listing} />
        : <main className={styles.page}>
            <p role="alert">ลิงก์รายละเอียดไม่สมบูรณ์ กรุณากลับไปเลือก{type === "product" ? "สินค้า" : "แคมเปญ"}อีกครั้ง</p>
            <Link href={listing} className={styles.back}><ArrowLeft size={17} /> กลับไปรายการ</Link>
          </main>}
    </AuthenticatedShell>
  </OrganizationBoundary>;
}

function DetailContent({ type, organizationId, storeId, detailId, listing }: {
  type: DetailType; organizationId: string; storeId: string; detailId: string; listing: string;
}) {
  const [store, setStore] = useState<StoreDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [dirty, setDirty] = useState(false);
  const onDirtyChange = useCallback((value: boolean) => setDirty(value), []);
  useEffect(() => {
    const controller = new AbortController();
    storeService.get(organizationId, storeId, { signal: controller.signal }).then(value => {
      if (controller.signal.aborted) return;
      if (value.organizationId !== organizationId || value.storeId !== storeId) {
        setError("ร้านค้านี้ไม่ได้อยู่ในหน่วยงานที่เลือก");
        return;
      }
      setStore(value);
    }).catch(err => {
      if (controller.signal.aborted) return;
      if (isDefinitiveSessionFailure(err)) { authSession.logout(); return; }
      setError(err instanceof ApiClientError ? err.userMessage : "โหลดร้านค้าไม่สำเร็จ");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [organizationId, storeId, retry]);

  useEffect(() => {
    if (!dirty) return;
    const preventNavigate = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey ||
        event.shiftKey || event.altKey || !(event.target instanceof Element)) return;
      const link = event.target.closest<HTMLAnchorElement>("a[href]");
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      if (new URL(link.href, location.href).href === location.href) return;
      if (!window.confirm("มีข้อมูลที่ยังไม่ได้บันทึก ต้องการออกจากหน้านี้หรือไม่?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    document.addEventListener("click", preventNavigate, true);
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      document.removeEventListener("click", preventNavigate, true);
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [dirty]);

  if (loading) return <main className={styles.page}><LoadingState title="กำลังโหลดรายละเอียด" /></main>;
  if (!store) return <main className={styles.page}>
    <p role="alert">{error || "ไม่พบร้านค้า"}</p>
    <div className={styles.errorActions}>
      <button type="button" onClick={() => { setError(null); setLoading(true); setRetry(x => x + 1); }}>ลองใหม่</button>
      <Link className={styles.back} href={listing}><ArrowLeft size={17} /> กลับไปรายการ</Link>
    </div>
  </main>;
  return <div className={styles.page} data-detail-page={type}>
    <nav aria-label="กลับไปหน้ารายการ" className={styles.breadcrumb}>
      <Link href={listing} className={styles.back}><ArrowLeft size={17} aria-hidden="true"/>
        กลับไปรายการ{type === "product" ? "สินค้า" : "แคมเปญ"}
      </Link>
      <span aria-hidden="true">/</span>
      <span className={styles.storeName}>{store.name}</span>
    </nav>
    {type === "product"
      ? <ProductManagementView organizationId={organizationId} fixedStoreId={storeId} storeName={store.name}
          storeActive={store.status === "ACTIVE"} detailProductId={detailId} standaloneDetail
          onDirtyChange={onDirtyChange} />
      : <CampaignManagementView organizationId={organizationId} fixedStoreId={storeId} storeName={store.name}
          storeActive={store.status === "ACTIVE"} detailCampaignId={detailId} standaloneDetail
          onDirtyChange={onDirtyChange} />}
  </div>;
}
