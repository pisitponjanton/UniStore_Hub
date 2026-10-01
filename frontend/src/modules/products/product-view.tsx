"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  Notice,
  SelectField,
  TextareaField,
  TextField,
} from "@/components";
import {
  authSession,
  isDefinitiveSessionFailure,
} from "@/modules/auth";
import { storeService } from "@/modules/stores";
import { ApiClientError } from "@/services";
import type {
  Cursor,
  ProductDTO,
  StoreDTO,
} from "@/types";
import { formatIsoDateTime } from "@/utils";

import {
  productStatusLabel,
  validateProductForm,
} from "./product-helpers";
import { ProductImageUploadView } from "./product-image-upload-view";
import { productService } from "./product-service";
import { VariantManagement } from "./variant-management";
import styles from "./product-view.module.css";

type ProductState =
  | { status: "loading" }
  | { status: "error" }
  | {
      status: "success";
      products: ProductDTO[];
      stores: StoreDTO[];
      nextCursor: Cursor | null;
    };

function statusTone(
  status: ProductDTO["status"],
): "success" | "neutral" {
  return status === "ACTIVE" ? "success" : "neutral";
}

function operationErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.code === "PRODUCT_NOT_FOUND") {
      return "ไม่พบสินค้านี้แล้ว กรุณารีเฟรชรายการ";
    }

    if (error.code === "STORE_NOT_FOUND") {
      return "ไม่พบร้านค้าที่เลือกแล้ว กรุณารีเฟรชรายการร้านค้า";
    }

    return error.userMessage;
  }

  return "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง";
}

