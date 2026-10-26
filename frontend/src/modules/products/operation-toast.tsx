"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, AlertTriangle, Check, X } from "lucide-react";

import styles from "./operation-toast.module.css";

type ToastTone = "success" | "danger" | "warning";

/** Overlay feedback: success expires; errors remain readable until dismissed. */
export function OperationToast({
  message,
  onDismiss,
  title,
  tone = "success",
  feedback = false,
}: {
  message: string | null;
  onDismiss: () => void;
  title?: string;
  tone?: ToastTone;
  /** Upload feedback receives keyboard focus without scrolling the editor. */
  feedback?: boolean;
}) {
  const toastRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!message || tone !== "success") return;
    const timeout = window.setTimeout(onDismiss, 5500);
    return () => window.clearTimeout(timeout);
  }, [message, tone, onDismiss]);

  useEffect(() => {
    if (message && feedback) toastRef.current?.focus({ preventScroll: true });
  }, [message, feedback]);

  if (!message || typeof document === "undefined") return null;

  const Icon = tone === "danger" ? AlertCircle : tone === "warning" ? AlertTriangle : Check;
  return createPortal(
    <div
      ref={toastRef}
      data-operation-toast
      data-tone={tone}
      data-product-upload-feedback={feedback ? "" : undefined}
      tabIndex={feedback ? -1 : undefined}
      className={styles.toast}
      role={tone === "success" ? "status" : "alert"}
      aria-live={tone === "success" ? "polite" : "assertive"}
      aria-atomic="true"
    >
      <Icon size={17} aria-hidden="true" className={styles.icon} />
      <span className={styles.message}>
        {title ? <strong className={styles.title}>{title}</strong> : null}
        {message}
      </span>
      <button type="button" aria-label="ปิดการแจ้งเตือน" className={styles.dismiss}
        onClick={onDismiss}>
        <X size={16} aria-hidden="true" />
      </button>
    </div>,
    document.body,
  );
}
