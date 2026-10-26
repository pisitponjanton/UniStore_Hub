"use client";


import Link from "next/link";
import { productDetailHref, storeWorkspaceHref } from "@/modules/stores/store-workspace";
import { ManagementModal } from "@/components/ui/management-modal";
import { AsyncPageFallback } from "@/components/ui/async-page";
import { LoadedDirectoryControls } from "@/modules/organization-directory/loaded-directory-controls";
import { searchLoadedItems, visibleLoadedItems } from "@/modules/organization-directory/loaded-directory-helpers";

import { useEffect, useMemo, useState, type FormEvent } from "react";

import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorSummary,
  useErrorSummaryFocus,
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
  mergeProductUpdateResponse,
  validateProductForm,
} from "./product-helpers";
import { ProductImageUploadView } from "./product-image-upload-view";
import { productService } from "./product-service";
import { VariantManagement } from "./variant-management";
import { OperationToast } from "./operation-toast";
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
  organizationId, fixedStoreId, storeName, storeActive = true, detailProductId, standaloneDetail = false, onDirtyChange,
}: {
  organizationId: string;
  fixedStoreId?: string;
  storeName?: string;
  storeActive?: boolean;
  detailProductId?: string;
  standaloneDetail?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const focusErrorSummary = useErrorSummaryFocus();
  const [directoryQuery, setDirectoryQuery] = useState("");
  const [directoryLimit, setDirectoryLimit] = useState(24);
  const [state, setState] = useState<ProductState>({
    status: "loading",
  });
  const [filterStoreId, setFilterStoreId] = useState(fixedStoreId ?? "");
  const [listLoading, setListLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [createStoreId, setCreateStoreId] = useState(fixedStoreId ?? "");
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
          fixedStoreId
            ? storeService.get(organizationId, fixedStoreId, {
                signal: controller.signal,
              }).then(store => [store])
            : storeService.list(organizationId, {
                signal: controller.signal,
              }),
          detailProductId ? Promise.resolve({ items: [], nextCursor: null }) : productService.list(organizationId, {
            storeId: fixedStoreId ?? null,
            signal: controller.signal,
          }),
        ]);

        if (!controller.signal.aborted) {
          setState({
            status: "success",
            stores,
            products: fixedStoreId ? products.items.filter(product => product.storeId === fixedStoreId) : products.items,
            nextCursor: products.nextCursor,
          });

          const firstActiveStore =
            stores.find((store) => store.status === "ACTIVE") ??
            stores[0];

          setCreateStoreId(fixedStoreId ?? firstActiveStore?.storeId ?? "");
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
  }, [organizationId, fixedStoreId, detailProductId]);

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
        storeId: (fixedStoreId ?? storeId) || null,
      });

      setState({
        ...state,
        products: fixedStoreId ? result.items.filter(product => product.storeId === fixedStoreId) : result.items,
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
        storeId: (fixedStoreId ?? filterStoreId) || null,
        cursor: state.nextCursor,
      });

      setState({
        ...state,
        products: [...state.products, ...result.items.filter(product => !fixedStoreId || product.storeId === fixedStoreId)],
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
      storeId: fixedStoreId ?? createStoreId,
      name: createName,
      description: createDescription,
    });

    setCreateStoreError(validation.errors.storeId);
    setCreateNameError(validation.errors.name);
    setInlineError(null);
    setNotice(null);

    if (!validation.valid) {
      focusErrorSummary("product-create-error-summary");
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
        ((fixedStoreId ?? filterStoreId) === created.storeId || (!fixedStoreId && !filterStoreId))
      ) {
        setState({
          ...state,
          products: [created, ...state.products],
        });
      }

      setCreateName("");
      setCreateDescription("");
      setNotice(`สร้างสินค้า ${created.name} แล้ว`);
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
      if (fixedStoreId && fresh.storeId !== fixedStoreId) throw new Error("Product does not belong to current store");

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
      focusErrorSummary("product-edit-error-summary");
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
                  ? mergeProductUpdateResponse(product, updated)
                  : product,
              ),
            }
          : current,
      );
      setSelectedProduct((current) =>
        current?.productId === updated.productId
          ? mergeProductUpdateResponse(current, updated)
          : current,
      );
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

  async function handleReactivate(product: ProductDTO) {
    if (product.status !== "INACTIVE" || deactivatingProductId || savingProductId ||
        loadingProductId || editName !== product.name || editDescription !== product.description) return;

    setDeactivatingProductId(product.productId);
    setInlineError(null);
    setNotice(null);
    try {
      await productService.update(organizationId, product.productId, { status: "ACTIVE" });
      const refreshed = await productService.get(organizationId, product.productId);
      setState(current => current.status === "success"
        ? { ...current, products: current.products.map(item =>
            item.productId === refreshed.productId ? refreshed : item) } : current);
      if (selectedProduct?.productId === refreshed.productId) setSelectedProduct(refreshed);
      setNotice(`เปิดใช้งานสินค้า ${refreshed.name} แล้ว`);
    } catch (error) {
      if (isDefinitiveSessionFailure(error)) { authSession.logout(); return; }
      setInlineError(operationErrorMessage(error));
    } finally {
      setDeactivatingProductId(null);
    }
  }

  useEffect(() => {
    if (!detailProductId || state.status !== "success") return;
    const controller = new AbortController();
    productService.get(organizationId, detailProductId, { signal: controller.signal }).then(product => {
      if (controller.signal.aborted) return;
      if (fixedStoreId && product.storeId !== fixedStoreId) {
        setInlineError("สินค้านี้ไม่ได้อยู่ในร้านที่เลือก");
        return;
      }
      setSelectedProduct(product);
      setEditName(product.name);
      setEditDescription(product.description);
    }).catch(error => {
      if (controller.signal.aborted) return;
      if (isDefinitiveSessionFailure(error)) { authSession.logout(); return; }
      setInlineError(operationErrorMessage(error));
    });
    return () => controller.abort();
  }, [organizationId, fixedStoreId, detailProductId, state.status]);

  const [variantDirty, setVariantDirty] = useState(false);
  const editDirtyForWorkspace = variantDirty || (selectedProduct !== null &&
    (editName !== selectedProduct.name || editDescription !== selectedProduct.description));
  useEffect(() => {
    onDirtyChange?.(editDirtyForWorkspace);
    return () => onDirtyChange?.(false);
  }, [editDirtyForWorkspace, onDirtyChange]);

  if (state.status !== "success") {
    return (
      <div className={styles.page}>
        <main className={styles.stateWrap}>
          <AsyncPageFallback
            status={state.status}
            pageTitle="สินค้าและตัวเลือก"
            pageDescription="จัดการสินค้า ตัวเลือก และข้อมูลของร้านค้า"
            loadingTitle="กำลังโหลดสินค้า"
            errorTitle="ไม่สามารถโหลดสินค้าได้"
            backHref="/org/select/"
            backLabel="กลับไปพื้นที่ทำงาน"
          />
        </main>
      </div>
    );
  }

  const activeProducts = state.products.filter(
    (product) => product.status === "ACTIVE",
  ).length;
  const inactiveProducts = state.products.length - activeProducts;
  const selectedStoreName = fixedStoreId ? (storeName ?? fixedStoreId) : filterStoreId
    ? storeNames.get(filterStoreId) ?? filterStoreId
    : "ทุกร้านค้า";
  const editDirty =
    selectedProduct !== null &&
    (editName !== selectedProduct.name ||
      editDescription !== selectedProduct.description);

  const defaultCreateStoreId = fixedStoreId ?? ((state.stores.find(store => store.status === "ACTIVE") ?? state.stores[0])?.storeId ?? "");
  const createDirty = Boolean(
    createName.trim() || createDescription.trim() || createStoreId !== defaultCreateStoreId,
  );

  function closeCreate() {
    setShowCreate(false);
    setCreateName("");
    setCreateDescription("");
    setCreateStoreId(defaultCreateStoreId);
    setCreateNameError(undefined);
    setCreateStoreError(undefined);
    setInlineError(null);
  }

  const directoryMatches = searchLoadedItems(state.products.filter(product => !fixedStoreId || product.storeId === fixedStoreId), directoryQuery, product => [product.name, product.description, product.productId, storeNames.get(product.storeId), product.status]);
  const directoryVisible = visibleLoadedItems(directoryMatches, directoryLimit);

  return (
    <div className={standaloneDetail ? styles.standalonePage : styles.page}>
      <main className={styles.main}>
        {!standaloneDetail ? <header className={styles.header}>
          <div className={styles.headerCopy}>
            {detailProductId ? <h2 className={styles.title}>แก้ไขสินค้า</h2> : fixedStoreId ? <h2 className={styles.title}>สินค้าและตัวเลือก</h2> : <h1 className={styles.title}>สินค้าและตัวเลือก</h1>}
            <p className={styles.description}>
              จัดการสินค้า รูปสินค้า ตัวเลือก และราคาที่ใช้ในแต่ละร้านค้า
            </p>
          </div>
          {!detailProductId ? <Button onClick={() => setShowCreate(true)}>+ เพิ่มสินค้า</Button> : null}
        </header> : null}

        {!detailProductId && state.products.length > 0 && !selectedProduct ? <section className={styles.summaryStrip} aria-label="สรุปรายการสินค้าที่โหลด">
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
        </section> : null}

        {inlineError && !showCreate ? (
          <Notice tone="danger" role="alert" title="ดำเนินการไม่สำเร็จ">
            {inlineError}
          </Notice>
        ) : null}

        <OperationToast message={notice} onDismiss={() => setNotice(null)} />

        <div className={styles.grid}>
          {!detailProductId ? <section className={selectedProduct ? styles.hiddenSection : styles.section} aria-labelledby="product-list">
            <div className={styles.sectionHeading}>
              <div>
                <h2 className={styles.sectionTitle} id="product-list">
                  รายการสินค้า
                </h2>
                <p className={styles.sectionDescription}>
                  เลือกสินค้าเพื่อแก้ไขข้อมูล รูปภาพ และตัวเลือก
                </p>
              </div>
            </div>

            {!fixedStoreId ? <div className={styles.toolbar}>
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
            </div> : null}

          {state.products.length > 0 ? <LoadedDirectoryControls
            id="products-directory-search"
            label="ค้นหาสินค้า"
            query={directoryQuery}
            onQueryChange={value => { setDirectoryQuery(value); setDirectoryLimit(24); }}
            loadedCount={state.products.length}
            matchingCount={directoryMatches.length}
            visibleCount={directoryVisible.length}
            onShowMore={() => setDirectoryLimit(limit => limit + 24)}
          /> : null}

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
                    : "กดเพิ่มสินค้าเพื่อเริ่มสร้างสินค้าแรก"
                }
              />
            ) : (
              <div className={styles.list}>
                {directoryVisible.map((product) => {
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
                      <div className={styles.productMedia}>
                        {product.imageUrl ? (
                          // Backend supplies this short-lived Product image URL for display only.
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            className={styles.productImage}
                            src={product.imageUrl}
                            alt={`รูปสินค้า ${product.name}`}
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <span className={styles.productFallback} aria-hidden="true">
                            {product.name.trim().charAt(0) || "U"}
                          </span>
                        )}
                      </div>

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
                        {fixedStoreId ? (
                          <strong className={styles.productPrice}>
                            {product.variants === undefined
                              ? "ดูราคาในรายละเอียด"
                              : product.variants.some(variant => variant.status === "ACTIVE")
                                ? "เริ่มต้น ฿" + (Math.min(...product.variants
                                    .filter(variant => variant.status === "ACTIVE")
                                    .map(variant => variant.price)) / 100).toLocaleString("th-TH", { minimumFractionDigits:2, maximumFractionDigits:2 })
                                : "ยังไม่มีราคา"}
                          </strong>
                        ) : null}
                        <div className={styles.metaRow}>
                          {!fixedStoreId ? <span className={styles.meta}>
                            ร้านค้า: {storeNames.get(product.storeId) ?? product.storeId}
                          </span> : null}
                          {product.variants ? <span className={styles.meta}>
                            ตัวเลือก {product.variants.length} รายการ
                          </span> : null}
                          {!fixedStoreId ? <>
                            <span className={styles.meta}>{product.imageKey ? "มีรูปสินค้า" : "ยังไม่มีรูปสินค้า"}</span>
                            <time className={styles.meta} dateTime={product.updatedAt}>
                              อัปเดต {formatIsoDateTime(product.updatedAt)}
                            </time>
                          </> : null}
                        </div>
                      </div>

                      <div className={styles.cardActions}>
                        {fixedStoreId ? (
                          <Link className={styles.detailLink}
                            href={productDetailHref(organizationId, fixedStoreId, product.productId)}>
                            แก้ไขสินค้า
                          </Link>
                        ) : (
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
                        )}

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
          </section> : null}

          {showCreate ? <ManagementModal title="สร้างสินค้าใหม่" description="เพิ่มข้อมูลพื้นฐานก่อน แล้วจึงจัดการรูป ราคา และตัวเลือก"
            size="medium" formId="product-create-form"
            submitLabel="สร้างสินค้า" submitting={creating}
            submitDisabled={!fixedStoreId && state.stores.length === 0}
            dirty={createDirty} onClose={closeCreate}><div className={styles.modalContents}>
            {inlineError ? <Notice tone="danger" role="alert" title="ดำเนินการไม่สำเร็จ">{inlineError}</Notice> : null}
            {fixedStoreId && !storeActive ? <Notice tone="neutral" title="ร้านค้าปิดใช้งาน">
              สามารถเตรียมข้อมูลภายในร้านได้ แต่ลูกค้าจะยังไม่เห็นร้านนี้จนกว่าจะเปิดใช้งาน
            </Notice> : null}
            <aside className={styles.panel}>
            {(!fixedStoreId && state.stores.length === 0) ? (
              <Notice tone="warning" title="ยังสร้างสินค้าไม่ได้">
                ต้องมีร้านค้าในหน่วยงานอย่างน้อยหนึ่งร้านก่อน
              </Notice>
            ) : null}

            <form id="product-create-form" className={styles.form} onSubmit={handleCreate} noValidate>
              <ErrorSummary
                id="product-create-error-summary"
                items={[
                  ...(createStoreError
                    ? [
                        {
                          fieldId: "product-create-store",
                          message: createStoreError,
                        },
                      ]
                    : []),
                  ...(createNameError
                    ? [
                        {
                          fieldId: "product-create-name",
                          message: createNameError,
                        },
                      ]
                    : []),
                ]}
              />
              {fixedStoreId ? <p className={styles.sectionDescription}>เพิ่มสินค้าในร้าน {storeName ?? fixedStoreId}</p> : (
              <SelectField
                id="product-create-store"
                label="ร้านค้า"
                value={createStoreId}
                onChange={(event) => {
                  setCreateStoreId(event.target.value);
                  setCreateStoreError(undefined);
                }}
                error={createStoreError}
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
                id="product-create-name"
                label="ชื่อสินค้า"
                value={createName}
                onChange={(event) => {
                  setCreateName(event.target.value);
                  setCreateNameError(undefined);
                }}
                error={createNameError}
                announceError={false}
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


            </form>
          </aside></div></ManagementModal> : null}
        </div>

        {detailProductId && !selectedProduct && !inlineError ? <LoadingState title="กำลังโหลดรายละเอียดสินค้า" /> : null}
        {selectedProduct ? (
          <section
            className={styles.editor}
            aria-labelledby="product-editor-title"
          >
            <div className={styles.editorHeader}>
              <div className={styles.editorIdentity}>
                <div className={styles.editorTitleRow}>
                  {standaloneDetail ? <h1 className={styles.detailPageTitle} id="product-editor-title">{selectedProduct.name}</h1> :
                    <h2 className={styles.sectionTitle} id="product-editor-title">จัดการ {selectedProduct.name}</h2>}
                  <Badge tone={statusTone(selectedProduct.status)}>
                    {productStatusLabel(selectedProduct.status)}
                  </Badge>
                </div>
                <div className={standaloneDetail ? styles.productIdentityMeta : styles.metaRow}>
                  {!standaloneDetail ? <span className={styles.meta}>ร้านค้า: {storeNames.get(selectedProduct.storeId) ?? selectedProduct.storeId}</span> : null}
                  <span className={styles.meta}>รหัสสินค้า: {selectedProduct.productId}</span>
                  {standaloneDetail ? <time className={styles.meta} dateTime={selectedProduct.updatedAt}>
                    อัปเดตล่าสุด {formatIsoDateTime(selectedProduct.updatedAt)}
                  </time> : null}
                </div>
              </div>
              {standaloneDetail ? <div className={styles.productHeaderActions}>
                {selectedProduct.status === "ACTIVE" ? (
                  <ConfirmDialog key={selectedProduct.productId + ":active"}
                    trigger={<Button variant="secondary" disabled={editDirty || Boolean(savingProductId) || Boolean(deactivatingProductId)}>ปิดใช้งาน</Button>}
                    title="ยืนยันการปิดใช้งานสินค้า"
                    description={`ปิดใช้งานสินค้า ${selectedProduct.name} ใช่หรือไม่ ข้อมูลคำสั่งซื้อเดิมจะยังคงอยู่`}
                    confirmLabel="ปิดใช้งานสินค้า" danger pending={deactivatingProductId === selectedProduct.productId}
                    onConfirm={() => { void handleDeactivate(selectedProduct); }}
                  />
                ) : (
                  <ConfirmDialog key={selectedProduct.productId + ":inactive"}
                    trigger={<Button variant="secondary" disabled={editDirty || Boolean(savingProductId) || Boolean(deactivatingProductId)}>เปิดใช้งาน</Button>}
                    title="ยืนยันการเปิดใช้งานสินค้า"
                    description={`เปิดใช้งานสินค้า ${selectedProduct.name} อีกครั้งใช่หรือไม่? การแสดงในหน้าร้านขึ้นอยู่กับสถานะร้านค้าและตัวเลือกด้วย`}
                    confirmLabel="เปิดใช้งานสินค้า"
                    pending={deactivatingProductId === selectedProduct.productId}
                    onConfirm={() => { void handleReactivate(selectedProduct); }}
                  />
                )}
                <Button type="submit" form="product-detail-form"
                  pending={savingProductId === selectedProduct.productId}
                  pendingLabel="กำลังบันทึก" disabled={!editDirty}>บันทึก</Button>
              </div> : detailProductId && fixedStoreId ? (
                <Link className={styles.detailLink} href={storeWorkspaceHref(organizationId, fixedStoreId, "products")}>← กลับไปรายการสินค้า</Link>
              ) : (
              <Button
                variant="quiet"
                size="small"
                onClick={() => setSelectedProduct(null)}
              >
                ปิดส่วนแก้ไข
              </Button>
              )}
            </div>

            {selectedProduct.status === "INACTIVE" && !standaloneDetail ? (
              <Notice tone="neutral" title="สินค้านี้ปิดใช้งานอยู่">
                เปิดใช้งานสินค้าอีกครั้งได้จากหน้ารายละเอียดสินค้า
              </Notice>
            ) : null}

            <div className={styles.editorGrid}>
              <section className={styles.editorSection} aria-labelledby="product-basic-title">
                <div className={styles.editorSectionHeading}>
                  <h3 className={styles.editorSectionTitle} id="product-basic-title">
                    ข้อมูลสินค้า
                  </h3>
                  {!standaloneDetail ? <time className={styles.meta} dateTime={selectedProduct.updatedAt}>
                    อัปเดตล่าสุด {formatIsoDateTime(selectedProduct.updatedAt)}
                  </time> : null}
                </div>

                <form id={standaloneDetail ? "product-detail-form" : undefined}
                  className={styles.form} onSubmit={handleSaveEdit} noValidate>
                  <ErrorSummary
                    id="product-edit-error-summary"
                    items={
                      editNameError
                        ? [
                            {
                              fieldId: "product-edit-name",
                              message: editNameError,
                            },
                          ]
                        : []
                    }
                  />
                  <TextField
                    id="product-edit-name"
                    label="ชื่อสินค้า"
                    value={editName}
                    onChange={(event) => {
                      setEditName(event.target.value);
                      setEditNameError(undefined);
                    }}
                    error={editNameError}
                    announceError={false}
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

                  {!standaloneDetail ? <div className={styles.editorActions}>
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
                  </div> : null}
                </form>
              </section>

              <section className={styles.editorSection}>
                <ProductImageUploadView
                  compact={standaloneDetail}
                  key={organizationId + ":" + selectedProduct.productId}
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
              compact={standaloneDetail}
              onDirtyChange={setVariantDirty}
              onNotice={setNotice}
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
