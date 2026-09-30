"use client";

import { useState, type FormEvent } from "react";

import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
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
      return "ไม่พบ Variant นี้แล้ว กรุณาโหลดข้อมูลสินค้าใหม่";
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
        `สร้าง Variant ${created.name} ราคา ${formatSatang(created.price)} แล้ว`,
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
        `บันทึก Variant ${updated.name} ราคา ${formatSatang(updated.price)} แล้ว`,
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

      setNotice(`ปิดใช้งาน Variant ${variant.name} แล้ว`);
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
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.headerCopy}>
          <h3 className={styles.title}>Variants</h3>
          <p className={styles.description}>
            ราคาในแบบฟอร์มใช้หน่วยบาท (THB)
            และจะถูกแปลงเป็น integer satang ก่อนส่ง API
          </p>
        </div>
        <Badge tone="info">{variants.length} Variant</Badge>
      </div>

      {error ? (
        <div className={styles.error} role="alert">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className={styles.notice} role="status">
          {notice}
        </div>
      ) : null}

      <form className={styles.form} onSubmit={handleCreate}>
        <strong>เพิ่ม Variant</strong>
        <TextField
          id={`variant-create-name-${product.productId}`}
          label="ชื่อ Variant"
          value={createName}
          onChange={(event) => {
            setCreateName(event.target.value);
            setCreateNameError(undefined);
          }}
          error={createNameError}
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
          hint="รองรับทศนิยมไม่เกิน 2 ตำแหน่ง"
          required
          disabled={creating}
        />
        <Button
          type="submit"
          pending={creating}
          pendingLabel="กำลังเพิ่ม"
        >
          เพิ่ม Variant
        </Button>
      </form>

      {variants.length === 0 ? (
        <EmptyState
          title="ยังไม่มี Variant"
          description="เพิ่ม Variant แรกเพื่อกำหนดตัวเลือกและราคาของสินค้า"
        />
      ) : (
        <div className={styles.list}>
          {variants.map((variant) => {
            const saving =
              savingVariantId === variant.variantId;
            const deactivating =
              deactivatingVariantId === variant.variantId;
            const busy = saving || deactivating;

            return (
              <article
                className={styles.card}
                key={variant.variantId}
              >
                <div className={styles.cardHeader}>
                  <div className={styles.cardCopy}>
                    <span className={styles.name}>
                      {variant.name}
                    </span>
                    <span className={styles.price}>
                      {formatSatang(variant.price)}
                    </span>
                    <span className={styles.meta}>
                      Variant ID: {variant.variantId}
                    </span>
                  </div>
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

                <div className={styles.actions}>
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => openEdit(variant)}
                  >
                    แก้ไข Variant
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
                      title="ยืนยันการปิดใช้งาน Variant"
                      description={`ปิดใช้งาน Variant ${variant.name} ใช่หรือไม่ การลบใน MVP เป็น soft deactivate และไม่เปลี่ยน historical OrderItem snapshots`}
                      confirmLabel="ปิดใช้งาน Variant"
                      danger
                      pending={deactivating}
                      onConfirm={() => {
                        void handleDeactivate(variant);
                      }}
                    />
                  ) : null}
                </div>

                {editingVariant?.variantId ===
                variant.variantId ? (
                  <form
                    className={styles.editForm}
                    onSubmit={handleSave}
                  >
                    <TextField
                      id={`variant-edit-name-${variant.variantId}`}
                      label="ชื่อ Variant"
                      value={editName}
                      onChange={(event) => {
                        setEditName(event.target.value);
                        setEditNameError(undefined);
                      }}
                      error={editNameError}
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
                      hint="ระบบจะ normalize เป็น integer satang ก่อนส่ง"
                      required
                      disabled={saving}
                    />

                    <div className={styles.actions}>
                      <Button
                        type="submit"
                        pending={saving}
                        pendingLabel="กำลังบันทึก"
                      >
                        บันทึก Variant
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
  );
}
