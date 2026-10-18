"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import type { ComponentProps, ReactNode } from "react";

import { Button } from "./button";
import styles from "./primitives.module.css";

export interface DialogProps {
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onCloseAutoFocus?: ComponentProps<typeof DialogPrimitive.Content>["onCloseAutoFocus"];
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  closeLabel?: string;
}

export function Dialog({
  trigger,
  open,
  onOpenChange,
  onCloseAutoFocus,
  title,
  description,
  children,
  footer,
  closeLabel = "ปิด",
}: DialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? (
        <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>
      ) : null}
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={styles.overlay} />
        <DialogPrimitive.Content className={styles.dialogContent} aria-modal="true" onCloseAutoFocus={onCloseAutoFocus}>
          <div className={styles.dialogHeader}>
            <DialogPrimitive.Title className={styles.dialogTitle}>
              {title}
            </DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className={styles.dialogDescription}>
                {description}
              </DialogPrimitive.Description>
            ) : null}
          </div>
          {children ? <div className={styles.dialogBody}>{children}</div> : null}
          {footer ? <div className={styles.dialogFooter}>{footer}</div> : null}
          <DialogPrimitive.Close className={styles.dialogClose} aria-label={closeLabel}>
            <span className={styles.dialogCloseSymbol} aria-hidden="true" />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export interface ConfirmDialogProps {
  trigger: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onCloseAutoFocus?: ComponentProps<typeof DialogPrimitive.Content>["onCloseAutoFocus"];
  title: ReactNode;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  pending?: boolean;
  danger?: boolean;
  onConfirm: () => void;
}

export function ConfirmDialog({
  trigger,
  open,
  onOpenChange,
  onCloseAutoFocus,
  title,
  description,
  confirmLabel = "ยืนยัน",
  cancelLabel = "ยกเลิก",
  pending = false,
  danger = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={styles.overlay} />
        <DialogPrimitive.Content
          className={styles.dialogContent}
          aria-modal="true"
          onCloseAutoFocus={onCloseAutoFocus}
          onEscapeKeyDown={(event) => {
            if (pending) {
              event.preventDefault();
            }
          }}
          onPointerDownOutside={(event) => {
            if (pending) {
              event.preventDefault();
            }
          }}
        >
          <div className={styles.dialogHeader}>
            <DialogPrimitive.Title className={styles.dialogTitle}>
              {title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className={styles.dialogDescription}>
              {description}
            </DialogPrimitive.Description>
          </div>
          <div className={styles.dialogFooter}>
            <DialogPrimitive.Close asChild>
              <Button variant="secondary" disabled={pending}>
                {cancelLabel}
              </Button>
            </DialogPrimitive.Close>
            <Button
              variant={danger ? "danger" : "primary"}
              pending={pending}
              pendingLabel="กำลังดำเนินการ"
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </div>
          <DialogPrimitive.Close
            className={styles.dialogClose}
            aria-label="ปิด"
            disabled={pending}
          >
            <span className={styles.dialogCloseSymbol} aria-hidden="true" />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
