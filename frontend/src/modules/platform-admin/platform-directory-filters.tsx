"use client";

import styles from "./platform-directory-filters.module.css";

export function PlatformDirectoryFilters<T extends string>({
  label, options, value, onChange,
}: {
  label: string;
  options: readonly { value: T; label: string; count: number }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className={styles.filters} role="group" aria-label={label}>
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label} <span data-numeric>{option.count.toLocaleString("th-TH")}</span>
        </button>
      ))}
    </div>
  );
}
