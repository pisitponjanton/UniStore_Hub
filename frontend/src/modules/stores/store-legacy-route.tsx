"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { LoadingState } from "@/components";
import { AuthenticatedShell, OrganizationBoundary, authSession, isDefinitiveSessionFailure } from "@/modules/auth";
import { ApiClientError } from "@/services";
import { getRequiredQueryId } from "@/utils";
import type { StoreDTO } from "@/types";
import { storeService } from "./store-service";
import { storeWorkspaceHref, type StoreTab } from "./store-workspace";
import styles from "./store-workspace.module.css";

export function LegacyStoreRoute({ tab }: { tab: Extract<StoreTab, "products" | "campaigns"> }) {
  const [params, setParams] = useState<{ organizationId: string | null; storeId: string | null } | null>(null);
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const org = getRequiredQueryId(query, "organizationId");
    const store = query.get("storeId");
    Promise.resolve().then(() => setParams({ organizationId: org.ok ? org.value : null, storeId: store?.trim() || null }));
  }, []);

  return !params ? <LoadingState title="กำลังตรวจสอบร้านค้า" /> :
    <OrganizationBoundary organizationId={params.organizationId} allowedRoles={["ORGANIZATION_ADMIN"]}>
      <AuthenticatedShell organizationId={params.organizationId}>
        {params.organizationId ? <LegacyStoreChooser organizationId={params.organizationId}
          storeId={params.storeId} tab={tab} /> : null}
      </AuthenticatedShell>
    </OrganizationBoundary>;
}

function LegacyStoreChooser({ organizationId, storeId, tab }: {
  organizationId: string; storeId: string | null; tab: "products" | "campaigns";
}) {
  const router = useRouter();
  const [stores, setStores] = useState<StoreDTO[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const operation = storeId
      ? storeService.get(organizationId, storeId, { signal: controller.signal }).then(store => {
          if (controller.signal.aborted) return;
          if (store.storeId !== storeId || store.organizationId !== organizationId) {
            setError("ร้านค้าที่ระบุไม่อยู่ในหน่วยงานนี้");
            return;
          }
          router.replace(storeWorkspaceHref(organizationId, storeId, tab));
        })
      : storeService.list(organizationId, { signal: controller.signal }).then(items => {
          if (!controller.signal.aborted) setStores(items);
        });
    operation.catch(err => {
      if (controller.signal.aborted) return;
      if (isDefinitiveSessionFailure(err)) { authSession.logout(); return; }
      setError(err instanceof ApiClientError ? err.userMessage : "โหลดรายการร้านค้าไม่สำเร็จ");
    });
    return () => controller.abort();
  }, [organizationId, storeId, tab, router]);

  const title = tab === "products" ? "สินค้า" : "แคมเปญ";
  return <main className={styles.page}>
    <div className={styles.heading}>
      <h1>เลือกร้านค้าสำหรับจัดการ{title}</h1>
      <p className={styles.message}>เลือกพื้นที่ร้านค้าก่อน เพื่อให้ระบบแสดงเฉพาะ{title}ของร้านนั้น</p>
    </div>
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    {!stores && !error ? <LoadingState title="กำลังโหลดร้านค้า" /> : null}
    {stores && stores.length === 0 ? <p className={styles.permission}>ยังไม่มีร้านค้าในหน่วยงานนี้</p> : null}
    {stores && stores.length > 0 ? <div className={styles.overview}>
      <div className={styles.shortcuts}>
        {stores.map(store => <Link key={store.storeId} className={styles.shortcut}
          href={storeWorkspaceHref(organizationId, store.storeId, tab)}>
          <strong>{store.name} <ArrowRight size={15} aria-hidden="true"/></strong>
          <span>{store.status === "INACTIVE" ? "ร้านค้าปิดใช้งาน" : "เปิดใช้งาน"}</span>
        </Link>)}
      </div>
    </div> : null}
    <Link className={styles.back} href={"/org/stores/?" + new URLSearchParams({ organizationId }).toString()}>
      กลับหน้าร้านค้า
    </Link>
  </main>;
}
