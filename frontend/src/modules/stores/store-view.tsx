"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  ErrorSummary,
  LoadingState,
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
  toggledStoreStatus,
  validateStoreForm,
} from "./store-helpers";
import { storeService } from "./store-service";
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
  const [state, setState] = useState<StoreState>({ status: "loading" });

  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createNameError, setCreateNameError] = useState<string | undefined>();
  const [creating, setCreating] = useState(false);

  const [selectedStore, setSelectedStore] = useState<StoreDTO | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editNameError, setEditNameError] = useState<string | undefined>();
  const [loadingStoreId, setLoadingStoreId] = useState<string | null>(null);
  const [savingStoreId, setSavingStoreId] = useState<string | null>(null);
  const [statusStoreId, setStatusStoreId] = useState<string | null>(null);

  const [inlineError, setInlineError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const createErrorSummaryRef = useRef<HTMLDivElement>(null);
  const editErrorSummaryRef = useRef<HTMLDivElement>(null);

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
      requestAnimationFrame(() => createErrorSummaryRef.current?.focus());
      return;
    }

    setCreating(true);

    try {
      const created = await storeService.create(
        organizationId,
        validation.values,
      );

      setState((current) =>
        current.status === "success"
          ? {
              status: "success",
              stores: [created, ...current.stores],
            }
          : current,
      );
      setCreateName("");
      setCreateDescription("");
      setNotice(`สร้างร้านค้า ${created.name} แล้ว`);
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

  async function handleEdit(store: StoreDTO) {
    if (loadingStoreId || savingStoreId || statusStoreId) {
      return;
    }

    setLoadingStoreId(store.storeId);
    setInlineError(null);
    setNotice(null);

    try {
      const fresh = await storeService.get(
        organizationId,
        store.storeId,
      );

      setSelectedStore(fresh);
      setEditName(fresh.name);
      setEditDescription(fresh.description);
      setEditNameError(undefined);
    } catch (error) {
      if (isDefinitiveSessionFailure(error)) {
        authSession.logout();
        return;
      }

      setInlineError(operationErrorMessage(error));
    } finally {
      setLoadingStoreId(null);
    }
  }

  async function handleSaveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedStore || savingStoreId) {
      return;
    }

    const validation = validateStoreForm({
      name: editName,
      description: editDescription,
    });

    setEditNameError(validation.errors.name);
    setInlineError(null);
    setNotice(null);

    if (!validation.valid) {
      requestAnimationFrame(() => editErrorSummaryRef.current?.focus());
      return;
    }

    setSavingStoreId(selectedStore.storeId);

    try {
      const updated = await storeService.update(
        organizationId,
        selectedStore.storeId,
        validation.values,
      );

      setState((current) =>
        current.status === "success"
          ? {
              status: "success",
              stores: current.stores.map((store) =>
                store.storeId === updated.storeId ? updated : store,
              ),
            }
          : current,
      );
      setSelectedStore(updated);
      setEditName(updated.name);
      setEditDescription(updated.description);
      setNotice(`บันทึกข้อมูลร้านค้า ${updated.name} แล้ว`);
    } catch (error) {
      if (isDefinitiveSessionFailure(error)) {
        authSession.logout();
        return;
      }

      setInlineError(operationErrorMessage(error));
    } finally {
      setSavingStoreId(null);
    }
  }

  async function handleToggleStatus(store: StoreDTO) {
    if (statusStoreId || savingStoreId || loadingStoreId) {
      return;
    }

    const nextStatus = toggledStoreStatus(store.status);

    setStatusStoreId(store.storeId);
    setInlineError(null);
    setNotice(null);

    try {
      const updated = await storeService.update(
        organizationId,
        store.storeId,
        { status: nextStatus },
      );

      setState((current) =>
        current.status === "success"
          ? {
              status: "success",
              stores: current.stores.map((item) =>
                item.storeId === updated.storeId ? updated : item,
              ),
            }
          : current,
      );

      if (selectedStore?.storeId === updated.storeId) {
        setSelectedStore(updated);
      }

      setNotice(
        `${nextStatus === "ACTIVE" ? "เปิด" : "ปิด"}ใช้งานร้านค้า ${updated.name} แล้ว`,
      );
    } catch (error) {
      if (isDefinitiveSessionFailure(error)) {
        authSession.logout();
        return;
      }

      setInlineError(operationErrorMessage(error));
    } finally {
      setStatusStoreId(null);
    }
  }

  if (state.status !== "success") {
    return (
      <div className={styles.page}>
        <main className={styles.stateWrap}>
          {state.status === "loading" ? (
            <LoadingState
              title="กำลังโหลดร้านค้า"
              description="กำลังดึงร้านค้าและสถานะล่าสุดของหน่วยงาน"
            />
          ) : (
            <ErrorState
              title="ไม่สามารถโหลดร้านค้าได้"
              description="กรุณาลองโหลดหน้านี้ใหม่อีกครั้ง"
            />
          )}
        </main>
      </div>
    );
  }

  const activeCount = state.stores.filter(
    (store) => store.status === "ACTIVE",
  ).length;
  const inactiveCount = state.stores.length - activeCount;
  const editDirty =
    selectedStore !== null &&
    (editName !== selectedStore.name ||
      editDescription !== selectedStore.description);

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
        </header>

        <section className={styles.summaryStrip} aria-label="สรุปร้านค้า">
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
        </section>

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

            {state.stores.length === 0 ? (
              <EmptyState
                title="ยังไม่มีร้านค้า"
                description="สร้างร้านค้าแรกจากแบบฟอร์มด้านข้าง"
              />
            ) : (
              <div className={styles.list}>
                {state.stores.map((store) => {
                  const loading = loadingStoreId === store.storeId;
                  const changingStatus = statusStoreId === store.storeId;
                  const busy =
                    loading ||
                    changingStatus ||
                    savingStoreId === store.storeId;
                  const nextStatus = toggledStoreStatus(store.status);
                  const selected = selectedStore?.storeId === store.storeId;

                  return (
                    <article
                      className={[
                        styles.row,
                        selected ? styles.rowSelected : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      key={store.storeId}
                      aria-current={selected ? "true" : undefined}
                    >
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
                        <Button
                          variant="secondary"
                          pending={loading}
                          pendingLabel="กำลังโหลด"
                          disabled={busy}
                          onClick={() => {
                            void handleEdit(store);
                          }}
                        >
                          {selected ? "กำลังแก้ไข" : "แก้ไขข้อมูล"}
                        </Button>

                        <ConfirmDialog
                          trigger={
                            <Button
                              variant={
                                nextStatus === "ACTIVE"
                                  ? "secondary"
                                  : "danger"
                              }
                              disabled={busy}
                            >
                              {nextStatus === "ACTIVE"
                                ? "เปิดใช้งาน"
                                : "ปิดใช้งาน"}
                            </Button>
                          }
                          title={
                            nextStatus === "ACTIVE"
                              ? "ยืนยันการเปิดใช้งานร้านค้า"
                              : "ยืนยันการปิดใช้งานร้านค้า"
                          }
                          description={
                            nextStatus === "ACTIVE"
                              ? `เปิดใช้งานร้านค้า ${store.name} ใช่หรือไม่`
                              : `ปิดใช้งานร้านค้า ${store.name} ใช่หรือไม่ สถานะนี้อาจทำให้ร้านค้าไม่พร้อมแสดงในหน้าลูกค้า`
                          }
                          confirmLabel={
                            nextStatus === "ACTIVE"
                              ? "เปิดใช้งาน"
                              : "ปิดใช้งาน"
                          }
                          danger={nextStatus === "INACTIVE"}
                          pending={changingStatus}
                          onConfirm={() => {
                            void handleToggleStatus(store);
                          }}
                        />
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <aside className={styles.panel}>
            <div className={styles.panelHeading}>
              <h2 className={styles.sectionTitle}>สร้างร้านค้าใหม่</h2>
              <p className={styles.sectionDescription}>
                ร้านค้าใหม่จะพร้อมใช้งานทันทีหลังสร้างสำเร็จ
              </p>
            </div>

            <form className={styles.form} onSubmit={handleCreate} noValidate>
              <ErrorSummary
                ref={createErrorSummaryRef}
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
                onBlur={() => {
                  const validation = validateStoreForm({
                    name: createName,
                    description: createDescription,
                  });
                  setCreateNameError(validation.errors.name);
                }}
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

              <Button
                type="submit"
                size="large"
                pending={creating}
                pendingLabel="กำลังสร้างร้านค้า"
              >
                สร้างร้านค้า
              </Button>
            </form>
          </aside>
        </div>

        {selectedStore ? (
          <section className={styles.editPanel} aria-labelledby="store-edit-title">
            <div className={styles.editHeader}>
              <div className={styles.editMeta}>
                <div className={styles.editTitleRow}>
                  <h2 className={styles.sectionTitle} id="store-edit-title">
                    แก้ไข {selectedStore.name}
                  </h2>
                  <Badge tone={statusTone(selectedStore.status)}>
                    {storeStatusLabel(selectedStore.status)}
                  </Badge>
                </div>
                <span className={styles.meta}>
                  รหัสร้านค้า: {selectedStore.storeId}
                </span>
              </div>
              <Button
                variant="quiet"
                size="small"
                onClick={() => setSelectedStore(null)}
              >
                ปิดส่วนแก้ไข
              </Button>
            </div>

            <form className={styles.editForm} onSubmit={handleSaveEdit} noValidate>
              <ErrorSummary
                ref={editErrorSummaryRef}
                id="store-edit-error-summary"
                items={
                  editNameError
                    ? [{ fieldId: "store-edit-name", message: editNameError }]
                    : []
                }
              />
              <TextField
                id="store-edit-name"
                label="ชื่อร้านค้า"
                value={editName}
                onChange={(event) => {
                  setEditName(event.target.value);
                  setEditNameError(undefined);
                }}
                error={editNameError}
                announceError={false}
                onBlur={() => {
                  const validation = validateStoreForm({
                    name: editName,
                    description: editDescription,
                  });
                  setEditNameError(validation.errors.name);
                }}
                required
                disabled={savingStoreId === selectedStore.storeId}
              />

              <TextareaField
                id="store-edit-description"
                label="คำอธิบาย"
                value={editDescription}
                onChange={(event) => setEditDescription(event.target.value)}
                disabled={savingStoreId === selectedStore.storeId}
              />

              <div className={styles.editActions}>
                <Button
                  type="submit"
                  pending={savingStoreId === selectedStore.storeId}
                  pendingLabel="กำลังบันทึก"
                  disabled={!editDirty}
                >
                  บันทึกข้อมูล
                </Button>
                {!editDirty ? (
                  <span className={styles.meta}>ยังไม่มีข้อมูลที่เปลี่ยนแปลง</span>
                ) : null}
              </div>
            </form>
          </section>
        ) : null}
      </main>
    </div>
  );
}
