"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Check, X } from "lucide-react";

import styles from "./operation-toast.module.css";

/** A lightweight, dismissible confirmation that never shifts the editor's layout. */
export function OperationToast({
  message,
  onDismiss,
}: {
  message: string | null;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(onDismiss, 5500);
    return () => window.clearTimeout(timeout);
  }, [message, onDismiss]);

  if (!message || typeof document === "undefined") return null;

  return createPortal(
    <div data-operation-toast className={styles.toast} role="status" aria-live="polite" aria-atomic="true">
      <Check size={17} aria-hidden="true" className={styles.icon} />
      <span className={styles.message}>{message}</span>
      <button type="button" aria-label="ปิดการแจ้งเตือน" className={styles.dismiss}
        onClick={onDismiss}>
        <X size={16} aria-hidden="true" />
      </button>
    </div>,
    document.body,
  );
}
