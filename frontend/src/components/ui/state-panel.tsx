import type { ReactNode } from "react";

import styles from "./primitives.module.css";

type StateKind =
  | "loading"
  | "empty"
  | "error"
  | "unauthorized"
  | "forbidden";

interface StatePanelProps {
  kind: StateKind;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}

const stateLabel: Record<StateKind, string> = {
  loading: "Loading",
  empty: "Empty",
  error: "Error",
  unauthorized: "Unauthorized",
  forbidden: "Forbidden",
};

export function StatePanel({
  kind,
  title,
  description,
  actions,
}: StatePanelProps) {
  return (
    <section
      className={styles.statePanel}
      role={kind === "error" ? "alert" : kind === "loading" ? "status" : undefined}
      aria-live={kind === "loading" ? "polite" : undefined}
    >
      <div className={styles.stateContent}>
        {kind === "loading" ? (
          <span className={styles.spinner} aria-hidden="true" />
        ) : (
          <span className={styles.stateEyebrow}>{stateLabel[kind]}</span>
        )}
        <h2 className={styles.stateTitle}>{title}</h2>
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
}: {
  title?: ReactNode;
  description?: ReactNode;
}) {
  return <StatePanel kind="loading" title={title} description={description} />;
}

export function EmptyState({
  title = "ยังไม่มีข้อมูล",
  description,
  actions,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <StatePanel
      kind="empty"
      title={title}
      description={description}
      actions={actions}
    />
  );
}

export function ErrorState({
  title = "ไม่สามารถโหลดข้อมูลได้",
  description = "กรุณาลองใหม่อีกครั้ง",
  actions,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <StatePanel
      kind="error"
      title={title}
      description={description}
      actions={actions}
    />
  );
}

export function UnauthorizedState({
  actions,
}: {
  actions?: ReactNode;
}) {
  return (
    <StatePanel
      kind="unauthorized"
      title="กรุณาเข้าสู่ระบบ"
      description="คุณต้องเข้าสู่ระบบก่อนจึงจะใช้งานส่วนนี้ได้"
      actions={actions}
    />
  );
}

export function ForbiddenState({
  actions,
}: {
  actions?: ReactNode;
}) {
  return (
    <StatePanel
      kind="forbidden"
      title="ไม่มีสิทธิ์เข้าถึง"
      description="บัญชีนี้ไม่มีสิทธิ์ใช้งานส่วนดังกล่าว"
      actions={actions}
    />
  );
}
