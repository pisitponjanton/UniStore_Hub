"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ChevronDown, ChevronUp, SlidersHorizontal, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import styles from "./queue-priority-controls.module.css";

export type QueueFilterChip = { key: string; label: string; onRemove: () => void };

type Props = {
  heading: string;
  actionLabel: string;
  countLabel?: string;
  actionCount: number;
  loadedCount: number;
  mode: "all" | "action";
  onChange: (value: "all" | "action") => void;
  listId: string;
  filterId: string;
  filterOpen: boolean;
  onFilterToggle: () => void;
  filterTitle: string;
  filterContent: ReactNode;
  filterError?: string | null;
  activeFilterCount?: number;
};

export function QueuePriorityControls({
  heading, actionCount, loadedCount, mode, onChange, listId, filterId,
  filterOpen, onFilterToggle, filterTitle, filterContent, filterError, activeFilterCount = 0,
}: Props) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const userDismissedRef = useRef(false);
  const [anchor, setAnchor] = useState<CSSProperties>({ top: 76, right: 24 });

  const reposition = useCallback(() => {
    const bounds = triggerRef.current?.getBoundingClientRect();
    if (!bounds) return;
    // Desktop: align with right edge of filter trigger; mobile layout uses CSS bottom sheet.
    const top = Math.min(window.innerHeight - 140, bounds.bottom + 8);
    setAnchor({
      top,
      right: Math.max(12, window.innerWidth - bounds.right),
      maxHeight: Math.max(180, Math.min(570, window.innerHeight - top - 14)),
    });
  }, []);

  useEffect(() => {
    if (!filterOpen || !filterError) return;
    const handle = window.setTimeout(() => errorRef.current?.focus({ preventScroll: true }), 110);
    return () => window.clearTimeout(handle);
  }, [filterOpen, filterError]);

  useEffect(() => {
    if (!filterOpen) return;
    reposition();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [filterOpen, reposition]);

  return (
    <DialogPrimitive.Root open={filterOpen} onOpenChange={next => {
      if (next !== filterOpen) {
        userDismissedRef.current = !next;
        onFilterToggle();
      }
    }}>
      <div className={styles.controls} role="group" aria-label={heading}>
        <div className={styles.filters} role="group" aria-label="มุมมองรายการที่โหลดแล้ว">
          <button type="button" aria-pressed={mode === "all"} aria-controls={listId}
            onClick={() => onChange("all")}>
            ทั้งหมด <span data-numeric>{loadedCount}</span>
          </button>
          <button type="button" aria-pressed={mode === "action"} aria-controls={listId}
            onClick={() => onChange("action")}>
            รอดำเนินการ <span data-numeric>{actionCount}</span>
          </button>
        </div>
        <span className={styles.loadedNote}>เฉพาะรายการที่โหลดแล้ว</span>
        <DialogPrimitive.Trigger asChild>
          <button ref={triggerRef} type="button" className={styles.filterToggle}
            aria-expanded={filterOpen} aria-controls={filterOpen ? filterId : undefined}
            onClick={reposition}>
            <SlidersHorizontal size={17} aria-hidden="true" />
            ตัวกรอง {activeFilterCount > 0 ? <span className={styles.count}>{activeFilterCount}</span> : null}
            {filterOpen ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
          </button>
        </DialogPrimitive.Trigger>
      </div>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={styles.backdrop} />
        <DialogPrimitive.Content
          id={filterId}
          className={styles.popover}
          style={anchor}
          aria-describedby={undefined}
          onCloseAutoFocus={event => {
            if (!userDismissedRef.current) {
              const feedback = document.querySelector<HTMLElement>('[data-queue-filter-feedback="success"]');
              if (feedback) {
                event.preventDefault();
                requestAnimationFrame(() => {
                  feedback.focus({ preventScroll: true });
                  feedback.scrollIntoView?.({ block: "nearest" });
                });
              }
            }
            userDismissedRef.current = false;
          }}
        >
          <div className={styles.popoverHeading}>
            <DialogPrimitive.Title className={styles.popoverTitle}>{filterTitle}</DialogPrimitive.Title>
            <DialogPrimitive.Close className={styles.closeButton} aria-label="ปิดตัวกรอง">
              <X size={18} aria-hidden="true" />
            </DialogPrimitive.Close>
          </div>
          <div className={styles.popoverBody}>
            {filterError ? <p tabIndex={-1} ref={errorRef} className={styles.filterError}
              data-queue-filter-popover-error role="alert">{filterError}</p> : null}
            {filterContent}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function QueueActiveFilters({ chips, disabled = false }: { chips: QueueFilterChip[]; disabled?: boolean }) {
  if (!chips.length) return null;
  return (
    <div className={styles.chips} role="group" aria-label="ตัวกรองที่ใช้อยู่">
      {chips.map(chip => (
        <button key={chip.key} type="button" className={styles.chip}
          disabled={disabled} onClick={chip.onRemove}
          aria-label={"ลบตัวกรอง " + chip.label}>
          <span>{chip.label}</span><X size={14} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

export function QueueFilterEmpty({ onShowAll }: { onShowAll: () => void }) {
  return (
    <div className={styles.zero} role="note">
      <span>ไม่มีรายการที่ต้องทำในมุมมองนี้</span>
      <button type="button" onClick={onShowAll}>ดูทั้งหมด</button>
    </div>
  );
}
