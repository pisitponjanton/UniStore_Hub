import type { HTMLAttributes, ReactNode } from "react";

import styles from "../ui/primitives.module.css";

export interface PageShellProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
}

export function PageShell({ children, className, ...props }: PageShellProps) {
  const classes = [styles.pageShell, className].filter(Boolean).join(" ");

  return (
    <main className={classes} {...props}>
      {children}
    </main>
  );
}

export interface PageHeaderProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  metadata?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  metadata,
  actions,
}: PageHeaderProps) {
  return (
    <header className={styles.pageHeader}>
      <div className={styles.pageHeadingGroup}>
        {eyebrow ? <div className={styles.pageEyebrow}>{eyebrow}</div> : null}
        <div className={styles.pageTitleRow}>
          <span className={styles.ledgerMarker} aria-hidden="true" />
          <h1 className={styles.pageTitle}>{title}</h1>
        </div>
        {description ? (
          <p className={styles.pageDescription}>{description}</p>
        ) : null}
        {metadata ? <div className={styles.pageMeta}>{metadata}</div> : null}
      </div>
      {actions ? <div className={styles.pageActions}>{actions}</div> : null}
    </header>
  );
}

export function PageStack({ children }: { children: ReactNode }) {
  return <div className={styles.stack}>{children}</div>;
}
