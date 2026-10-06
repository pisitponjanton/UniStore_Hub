"use client";

import { useState, type FormEvent } from "react";

import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorSummary,
  useErrorSummaryFocus,
  Notice,
  TextField,
} from "@/components";
import {
  authSession,
  isDefinitiveSessionFailure,
} from "@/modules/auth";
import { ApiClientError } from "@/services";
import type { ProductDTO, ProductVariantDTO } from "@/types";
import {
  formatSatang,
  satangToThbInput,
} from "@/utils";

import {
  validateVariantForm,
  variantStatusLabel,
} from "./variant-helpers";
import { productService } from "./product-service";
import styles from "./variant-management.module.css";

function operationErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.code === "VARIANT_NOT_FOUND") {
      return "ไม่พบตัวเลือกนี้แล้ว กรุณาโหลดข้อมูลสินค้าใหม่";
    }

    if (error.code === "PRODUCT_NOT_FOUND") {
      return "ไม่พบสินค้านี้แล้ว กรุณารีเฟรชรายการ";
    }

    return error.userMessage;
  }

  return "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง";
}

export function VariantManagement({
  organizationId,
  product,
  onProductRefreshed,
}: {
  organizationId: string;
  product: ProductDTO;
  onProductRefreshed: (product: ProductDTO) => void;
}) {
  const focusErrorSummary = useErrorSummaryFocus();
  const [createName, setCreateName] = useState("");
  const [createPrice, setCreatePrice] = useState("");
  const [createNameError, setCreateNameError] = useState<
    string | undefined
  >();
  const [createPriceError, setCreatePriceError] = useState<
    string | undefined
  >();
  const [creating, setCreating] = useState(false);

  const [editingVariant, setEditingVariant] =
    useState<ProductVariantDTO | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editNameError, setEditNameError] = useState<
    string | undefined
  >();
  const [editPriceError, setEditPriceError] = useState<
    string | undefined
  >();
  const [savingVariantId, setSavingVariantId] =
    useState<string | null>(null);
  const [deactivatingVariantId, setDeactivatingVariantId] =
    useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const variants = product.variants ?? [];
  const activeCount = variants.filter(
    (variant) => variant.status === "ACTIVE",
  ).length;

  async function refreshProduct() {
    const refreshed = await productService.get(
      organizationId,
      product.productId,
    );
    onProductRefreshed(refreshed);
    return refreshed;
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (creating) {
      return;
    }

    const validation = validateVariantForm({
      name: createName,
      priceThb: createPrice,
    });

    setCreateNameError(validation.errors.name);
    setCreatePriceError(validation.errors.priceThb);
    setError(null);
    setNotice(null);

    if (!validation.valid || !validation.values) {
      focusErrorSummary(`variant-create-error-summary-${product.productId}`);
      return;
    }

    setCreating(true);

    try {
      const created = await productService.createVariant(
        organizationId,
        product.productId,
        validation.values,
      );

      await refreshProduct();
      setCreateName("");
      setCreatePrice("");
      setNotice(
        `สร้างตัวเลือก ${created.name} ราคา ${formatSatang(created.price)} แล้ว`,
      );
    } catch (error) {
      if (isDefinitiveSessionFailure(error)) {
        authSession.logout();
        return;
      }

      setError(operationErrorMessage(error));
    } finally {
      setCreating(false);
    }
  }

  function openEdit(variant: ProductVariantDTO) {
    setEditingVariant(variant);
    setEditName(variant.name);
    setEditPrice(satangToThbInput(variant.price));
    setEditNameError(undefined);
    setEditPriceError(undefined);
    setError(null);
    setNotice(null);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingVariant || savingVariantId) {
      return;
    }

    const validation = validateVariantForm({
      name: editName,
      priceThb: editPrice,
    });

    setEditNameError(validation.errors.name);
    setEditPriceError(validation.errors.priceThb);
    setError(null);
    setNotice(null);

    if (!validation.valid || !validation.values) {
      focusErrorSummary(
        `variant-edit-error-summary-${editingVariant.variantId}`,
      );
      return;
    }

    setSavingVariantId(editingVariant.variantId);

    try {
      const updated = await productService.updateVariant(
        organizationId,
        product.productId,
        editingVariant.variantId,
        validation.values,
      );

      await refreshProduct();
      setEditingVariant(null);
      setNotice(
        `บันทึกตัวเลือก ${updated.name} ราคา ${formatSatang(updated.price)} แล้ว`,
      );
    } catch (error) {
      if (isDefinitiveSessionFailure(error)) {
        authSession.logout();
        return;
      }

      setError(operationErrorMessage(error));
    } finally {
      setSavingVariantId(null);
    }
  }

  async function handleDeactivate(variant: ProductVariantDTO) {
    if (
      variant.status !== "ACTIVE" ||
      deactivatingVariantId ||
      savingVariantId
    ) {
      return;
    }

    setDeactivatingVariantId(variant.variantId);
    setError(null);
    setNotice(null);

    try {
      await productService.deactivateVariant(
        organizationId,
        product.productId,
        variant.variantId,
      );

      await refreshProduct();

      if (editingVariant?.variantId === variant.variantId) {
        setEditingVariant(null);
      }

      setNotice(`ปิดใช้งานตัวเลือก ${variant.name} แล้ว`);
    } catch (error) {
      if (isDefinitiveSessionFailure(error)) {
        authSession.logout();
        return;
      }

      setError(operationErrorMessage(error));
    } finally {
      setDeactivatingVariantId(null);
    }
  }

  return (
    <section className={styles.root} aria-labelledby={`variant-title-${product.productId}`}>
      <div className={styles.header}>
        <div className={styles.headerCopy}>
          <h3 className={styles.title} id={`variant-title-${product.productId}`}>
            ตัวเลือกสินค้าและราคา
          </h3>
          <p className={styles.description}>
            เพิ่มขนาด สี หรือรูปแบบที่ลูกค้าเลือกได้ โดยกรอกราคาเป็นหน่วยบาท
          </p>
        </div>
        <div className={styles.headerStats}>
          <span>{activeCount} ใช้งาน</span>
          <span>{variants.length} ทั้งหมด</span>
        </div>
      </div>

      {error ? (
        <Notice tone="danger" role="alert" title="ดำเนินการไม่สำเร็จ">
          {error}
        </Notice>
      ) : null}

      {notice ? (
        <Notice tone="success" role="status" title="อัปเดตแล้ว">
          {notice}
        </Notice>
      ) : null}

      <div className={styles.layout}>
        <div className={styles.variantList}>
          {variants.length === 0 ? (
            <EmptyState
              title="ยังไม่มีตัวเลือกสินค้า"
              description="เพิ่มตัวเลือกแรกเพื่อกำหนดรูปแบบและราคาที่ลูกค้าจะเลือก"
            />
          ) : (
            <div className={styles.list}>
              {variants.map((variant) => {
                const saving =
                  savingVariantId === variant.variantId;
                const deactivating =
                  deactivatingVariantId === variant.variantId;
                const busy = saving || deactivating;
                const editing =
                  editingVariant?.variantId === variant.variantId;

                return (
                  <article
                    className={[
                      styles.row,
                      editing ? styles.rowEditing : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    key={variant.variantId}
                  >
                    <div className={styles.rowMain}>
                      <div className={styles.rowHeading}>
                        <span className={styles.name}>
                          {variant.name}
                        </span>
                        <Badge
                          tone={
                            variant.status === "ACTIVE"
                              ? "success"
                              : "neutral"
                          }
                        >
                          {variantStatusLabel(variant.status)}
                        </Badge>
                      </div>
                      <span className={styles.price} data-numeric>
                        {formatSatang(variant.price)}
                      </span>
                    </div>

                    <div className={styles.actions}>
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() => openEdit(variant)}
                      >
                        {editing ? "กำลังแก้ไข" : "แก้ไขตัวเลือก"}
                      </Button>

                      {variant.status === "ACTIVE" ? (
                        <ConfirmDialog
                          trigger={
                            <Button
                              variant="danger"
                              disabled={busy}
                            >
                              ปิดใช้งาน
                            </Button>
                          }
                          title="ยืนยันการปิดใช้งานตัวเลือก"
                          description={`ปิดใช้งานตัวเลือก ${variant.name} ใช่หรือไม่ ข้อมูลในคำสั่งซื้อเดิมจะยังคงอยู่`}
                          confirmLabel="ปิดใช้งานตัวเลือก"
                          danger
                          pending={deactivating}
                          onConfirm={() => {
                            void handleDeactivate(variant);
                          }}
                        />
                      ) : null}
                    </div>

                    {editing ? (
                      <form
                        className={styles.editForm}
                        onSubmit={handleSave}
                        noValidate
                      >
                        <ErrorSummary
                          id={`variant-edit-error-summary-${variant.variantId}`}
                          items={[
                            ...(editNameError
                              ? [
                                  {
                                    fieldId: `variant-edit-name-${variant.variantId}`,
                                    message: editNameError,
                                  },
                                ]
                              : []),
                            ...(editPriceError
                              ? [
                                  {
                                    fieldId: `variant-edit-price-${variant.variantId}`,
                                    message: editPriceError,
                                  },
                                ]
                              : []),
                          ]}
                        />
                        <TextField
                          id={`variant-edit-name-${variant.variantId}`}
                          label="ชื่อตัวเลือก"
                          value={editName}
                          onChange={(event) => {
                            setEditName(event.target.value);
                            setEditNameError(undefined);
                          }}
                          error={editNameError}
                          announceError={false}
                          onBlur={() => {
                            const validation = validateVariantForm({
                              name: editName,
                              priceThb: editPrice,
                            });
                            setEditNameError(validation.errors.name);
                          }}
                          required
                          disabled={saving}
                        />
                        <TextField
                          id={`variant-edit-price-${variant.variantId}`}
                          label="ราคา (บาท)"
                          inputMode="decimal"
                          value={editPrice}
                          onChange={(event) => {
                            setEditPrice(event.target.value);
                            setEditPriceError(undefined);
                          }}
                          error={editPriceError}
                          announceError={false}
                          onBlur={() => {
                            const validation = validateVariantForm({
                              name: editName,
                              priceThb: editPrice,
                            });
                            setEditPriceError(validation.errors.priceThb);
                          }}
                          hint="ใส่ทศนิยมได้ไม่เกิน 2 ตำแหน่ง"
                          required
                          disabled={saving}
                        />

                        <div className={styles.editActions}>
                          <Button
                            type="submit"
                            pending={saving}
                            pendingLabel="กำลังบันทึก"
                          >
                            บันทึกตัวเลือก
                          </Button>
                          <Button
                            type="button"
                            variant="quiet"
                            disabled={saving}
                            onClick={() => setEditingVariant(null)}
                          >
                            ยกเลิก
                          </Button>
                        </div>
                      </form>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <form className={styles.createForm} onSubmit={handleCreate} noValidate>
          <div className={styles.createHeading}>
            <strong>เพิ่มตัวเลือกใหม่</strong>
          </div>
          <ErrorSummary
            id={`variant-create-error-summary-${product.productId}`}
            items={[
              ...(createNameError
                ? [
                    {
                      fieldId: `variant-create-name-${product.productId}`,
                      message: createNameError,
                    },
                  ]
                : []),
              ...(createPriceError
                ? [
                    {
                      fieldId: `variant-create-price-${product.productId}`,
                      message: createPriceError,
                    },
                  ]
                : []),
            ]}
          />
          <TextField
            id={`variant-create-name-${product.productId}`}
            label="ชื่อตัวเลือก"
            value={createName}
            onChange={(event) => {
              setCreateName(event.target.value);
              setCreateNameError(undefined);
            }}
            error={createNameError}
            announceError={false}
            onBlur={() => {
              const validation = validateVariantForm({
                name: createName,
                priceThb: createPrice,
              });
              setCreateNameError(validation.errors.name);
            }}
            placeholder="เช่น Size M"
            required
            disabled={creating}
          />
          <TextField
            id={`variant-create-price-${product.productId}`}
            label="ราคา (บาท)"
            inputMode="decimal"
            placeholder="250.00"
            value={createPrice}
            onChange={(event) => {
              setCreatePrice(event.target.value);
              setCreatePriceError(undefined);
            }}
            error={createPriceError}
            announceError={false}
            onBlur={() => {
              const validation = validateVariantForm({
                name: createName,
                priceThb: createPrice,
              });
              setCreatePriceError(validation.errors.priceThb);
            }}
            hint="ใส่ทศนิยมได้ไม่เกิน 2 ตำแหน่ง"
            required
            disabled={creating}
          />
          <Button
            type="submit"
            pending={creating}
            pendingLabel="กำลังเพิ่มตัวเลือก"
          >
            เพิ่มตัวเลือก
          </Button>
        </form>
      </div>
    </section>
  );
}
