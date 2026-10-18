"use client";

import styles from "./loaded-directory-controls.module.css";

type Props = {
  id: string;
  label: string;
  query: string;
  onQueryChange: (text: string) => void;
  loadedCount: number;
  matchingCount: number;
  visibleCount: number;
  onShowMore: () => void;
  pageSize?: number;
  placeholder?: string;
  disabled?: boolean;
};

export function LoadedDirectoryControls({
  id, label, query, onQueryChange, loadedCount, matchingCount, visibleCount,
  onShowMore, pageSize = 24, placeholder = "ค้นหาจากชื่อหรือรหัสในรายการที่โหลด", disabled,
}: Props) {
  return (
    <div className={styles.panel} role="search" aria-label={label}>
      <div className={styles.field}>
        <label htmlFor={id}>{label}</label>
        <div className={styles.inputRow}>
          <input
            id={id} type="search" autoComplete="off" value={query} disabled={disabled}
            onChange={event => onQueryChange(event.target.value)}
            placeholder={placeholder}
          />
          {query ? (
            <button type="button" onClick={() => onQueryChange("")} disabled={disabled} aria-label="ล้างคำค้นหา">
              ล้าง
            </button>
          ) : null}
        </div>
      </div>
      <p className={styles.context} aria-live="polite">
        แสดง {visibleCount.toLocaleString("th-TH")} จาก {matchingCount.toLocaleString("th-TH")} รายการที่ตรงคำค้นหา
        <span> · ค้นหาเฉพาะ {loadedCount.toLocaleString("th-TH")} รายการที่โหลดมาแล้ว</span>
      </p>
      {matchingCount === 0 && loadedCount > 0 ? (
        <p className={styles.empty}>ไม่พบรายการที่ตรงคำค้นหา ลองเปลี่ยนคำหรือกดล้าง</p>
      ) : null}
      {matchingCount > visibleCount ? (
        <button className={styles.more} type="button" onClick={onShowMore}>
          แสดงเพิ่มอีก {Math.min(pageSize, matchingCount - visibleCount)} รายการจากที่โหลด
        </button>
      ) : null}
    </div>
  );
}
