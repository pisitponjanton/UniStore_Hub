import type { HTMLAttributes, ReactNode } from "react";

import styles from "./operational.module.css";

type Tone = "neutral" | "info" | "success" | "warning" | "danger";

export interface ActionBarProps extends HTMLAttributes<HTMLDivElement> {
  align?: "start" | "end";
  children: ReactNode;
}

export function ActionBar({
  align = "start",
  className,
  children,
  ...props
}: ActionBarProps) {
  const classes = [
    styles.actionBar,
    align === "end" ? styles.actionBarEnd : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
}

export interface FilterToolbarProps
  extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title?: ReactNode;
  summary?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

export function FilterToolbar({
  title = "ตัวกรอง",
  summary,
  actions,
  className,
  children,
  ...props
}: FilterToolbarProps) {
  const classes = [styles.filterToolbar, className].filter(Boolean).join(" ");

  return (
    <section className={classes} aria-label="ตัวกรองรายการ" {...props}>
      <div className={styles.filterToolbarHeader}>
        <div className={styles.filterToolbarTitle}>{title}</div>
        {summary ? (
          <div className={styles.filterToolbarSummary}>{summary}</div>
        ) : null}
      </div>
      <div className={styles.filterToolbarBody}>
        <div className={styles.filterToolbarControls}>{children}</div>
        {actions ? (
          <div className={styles.filterToolbarActions}>{actions}</div>
        ) : null}
      </div>
    </section>
  );
}

export interface NoticeProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  tone?: Tone;
  title?: ReactNode;
  children: ReactNode;
}

export function Notice({
  tone = "neutral",
  title,
  className,
  children,
  ...props
}: NoticeProps) {
  const classes = [styles.notice, className].filter(Boolean).join(" ");

  return (
    <div className={classes} data-tone={tone} {...props}>
      <span className={styles.noticeMarker} aria-hidden="true" />
      <div className={styles.noticeContent}>
        {title ? <div className={styles.noticeTitle}>{title}</div> : null}
        <div className={styles.noticeBody}>{children}</div>
      </div>
    </div>
  );
}

export interface TaskStatusProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  tone?: Tone;
  label: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  metadata?: ReactNode;
  actions?: ReactNode;
}

export function TaskStatus({
  tone = "neutral",
  label,
  title,
  description,
  metadata,
  actions,
  className,
  ...props
}: TaskStatusProps) {
  const classes = [styles.taskStatus, className].filter(Boolean).join(" ");

  return (
    <section className={classes} data-tone={tone} {...props}>
      <span className={styles.taskStatusMarker} aria-hidden="true" />
      <div className={styles.taskStatusContent}>
        <div className={styles.taskStatusLabel}>{label}</div>
        <div className={styles.taskStatusTitle}>{title}</div>
        {description ? (
          <div className={styles.taskStatusDescription}>{description}</div>
        ) : null}
        {metadata ? (
          <div className={styles.taskStatusMeta}>{metadata}</div>
        ) : null}
      </div>
      {actions ? (
        <div className={styles.taskStatusActions}>{actions}</div>
      ) : null}
    </section>
  );
}
