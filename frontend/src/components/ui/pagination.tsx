"use client";

import { Button } from "./button";
import styles from "./pagination.module.css";

export function PaginationControls({
  currentPage,
  pageSize,
  totalItems,
  onPageChange,
  label = "การแบ่งหน้ารายการ",
}: {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  label?: string;
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  if (totalItems <= pageSize) return null;

  const firstItem = (currentPage - 1) * pageSize + 1;
  const lastItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <nav className={styles.pagination} aria-label={label}>
      <span className={styles.summary} aria-live="polite">
        แสดง {firstItem.toLocaleString("th-TH")}–{lastItem.toLocaleString("th-TH")} จาก {totalItems.toLocaleString("th-TH")} รายการ
      </span>
      <div className={styles.controls}>
        <Button
          variant="secondary"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          ก่อนหน้า
        </Button>
        <span className={styles.pageCount} aria-current="page">
          หน้า {currentPage.toLocaleString("th-TH")} / {totalPages.toLocaleString("th-TH")}
        </span>
        <Button
          variant="secondary"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          ถัดไป
        </Button>
      </div>
    </nav>
  );
}
