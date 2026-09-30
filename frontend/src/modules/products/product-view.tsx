"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingState,
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
            <LoadingState title="กำลังโหลดสินค้า" />
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

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.header}>
          <div className={styles.headerCopy} data-ledger-heading>
            <span className={styles.eyebrow}>Product management</span>
            <h1 className={styles.title}>สินค้า</h1>
            <p className={styles.description}>
              จัดการข้อมูลสินค้าของหน่วยงาน แยก Variant และ Product Image
              ไปยังขั้นตอนถัดไปตาม contract
            </p>
          </div>
          <Badge tone="info">{state.products.length} รายการในหน้าปัจจุบัน</Badge>
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
          <section className={styles.section} aria-labelledby="product-list">
            <h2 className={styles.sectionTitle} id="product-list">
              รายการสินค้า
            </h2>

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
                ล้างตัวกรอง
              </Button>
            </div>

            {listLoading ? (
              <LoadingState title="กำลังโหลดรายการสินค้า" />
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

                  return (
                    <article
                      className={styles.card}
                      key={product.productId}
                    >
                      <div className={styles.cardHeader}>
                        <div className={styles.cardCopy}>
                          <h3 className={styles.cardTitle}>
                            {product.name}
                          </h3>
                          <p className={styles.cardDescription}>
                            {product.description || "ไม่มีคำอธิบาย"}
                          </p>
                          <div className={styles.metaRow}>
                            <span className={styles.meta}>
                              ร้านค้า:{" "}
                              {storeNames.get(product.storeId) ??
                                product.storeId}
                            </span>
                            <span className={styles.meta}>
                              อัปเดตล่าสุด{" "}
                              {formatIsoDateTime(product.updatedAt)}
                            </span>
                          </div>
                        </div>

                        <Badge tone={statusTone(product.status)}>
                          {productStatusLabel(product.status)}
                        </Badge>
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
                          แก้ไขข้อมูล
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
                            description={`ปิดใช้งานสินค้า ${product.name} ใช่หรือไม่ การลบใน MVP เป็น soft deactivate และไม่ลบประวัติ Order เดิม`}
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
                <h2 className={styles.sectionTitle}>สร้างสินค้าใหม่</h2>
                <p className={styles.description}>
                  สินค้าต้องผูกกับ Store ที่มีอยู่ในหน่วยงาน
                  และ Backend จะกำหนดสถานะเริ่มต้นเป็น ACTIVE
                </p>
              </div>

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
                  pending={creating}
                  pendingLabel="กำลังสร้าง"
                  disabled={state.stores.length === 0}
                >
                  สร้างสินค้า
                </Button>
              </form>
            </section>

            {selectedProduct ? (
              <section className={styles.panel}>
                <div className={styles.editHeader}>
                  <div className={styles.editMeta}>
                    <h2 className={styles.sectionTitle}>แก้ไขสินค้า</h2>
                    <span className={styles.meta}>
                      Product ID: {selectedProduct.productId}
                    </span>
                    <span className={styles.meta}>
                      ร้านค้า:{" "}
                      {storeNames.get(selectedProduct.storeId) ??
                        selectedProduct.storeId}
                    </span>
                  </div>
                  <Button
                    variant="quiet"
                    size="small"
                    onClick={() => setSelectedProduct(null)}
                  >
                    ปิด
                  </Button>
                </div>

                {selectedProduct.status === "INACTIVE" ? (
                  <div className={styles.inactiveNote}>
                    สินค้านี้ถูกปิดใช้งานแล้ว
                    หน้านี้ยังแสดงและแก้ไขข้อมูลข้อความตาม contract
                    แต่ไม่มี action สำหรับสร้างสถานะใหม่แทน Backend
                  </div>
                ) : null}

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

                  <Button
                    type="submit"
                    pending={
                      savingProductId === selectedProduct.productId
                    }
                    pendingLabel="กำลังบันทึก"
                  >
                    บันทึกข้อมูล
                  </Button>
                </form>

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
          </div>
        </div>
      </main>
    </div>
  );
}
