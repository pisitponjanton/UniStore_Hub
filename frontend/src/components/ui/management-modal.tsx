"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import styles from "./management-modal.module.css";

type ManagementModalProps = {
  title: string;
  description?: string;
  size?: "small" | "medium" | "large";
  formId: string;
  submitLabel: string;
  submitting?: boolean;
  submitDisabled?: boolean;
  dirty?: boolean;
  onClose: () => void;
  children: ReactNode;
};

const tabbableSelector =
  'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])';

export function ManagementModal({
  title, description, size = "medium", formId, submitLabel, submitting = false,
  submitDisabled = false, dirty = false, onClose, children,
}: ManagementModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  useEffect(() => {
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLButtonElement>('[data-modal-close]')?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, []);

  function requestClose() {
    if (submitting) return;
    if (dirty) {
      setConfirmDiscard(true);
      return;
    }
    onClose();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (submitting) return;
      if (confirmDiscard) {
        setConfirmDiscard(false);
      } else {
        requestClose();
      }
      return;
    }
    if (event.key !== "Tab") return;
    const container = panelRef.current;
    if (!container) return;
    const root = confirmDiscard ? container.querySelector<HTMLElement>('[data-discard-confirm]') : container;
    const focusables = Array.from(root?.querySelectorAll<HTMLElement>(tabbableSelector) ?? [])
      .filter(element => element.getClientRects().length > 0);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return createPortal(
    <div className={styles.overlay} onMouseDown={event => {
      if (event.target === event.currentTarget) requestClose();
    }}>
      <div ref={panelRef} role="dialog" aria-modal="true"
        aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined}
        className={[styles.modal, styles[size]].join(" ")} onKeyDown={onKeyDown}>
        <div className={styles.header}>
          <div className={styles.heading}>
            <h2 id={titleId}>{title}</h2>
            {description ? <p id={descriptionId}>{description}</p> : null}
          </div>
          <button type="button" className={styles.iconButton} aria-label="ปิดหน้าต่าง"
            data-modal-close onClick={requestClose} disabled={submitting}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className={styles.body}>{children}</div>
        <div className={styles.footer}>
          <button className={styles.cancel} type="button" onClick={requestClose}
            disabled={submitting}>ยกเลิก</button>
          <button className={styles.submit} type="submit" form={formId}
            disabled={submitting || submitDisabled}>
            {submitting ? "กำลังบันทึก…" : submitLabel}
          </button>
        </div>
        {confirmDiscard ? (
          <div className={styles.confirmOverlay} data-discard-confirm
            role="alertdialog" aria-modal="true" aria-label="ยืนยันการทิ้งข้อมูล"
            aria-describedby={descriptionId + "-discard"}>
            <div className={styles.confirmContent}>
              <strong>ทิ้งข้อมูลที่ยังไม่ได้บันทึก?</strong>
              <p id={descriptionId + "-discard"}>ข้อมูลที่กรอกไว้จะหายไป หากปิดหน้าต่างนี้</p>
              <div className={styles.confirmActions}>
                <button type="button" className={styles.cancel} autoFocus
                  onClick={() => setConfirmDiscard(false)}>กลับไปแก้ไข</button>
                <button type="button" className={styles.discard} onClick={onClose}>ทิ้งข้อมูล</button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
