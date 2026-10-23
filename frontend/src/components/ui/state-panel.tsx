import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import styles from "./primitives.module.css";

type StateKind =
  | "loading"
  | "empty"
  | "error"
  | "unauthorized"
  | "forbidden";

type StateHeadingLevel = 1 | 2;

interface StatePanelProps {
  kind: StateKind;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  media?: ReactNode;
  headingLevel?: StateHeadingLevel;
}

const stateLabel: Record<Exclude<StateKind, "loading">, string> = {
  empty: "ยังไม่มีข้อมูล",
  error: "เกิดข้อผิดพลาด",
  unauthorized: "ต้องเข้าสู่ระบบ",
  forbidden: "ไม่มีสิทธิ์เข้าถึง",
};

export function StatePanel({
  kind,
  title,
  description,
  actions,
  media,
  headingLevel = 2,
}: StatePanelProps) {
  const Heading = headingLevel === 1 ? "h1" : "h2";

  return (
    <section
      className={styles.statePanel}
      data-state-kind={kind}
      role={
        kind === "error"
          ? "alert"
          : kind === "loading"
            ? "status"
            : undefined
      }
      aria-live={kind === "loading" ? "polite" : undefined}
      aria-atomic={kind === "loading" ? true : undefined}
      aria-busy={kind === "loading" ? true : undefined}
    >
      <div className={styles.stateContent}>
        {media ? <div className={styles.stateMedia}>{media}</div> : null}
        {kind === "loading" ? (
          <span className={styles.spinner} aria-hidden="true" />
        ) : kind === "empty" ? null : (
          <span className={styles.stateLabel}>
            <span className={styles.stateDot} aria-hidden="true" />
            <span>{stateLabel[kind]}</span>
          </span>
        )}
        <Heading className={styles.stateTitle}>{title}</Heading>
        {description ? (
          <p className={styles.stateDescription}>{description}</p>
        ) : null}
        {actions ? <div className={styles.stateActions}>{actions}</div> : null}
      </div>
    </section>
  );
}

export function LoadingState({
  title = "กำลังโหลดข้อมูล",
  description,
  headingLevel,
}: {
  title?: ReactNode;
  description?: ReactNode;
  headingLevel?: StateHeadingLevel;
}) {
  return (
    <StatePanel
      kind="loading"
      title={title}
      description={description}
      headingLevel={headingLevel}
    />
  );
}

/** Shared illustration for genuinely empty collections and filtered results. */
export function EmptyIllustration({ compact = false }: { compact?: boolean }) {
  return (
    <Image
      src="/images/empty.png"
      alt=""
      aria-hidden="true"
      width={1402}
      height={1122}
      unoptimized
      data-empty-artwork
      className={compact ? styles.emptyArtworkCompact : styles.emptyArtwork}
    />
  );
}

export function EmptyState({
  title = "ยังไม่มีข้อมูล",
  description,
  actions,
  media,
  headingLevel,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  media?: ReactNode;
  headingLevel?: StateHeadingLevel;
}) {
  return (
    <StatePanel
      kind="empty"
      title={title}
      description={description}
      actions={actions}
      media={media ?? <EmptyIllustration />}
      headingLevel={headingLevel}
    />
  );
}

export function ErrorState({
  title = "ไม่สามารถโหลดข้อมูลได้",
  description = "กรุณาลองใหม่อีกครั้ง",
  actions,
  headingLevel,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  headingLevel?: StateHeadingLevel;
}) {
  return (
    <StatePanel
      kind="error"
      title={title}
      description={description}
      actions={actions}
      headingLevel={headingLevel}
    />
  );
}

export function UnauthorizedState({
  actions,
  headingLevel,
}: {
  actions?: ReactNode;
  headingLevel?: StateHeadingLevel;
}) {
  return (
    <StatePanel
      kind="unauthorized"
      title="กรุณาเข้าสู่ระบบ"
      description="คุณต้องเข้าสู่ระบบก่อนจึงจะใช้งานส่วนนี้ได้"
      actions={actions ?? <a href="/login/" className={styles.stateFallbackLink}>เข้าสู่ระบบ</a>}
      headingLevel={headingLevel}
    />
  );
}

export function ForbiddenState({
  actions,
  headingLevel,
}: {
  actions?: ReactNode;
  headingLevel?: StateHeadingLevel;
}) {
  return (
    <StatePanel
      kind="forbidden"
      title="ไม่มีสิทธิ์เข้าถึง"
      description="บัญชีนี้ไม่มีสิทธิ์ใช้งานส่วนดังกล่าว"
      actions={actions ?? <Link href="/" className={styles.stateFallbackLink}>กลับหน้าร้าน</Link>}
      headingLevel={headingLevel}
    />
  );
}