export function ProductManagementView({
  organizationId,
}: {
  organizationId: string;
}) {
  const [state, setState] = useState<ProductState>({
    status: "loading",
  });
  const [filterStoreId, setFilterStoreId] = useState("");
  const [listLoading, setListLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [createStoreId, setCreateStoreId] = useState("");
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createStoreError, setCreateStoreError] = useState<
    string | undefined
  >();
  const [createNameError, setCreateNameError] = useState<
    string | undefined
  >();
  const [creating, setCreating] = useState(false);

  const [selectedProduct, setSelectedProduct] =
    useState<ProductDTO | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editNameError, setEditNameError] = useState<
    string | undefined
  >();
  const [loadingProductId, setLoadingProductId] =
    useState<string | null>(null);
  const [savingProductId, setSavingProductId] =
    useState<string | null>(null);
  const [deactivatingProductId, setDeactivatingProductId] =
    useState<string | null>(null);

  const [inlineError, setInlineError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const [stores, products] = await Promise.all([
          storeService.list(organizationId, {
            signal: controller.signal,
          }),
          productService.list(organizationId, {
            signal: controller.signal,
          }),
        ]);

        if (!controller.signal.aborted) {
          setState({
            status: "success",
            stores,
            products: products.items,
            nextCursor: products.nextCursor,
          });

          const firstActiveStore =
            stores.find((store) => store.status === "ACTIVE") ??
            stores[0];

          setCreateStoreId(firstActiveStore?.storeId ?? "");
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

  const storeNames = useMemo(() => {
    if (state.status !== "success") {
      return new Map<string, string>();
    }

    return new Map(
      state.stores.map((store) => [store.storeId, store.name]),
    );
  }, [state]);

  async function replaceProductList(storeId: string) {
    if (state.status !== "success" || listLoading) {
      return;
    }

    setListLoading(true);
    setInlineError(null);
    setNotice(null);

    try {
      const result = await productService.list(organizationId, {
        storeId: storeId || null,
      });

      setState({
        ...state,
        products: result.items,
        nextCursor: result.nextCursor,
      });
      setSelectedProduct(null);
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
      const result = await productService.list(organizationId, {
        storeId: filterStoreId || null,
        cursor: state.nextCursor,
      });

      setState({
        ...state,
        products: [...state.products, ...result.items],
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

    const validation = validateProductForm({
      storeId: createStoreId,
      name: createName,
      description: createDescription,
    });

    setCreateStoreError(validation.errors.storeId);
    setCreateNameError(validation.errors.name);
    setInlineError(null);
    setNotice(null);

    if (!validation.valid) {
      return;
    }

    setCreating(true);

    try {
      const created = await productService.create(
        organizationId,
        validation.values,
      );

      if (
        state.status === "success" &&
        (!filterStoreId || filterStoreId === created.storeId)
      ) {
        setState({
          ...state,
          products: [created, ...state.products],
        });
      }

      setCreateName("");
      setCreateDescription("");
      setNotice(`สร้างสินค้า ${created.name} แล้ว`);
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

  async function handleEdit(product: ProductDTO) {
    if (
      loadingProductId ||
      savingProductId ||
      deactivatingProductId
    ) {
      return;
    }

    setLoadingProductId(product.productId);
    setInlineError(null);
    setNotice(null);

    try {
      const fresh = await productService.get(
        organizationId,
        product.productId,
      );

      setSelectedProduct(fresh);
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
      setLoadingProductId(null);
    }
  }

  async function handleSaveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedProduct || savingProductId) {
      return;
    }

    const validation = validateProductForm({
      storeId: selectedProduct.storeId,
      name: editName,
      description: editDescription,
    });

    setEditNameError(validation.errors.name);
    setInlineError(null);
    setNotice(null);

    if (!validation.valid) {
      return;
    }

    setSavingProductId(selectedProduct.productId);

    try {
      const updated = await productService.update(
        organizationId,
        selectedProduct.productId,
        {
          name: validation.values.name,
          description: validation.values.description,
        },
      );

      setState((current) =>
        current.status === "success"
          ? {
              ...current,
              products: current.products.map((product) =>
                product.productId === updated.productId
                  ? updated
                  : product,
              ),
            }
          : current,
      );
      setSelectedProduct(updated);
      setEditName(updated.name);
      setEditDescription(updated.description);
      setNotice(`บันทึกข้อมูลสินค้า ${updated.name} แล้ว`);
    } catch (error) {
      if (isDefinitiveSessionFailure(error)) {
        authSession.logout();
        return;
      }

      setInlineError(operationErrorMessage(error));
    } finally {
      setSavingProductId(null);
    }
  }

  async function handleDeactivate(product: ProductDTO) {
    if (
      product.status !== "ACTIVE" ||
      deactivatingProductId ||
      savingProductId ||
      loadingProductId
    ) {
      return;
    }

    setDeactivatingProductId(product.productId);
    setInlineError(null);
    setNotice(null);

    try {
      await productService.deactivate(
        organizationId,
        product.productId,
      );
      const refreshed = await productService.get(
        organizationId,
        product.productId,
      );

      setState((current) =>
        current.status === "success"
          ? {
              ...current,
              products: current.products.map((item) =>
                item.productId === refreshed.productId
                  ? refreshed
                  : item,
              ),
            }
          : current,
      );

      if (selectedProduct?.productId === refreshed.productId) {
        setSelectedProduct(refreshed);
      }

      setNotice(`ปิดใช้งานสินค้า ${refreshed.name} แล้ว`);
    } catch (error) {
      if (isDefinitiveSessionFailure(error)) {
        authSession.logout();
        return;
      }

      setInlineError(operationErrorMessage(error));
    } finally {
      setDeactivatingProductId(null);
    }
  }

  if (state.status !== "success") {
    return (
      <div className={styles.page}>
        <main className={styles.stateWrap}>
          {state.status === "loading" ? (
            <LoadingState
              title="กำลังโหลดสินค้า"
              description="กำลังดึงรายการสินค้า ร้านค้า และข้อมูลที่ใช้จัดการ"
            />
          ) : (
            <ErrorState
              title="ไม่สามารถโหลดสินค้าได้"
              description="กรุณาลองโหลดหน้านี้ใหม่อีกครั้ง"
            />
          )}
        </main>
      </div>
    );
  }

  const activeProducts = state.products.filter(
    (product) => product.status === "ACTIVE",
  ).length;
  const inactiveProducts = state.products.length - activeProducts;
  const selectedStoreName = filterStoreId
    ? storeNames.get(filterStoreId) ?? filterStoreId
    : "ทุกร้านค้า";
  const editDirty =
    selectedProduct !== null &&
    (editName !== selectedProduct.name ||
      editDescription !== selectedProduct.description);

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.header}>
          <div className={styles.headerCopy} data-ledger-heading>
            <h1 className={styles.title}>สินค้าและตัวเลือก</h1>
            <p className={styles.description}>
              จัดการสินค้า รูปสินค้า ตัวเลือก และราคาที่ใช้ในแต่ละร้านค้า
            </p>
          </div>
        </header>

        <section className={styles.summaryStrip} aria-label="สรุปรายการสินค้าที่โหลด">
          <div>
            <span className={styles.summaryLabel}>รายการที่โหลด</span>
            <strong>{state.products.length}</strong>
          </div>
          <div>
            <span className={styles.summaryLabel}>เปิดใช้งาน</span>
            <strong>{activeProducts}</strong>
          </div>
          <div>
            <span className={styles.summaryLabel}>ปิดใช้งาน</span>
            <strong>{inactiveProducts}</strong>
          </div>
          <div>
            <span className={styles.summaryLabel}>ขอบเขต</span>
            <strong className={styles.summaryText}>{selectedStoreName}</strong>
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
          <section className={styles.section} aria-labelledby="product-list">
            <div className={styles.sectionHeading}>
              <div>
                <h2 className={styles.sectionTitle} id="product-list">
                  รายการสินค้า
                </h2>
                <p className={styles.sectionDescription}>
                  เลือกสินค้าเพื่อแก้ไขข้อมูล รูป และตัวเลือกด้านล่าง
                </p>
              </div>
            </div>

            <div className={styles.toolbar}>
              <SelectField
                id="product-store-filter"
                label="กรองตามร้านค้า"
                value={filterStoreId}
                disabled={listLoading}
                onChange={(event) => {
                  const value = event.target.value;
                  setFilterStoreId(value);
                  void replaceProductList(value);
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

              <Button
                variant="quiet"
                disabled={!filterStoreId || listLoading}
                onClick={() => {
                  setFilterStoreId("");
                  void replaceProductList("");
                }}
              >
                แสดงทุกร้านค้า
              </Button>
            </div>

            {listLoading ? (
              <LoadingState
                title="กำลังโหลดรายการสินค้า"
                description="กำลังใช้ขอบเขตร้านค้าที่เลือก"
              />
            ) : state.products.length === 0 ? (
              <EmptyState
                title="ไม่พบสินค้า"
                description={
                  filterStoreId
                    ? "ร้านค้านี้ยังไม่มีสินค้า"
                    : "สร้างสินค้าแรกจากแบบฟอร์มด้านข้าง"
                }
              />
            ) : (
              <div className={styles.list}>
                {state.products.map((product) => {
                  const loading =
                    loadingProductId === product.productId;
                  const saving =
                    savingProductId === product.productId;
                  const deactivating =
                    deactivatingProductId === product.productId;
                  const busy = loading || saving || deactivating;
                  const selected =
                    selectedProduct?.productId === product.productId;

                  return (
                    <article
                      className={[
                        styles.row,
                        selected ? styles.rowSelected : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      key={product.productId}
                      aria-current={selected ? "true" : undefined}
                    >
                      <div className={styles.rowMain}>
                        <div className={styles.rowHeading}>
                          <h3 className={styles.cardTitle}>
                            {product.name}
                          </h3>
                          <Badge tone={statusTone(product.status)}>
                            {productStatusLabel(product.status)}
                          </Badge>
                        </div>
                        <p className={styles.cardDescription}>
                          {product.description || "ยังไม่มีคำอธิบายสินค้า"}
                        </p>
                        <div className={styles.metaRow}>
                          <span className={styles.meta}>
                            ร้านค้า:{" "}
                            {storeNames.get(product.storeId) ??
                              product.storeId}
                          </span>
                          <span className={styles.meta}>
                            ตัวเลือก {product.variants?.length ?? 0} รายการ
                          </span>
                          <span className={styles.meta}>
                            {product.imageKey ? "มีรูปสินค้า" : "ยังไม่มีรูปสินค้า"}
                          </span>
                          <span className={styles.meta}>
                            อัปเดต {formatIsoDateTime(product.updatedAt)}
                          </span>
                        </div>
                      </div>

                      <div className={styles.cardActions}>
                        <Button
                          variant="secondary"
                          pending={loading}
                          pendingLabel="กำลังโหลด"
                          disabled={busy}
                          onClick={() => {
                            void handleEdit(product);
                          }}
                        >
                          {selected ? "กำลังแก้ไข" : "แก้ไขข้อมูล"}
                        </Button>

                        {product.status === "ACTIVE" ? (
                          <ConfirmDialog
                            trigger={
                              <Button
                                variant="danger"
                                disabled={busy}
                              >
                                ปิดใช้งาน
                              </Button>
                            }
                            title="ยืนยันการปิดใช้งานสินค้า"
                            description={`ปิดใช้งานสินค้า ${product.name} ใช่หรือไม่ ข้อมูลคำสั่งซื้อเดิมจะยังคงอยู่`}
                            confirmLabel="ปิดใช้งานสินค้า"
                            danger
                            pending={deactivating}
                            onConfirm={() => {
                              void handleDeactivate(product);
                            }}
                          />
                        ) : null}
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
              <span className={styles.panelKicker}>เพิ่มรายการขาย</span>
              <h2 className={styles.sectionTitle}>สร้างสินค้าใหม่</h2>
              <p className={styles.sectionDescription}>
                เลือกร้านค้าและเพิ่มข้อมูลพื้นฐานก่อน จากนั้นจึงเพิ่มรูปและตัวเลือกสินค้า
              </p>
            </div>

            {state.stores.length === 0 ? (
              <Notice tone="warning" title="ยังสร้างสินค้าไม่ได้">
                ต้องมีร้านค้าในหน่วยงานอย่างน้อยหนึ่งร้านก่อน
              </Notice>
            ) : null}

            <form className={styles.form} onSubmit={handleCreate}>
              <SelectField
                id="product-create-store"
                label="ร้านค้า"
                value={createStoreId}
                onChange={(event) => {
                  setCreateStoreId(event.target.value);
                  setCreateStoreError(undefined);
                }}
                error={createStoreError}
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
                id="product-create-name"
                label="ชื่อสินค้า"
                value={createName}
                onChange={(event) => {
                  setCreateName(event.target.value);
                  setCreateNameError(undefined);
                }}
                error={createNameError}
                required
                disabled={creating}
              />

              <TextareaField
                id="product-create-description"
                label="คำอธิบาย"
                value={createDescription}
                onChange={(event) =>
                  setCreateDescription(event.target.value)
                }
                disabled={creating}
              />

              <Button
                type="submit"
                size="large"
                pending={creating}
                pendingLabel="กำลังสร้างสินค้า"
                disabled={state.stores.length === 0}
              >
                สร้างสินค้า
              </Button>
            </form>
          </aside>
        </div>

        {selectedProduct ? (
          <section
            className={styles.editor}
            aria-labelledby="product-editor-title"
          >
            <div className={styles.editorHeader}>
              <div className={styles.editorIdentity}>
                <div className={styles.editorTitleRow}>
                  <h2 className={styles.sectionTitle} id="product-editor-title">
                    จัดการ {selectedProduct.name}
                  </h2>
                  <Badge tone={statusTone(selectedProduct.status)}>
                    {productStatusLabel(selectedProduct.status)}
                  </Badge>
                </div>
                <div className={styles.metaRow}>
                  <span className={styles.meta}>
                    ร้านค้า:{" "}
                    {storeNames.get(selectedProduct.storeId) ??
                      selectedProduct.storeId}
                  </span>
                  <span className={styles.meta}>
                    รหัสสินค้า: {selectedProduct.productId}
                  </span>
                </div>
              </div>
              <Button
                variant="quiet"
                size="small"
                onClick={() => setSelectedProduct(null)}
              >
                ปิดส่วนแก้ไข
              </Button>
            </div>

            {selectedProduct.status === "INACTIVE" ? (
              <Notice tone="neutral" title="สินค้านี้ปิดใช้งานอยู่">
                ยังสามารถตรวจสอบและแก้ไขข้อมูลที่รองรับได้ แต่ไม่มีการเปิดใช้งานกลับจากขั้นตอนลบสินค้าในหน้านี้
              </Notice>
            ) : null}

            <div className={styles.editorGrid}>
              <section className={styles.editorSection} aria-labelledby="product-basic-title">
                <div className={styles.editorSectionHeading}>
                  <h3 className={styles.editorSectionTitle} id="product-basic-title">
                    ข้อมูลสินค้า
                  </h3>
                  <span className={styles.meta}>
                    อัปเดตล่าสุด {formatIsoDateTime(selectedProduct.updatedAt)}
                  </span>
                </div>

                <form className={styles.form} onSubmit={handleSaveEdit}>
                  <TextField
                    id="product-edit-name"
                    label="ชื่อสินค้า"
                    value={editName}
                    onChange={(event) => {
                      setEditName(event.target.value);
                      setEditNameError(undefined);
                    }}
                    error={editNameError}
                    required
                    disabled={
                      savingProductId === selectedProduct.productId
                    }
                  />

                  <TextareaField
                    id="product-edit-description"
                    label="คำอธิบาย"
                    value={editDescription}
                    onChange={(event) =>
                      setEditDescription(event.target.value)
                    }
                    disabled={
                      savingProductId === selectedProduct.productId
                    }
                  />

                  <div className={styles.editorActions}>
                    <Button
                      type="submit"
                      pending={
                        savingProductId === selectedProduct.productId
                      }
                      pendingLabel="กำลังบันทึก"
                      disabled={!editDirty}
                    >
                      บันทึกข้อมูล
                    </Button>
                    {!editDirty ? (
                      <span className={styles.meta}>
                        ยังไม่มีข้อมูลที่เปลี่ยนแปลง
                      </span>
                    ) : null}
                  </div>
                </form>
              </section>

              <section className={styles.editorSection}>
                <ProductImageUploadView
                  organizationId={organizationId}
                  product={selectedProduct}
                  onProductRefreshed={(refreshed) => {
                    setSelectedProduct(refreshed);
                    setState((current) =>
                      current.status === "success"
                        ? {
                            ...current,
                            products: current.products.map((product) =>
                              product.productId === refreshed.productId
                                ? refreshed
                                : product,
                            ),
                          }
                        : current,
                    );
                  }}
                />
              </section>
            </div>

            <VariantManagement
              organizationId={organizationId}
              product={selectedProduct}
              onProductRefreshed={(refreshed) => {
                setSelectedProduct(refreshed);
                setState((current) =>
                  current.status === "success"
                    ? {
                        ...current,
                        products: current.products.map((product) =>
                          product.productId === refreshed.productId
                            ? refreshed
                            : product,
                        ),
                      }
                    : current,
                );
              }}
            />
          </section>
        ) : null}
      </main>
    </div>
  );
}
