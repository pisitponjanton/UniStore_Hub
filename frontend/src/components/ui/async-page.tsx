"use client";

import { Button } from "./button";
import { ErrorState, ForbiddenState, LoadingState, UnauthorizedState } from "./state-panel";
import styles from "./async-page.module.css";

export type AsyncPageStatus = "loading" | "error" | "unauthorized" | "forbidden";

export interface AsyncPageFallbackProps {
  status: AsyncPageStatus;
  pageTitle: string;
  pageDescription?: string;
  loadingTitle?: string;
  errorTitle?: string;
  backHref: string;
  backLabel?: string;
}

/** Used inside a route's existing <main>; always retains one stable page H1. */
export function AsyncPageFallback({
  status,
  pageTitle,
  pageDescription,
  loadingTitle = "กำลังโหลดข้อมูลล่าสุด",
  errorTitle = "ไม่สามารถโหลดข้อมูลได้",
  backHref,
  backLabel = "กลับไปหน้าก่อนหน้า",
}: AsyncPageFallbackProps) {
  return (
    <div className={styles.layout} data-page-status={status}>
      <header className={styles.header}>
        <h1 className={styles.title}>{pageTitle}</h1>
        {pageDescription ? <p className={styles.description}>{pageDescription}</p> : null}
      </header>
      {status === "loading" ? (
        <>
          <LoadingState title={loadingTitle} description="กำลังเตรียมข้อมูลล่าสุดสำหรับหน้านี้" />
          <div className={styles.skeleton} aria-hidden="true" data-testid="page-loading-skeleton">
            <div className={styles.skeletonBar} />
            <div className={styles.skeletonRow} />
            <div className={styles.skeletonRow} />
            <div className={styles.skeletonRow} />
          </div>
        </>
      ) : null}
      {status === "error" ? (
        <ErrorState
          title={errorTitle}
          description="ข้อมูลยังไม่พร้อมใช้งาน ลองโหลดอีกครั้ง หรือกลับไปพื้นที่ทำงานที่ปลอดภัย"
          actions={
            <div className={styles.actions}>
              <Button type="button" onClick={() => window.location.reload()}>
                ลองใหม่
              </Button>
              <a className={styles.back} href={backHref}>{backLabel}</a>
            </div>
          }
        />
      ) : null}
      {status === "unauthorized" ? (
        <UnauthorizedState actions={<a className={styles.back} href="/login/">เข้าสู่ระบบ</a>} />
      ) : null}
      {status === "forbidden" ? (
        <ForbiddenState actions={<a className={styles.back} href={backHref}>{backLabel}</a>} />
      ) : null}
    </div>
  );
}

/** Preserve route context while an existing page-specific state is displayed. */
export function PageStateHeading({ title, description }: { title: string; description?: string }) {
  return (
    <header className={styles.header} data-page-state-heading>
      <h1 className={styles.title}>{title}</h1>
      {description ? <p className={styles.description}>{description}</p> : null}
    </header>
  );
}

/** Generic list-shape placeholder; only decorative until the real data arrives. */
export function PageLoadingRows() {
  return (
    <div className={styles.skeleton} aria-hidden="true" data-testid="page-loading-skeleton">
      <div className={styles.skeletonBar} />
      <div className={styles.skeletonRow} />
      <div className={styles.skeletonRow} />
      <div className={styles.skeletonRow} />
    </div>
  );
}

export function RecoveryActions({ backHref, backLabel = "กลับไปพื้นที่ทำงาน", onRetry }: {
  backHref: string;
  backLabel?: string;
  /** In-place Retry is preferred; retain reload fallback for existing callers. */
  onRetry?: () => void;
}) {
  return (
    <div className={styles.actions}>
      <Button type="button" onClick={onRetry ?? (() => window.location.reload())}>ลองใหม่</Button>
      <a className={styles.back} href={backHref}>{backLabel}</a>
    </div>
  );
}
