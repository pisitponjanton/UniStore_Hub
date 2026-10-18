"use client";

import styles from "./queue-priority-controls.module.css";

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
  filterLabel?: string;
};

export function QueuePriorityControls({
  heading, actionLabel, countLabel, actionCount, loadedCount, mode, onChange, listId, filterId,
  filterLabel = "ตัวกรองรายการ",
}: Props) {
  return (
    <nav className={styles.controls} aria-label={heading}>
      <a className={styles.primary} href={"#" + listId}>
        <span>ดูคิว{actionLabel}</span>
        <strong data-numeric>{actionCount} {countLabel ?? actionLabel}</strong>
      </a>
      <div className={styles.filters} role="group" aria-label="มุมมองรายการที่โหลดแล้ว">
        <button type="button" aria-pressed={mode === "all"} onClick={() => onChange("all")}>
          ทั้งหมด <span data-numeric>{loadedCount}</span>
        </button>
        <button type="button" aria-pressed={mode === "action"} onClick={() => onChange("action")}>
          รอดำเนินการ <span data-numeric>{actionCount}</span>
        </button>
      </div>
      <a className={styles.secondary} href={"#" + filterId}>{filterLabel}</a>
      <span className={styles.caption}>นับเฉพาะรายการที่โหลดแล้ว ไม่ใช่ยอดรวมทั้งระบบ</span>
    </nav>
  );
}


export function QueueFilterEmpty({ onShowAll }: { onShowAll: () => void }) {
  return (
    <div className={styles.zero} role="note">
      <span>ไม่มีงานที่ต้องดำเนินการจากรายการที่โหลดอยู่</span>
      <button type="button" onClick={onShowAll}>ดูทุกรายการ</button>
    </div>
  );
}
