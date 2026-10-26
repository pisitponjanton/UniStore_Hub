"use client";


import Link from "next/link";
import { storeWorkspaceHref } from "./store-workspace";
import { ManagementModal } from "@/components/ui/management-modal";
import { ResilientImage } from "@/components/ui/resilient-image";
import { AsyncPageFallback } from "@/components/ui/async-page";
import { LoadedDirectoryControls } from "@/modules/organization-directory/loaded-directory-controls";
import { searchLoadedItems, visibleLoadedItems } from "@/modules/organization-directory/loaded-directory-helpers";

import { useEffect, useState, type FormEvent } from "react";

import {
  Badge,
  Button,
  EmptyState,
  ErrorSummary,
  useErrorSummaryFocus,
  Notice,
  TextareaField,
  TextField,
} from "@/components";
import {
  authSession,
  isDefinitiveSessionFailure,
} from "@/modules/auth";
import { ApiClientError } from "@/services";
import type { StoreDTO } from "@/types";
import { formatIsoDateTime } from "@/utils";

import {
  storeStatusLabel,
  validateStoreForm,
} from "./store-helpers";
import { storeService } from "./store-service";
import { StoreCoverField } from "./store-cover-field";
import { uploadStoreImage } from "./store-image-upload";
import styles from "./store-view.module.css";

type StoreState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "success"; stores: StoreDTO[] };

function statusTone(status: StoreDTO["status"]): "success" | "neutral" {
  return status === "ACTIVE" ? "success" : "neutral";
}

function operationErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.code === "STORE_NOT_FOUND") {
      return "ไม่พบร้านค้านี้แล้ว กรุณารีเฟรชรายการ";
    }

    return error.userMessage;
  }

  return "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง";
}
export function StoreManagementView({
  organizationId,
}: {
  organizationId: string;
}) {
  const focusErrorSummary = useErrorSummaryFocus();
  const [directoryQuery, setDirectoryQuery] = useState("");
  const [directoryLimit, setDirectoryLimit] = useState(24);
  const [state, setState] = useState<StoreState>({ status: "loading" });

  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createNameError, setCreateNameError] = useState<string | undefined>();
  const [creating, setCreating] = useState(false);
  const [createFile, setCreateFile] = useState<File | null>(null);
  const [createImageError, setCreateImageError] = useState("");

  const [inlineError, setInlineError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const stores = await storeService.list(organizationId, {
          signal: controller.signal,
        });

        if (!controller.signal.aborted) {
          setState({ status: "success", stores });
        }
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

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (creating) {
      return;
    }

    const validation = validateStoreForm({
      name: createName,
      description: createDescription,
    });

    setCreateNameError(validation.errors.name);
    setInlineError(null);
    setNotice(null);

    if (!validation.valid) {
      focusErrorSummary("store-create-error-summary");
      return;
    }

    setCreating(true);

    try {
      const created = await storeService.create(organizationId, validation.values);
      let displayedStore = created;
      let imageFailure: string | null = null;
      if (createFile) {
        try { displayedStore = await uploadStoreImage(organizationId, created.storeId, createFile); }
        catch (error) {
          imageFailure = error instanceof ApiClientError ? error.userMessage
            : error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการอัปโหลด";
        }
      }

      setState((current) =>
        current.status === "success"
          ? {
              status: "success",
              stores: [displayedStore, ...current.stores],
            }
          : current,
      );
      setCreateName("");
      setCreateDescription("");
      setCreateFile(null);
      setCreateImageError("");
      setNotice(imageFailure
        ? `สร้างร้านค้า ${created.name} สำเร็จ แต่รูปหน้าร้านยังไม่ถูกบันทึก: ${imageFailure} สามารถลองใหม่ได้ที่แท็บตั้งค่า`
        : `สร้างร้านค้า ${created.name} แล้ว`);
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

  if (state.status !== "success") {
    return (
      <div className={styles.page}>
        <main className={styles.stateWrap}>
          <AsyncPageFallback
            status={state.status}
            pageTitle="ร้านค้า"
            pageDescription="ดูสถานะและจัดการร้านค้าของหน่วยงาน"
            loadingTitle="กำลังโหลดร้านค้า"
            errorTitle="ไม่สามารถโหลดร้านค้าได้"
            backHref="/org/select/"
            backLabel="กลับไปพื้นที่ทำงาน"
          />
        </main>
      </div>
    );
  }

  const activeCount = state.stores.filter(
    (store) => store.status === "ACTIVE",
  ).length;
  const inactiveCount = state.stores.length - activeCount;
  const createDirty = Boolean(createName.trim() || createDescription.trim() || createFile);

  function closeCreate() {
    setShowCreate(false);
    setCreateName("");
    setCreateDescription("");
    setCreateNameError(undefined);
    setCreateFile(null);
    setCreateImageError("");
    setInlineError(null);
  }

  const directoryMatches = searchLoadedItems(state.stores, directoryQuery, store => [store.name, store.description, store.storeId, store.status]);
  const directoryVisible = visibleLoadedItems(directoryMatches, directoryLimit);

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.header}>
          <div className={styles.headerCopy}>
            <h1 className={styles.title}>ร้านค้า</h1>
            <p className={styles.description}>
              จัดการพื้นที่ขายภายในหน่วยงาน และกำหนดว่าร้านค้าใดพร้อมใช้งาน
            </p>
          </div>
          <Button onClick={() => setShowCreate(true)}>+ สร้างร้านค้า</Button>
        </header>

        {state.stores.length > 0 ? <section className={styles.summaryStrip} aria-label="สรุปร้านค้า">
          <div>
            <span className={styles.summaryLabel}>ร้านค้าทั้งหมด</span>
            <strong>{state.stores.length}</strong>
          </div>
          <div>
            <span className={styles.summaryLabel}>เปิดใช้งาน</span>
            <strong>{activeCount}</strong>
          </div>
          <div>
            <span className={styles.summaryLabel}>ปิดใช้งาน</span>
            <strong>{inactiveCount}</strong>
          </div>
        </section> : null}

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

        <div className={styles.grid}>
          <section className={styles.section} aria-labelledby="store-list">
            <div className={styles.sectionHeading}>
              <div>
                <h2 className={styles.sectionTitle} id="store-list">
                  ร้านค้าในหน่วยงาน
                </h2>
                <p className={styles.sectionDescription}>
                  ร้านค้าที่ปิดใช้งานจะไม่พร้อมสำหรับการใช้งานตามสถานะปัจจุบัน
                </p>
              </div>
              <span className={styles.sectionMeta}>
                {state.stores.length.toLocaleString("th-TH")} รายการ
              </span>
            </div>

          {state.stores.length > 0 ? <LoadedDirectoryControls
            id="stores-directory-search"
            label="ค้นหาร้านค้า"
            query={directoryQuery}
            onQueryChange={value => { setDirectoryQuery(value); setDirectoryLimit(24); }}
            loadedCount={state.stores.length}
            matchingCount={directoryMatches.length}
            visibleCount={directoryVisible.length}
            onShowMore={() => setDirectoryLimit(limit => limit + 24)}
          /> : null}

            {state.stores.length === 0 ? (
              <EmptyState
                title="ยังไม่มีร้านค้า"
                description="กดสร้างร้านค้าเพื่อเพิ่มร้านค้าแรกของหน่วยงาน"
              />
            ) : (
              <div className={styles.list}>
                {directoryVisible.map((store) => {
                  return (
                    <article
                      className={styles.row}
                      key={store.storeId}
                    >
                      <div className={styles.storeMedia}>
                        <ResilientImage
                          src={store.imageUrl}
                          alt={`รูปหน้าร้าน ${store.name}`}
                          className={styles.storeImage}
                          fallback={<span className={styles.storeFallback}>ยังไม่มีรูปหน้าร้าน</span>}
                        />
                      </div>
                      <div className={styles.rowMain}>
                        <div className={styles.rowHeading}>
                          <h3 className={styles.cardTitle}>{store.name}</h3>
                          <Badge tone={statusTone(store.status)}>
                            {storeStatusLabel(store.status)}
                          </Badge>
                        </div>
                        <p className={styles.cardDescription}>
                          {store.description || "ยังไม่มีคำอธิบายร้านค้า"}
                        </p>
                        <time className={styles.meta} dateTime={store.updatedAt}>
                          อัปเดตล่าสุด {formatIsoDateTime(store.updatedAt)}
                        </time>
                      </div>

                      <div className={styles.cardActions}>
                        <Link className={styles.openWorkspace} href={storeWorkspaceHref(organizationId, store.storeId)}>
                          จัดการร้านค้า
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {showCreate ? <ManagementModal title="สร้างร้านค้าใหม่" description="เพิ่มร้านค้าสำหรับจำหน่ายสินค้าภายในหน่วยงาน"
            size="small" formId="store-create-form"
            submitLabel="สร้างร้านค้า" submitting={creating}
            dirty={createDirty} onClose={closeCreate}><div className={styles.modalContents}>
            {inlineError ? <Notice tone="danger" role="alert" title="ดำเนินการไม่สำเร็จ">{inlineError}</Notice> : null}
            <aside className={styles.panel}>
            <form id="store-create-form" className={styles.form} onSubmit={handleCreate} noValidate>
              <ErrorSummary
                id="store-create-error-summary"
                items={
                  createNameError
                    ? [{ fieldId: "store-create-name", message: createNameError }]
                    : []
                }
              />
              <TextField
                id="store-create-name"
                label="ชื่อร้านค้า"
                value={createName}
                onChange={(event) => {
                  setCreateName(event.target.value);
                  setCreateNameError(undefined);
                  setInlineError(null);
                }}
                error={createNameError}
                announceError={false}
                required
                disabled={creating}
              />

              <TextareaField
                id="store-create-description"
                label="คำอธิบาย"
                value={createDescription}
                onChange={(event) => {
                  setCreateDescription(event.target.value);
                  setInlineError(null);
                }}
                disabled={creating}
              />
              <StoreCoverField id="store-create-cover" file={createFile}
                onFileChange={setCreateFile} error={createImageError} onError={setCreateImageError}
                disabled={creating} />
            </form>
          </aside></div></ManagementModal> : null}
        </div>

      </main>
    </div>
  );
}
