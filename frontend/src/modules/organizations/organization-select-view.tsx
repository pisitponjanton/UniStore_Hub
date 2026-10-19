"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { LoadedDirectoryControls } from "@/modules/organization-directory/loaded-directory-controls";
import { searchLoadedItems, visibleLoadedItems } from "@/modules/organization-directory/loaded-directory-helpers";

import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  ErrorSummary,
  useErrorSummaryFocus,
  LoadingState,
  Notice,
  TextareaField,
  TextField,
} from "@/components";
import {
  authSession,
  isDefinitiveSessionFailure,
  rememberActiveOrganizationId,
  useAuthSession,
} from "@/modules/auth";
import { ApiClientError } from "@/services";
import type { OrganizationDTO } from "@/types";

import {
  joinAccessibleOrganizations,
  organizationLandingHref,
  settingsHref,
  validateOrganizationForm,
} from "./organization-helpers";
import { organizationService } from "./organization-service";
import styles from "./organization-view.module.css";

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "success"; organizations: OrganizationDTO[] };

function organizationStatusLabel(status: OrganizationDTO["status"]) {
  switch (status) {
    case "PENDING":
      return "รออนุมัติ";
    case "ACTIVE":
      return "พร้อมใช้งาน";
    case "SUSPENDED":
      return "ถูกระงับ";
  }
}

function organizationStatusTone(
  status: OrganizationDTO["status"],
): "warning" | "success" | "danger" {
  switch (status) {
    case "PENDING":
      return "warning";
    case "ACTIVE":
      return "success";
    case "SUSPENDED":
      return "danger";
  }
}

function membershipRoleLabel(
  role: "STAFF" | "ORGANIZATION_ADMIN",
): string {
  return role === "ORGANIZATION_ADMIN"
    ? "ผู้ดูแลหน่วยงาน"
    : "เจ้าหน้าที่";
}

export function OrganizationSelectView() {
  const focusErrorSummary = useErrorSummaryFocus();
  const retryFocusRequested = useRef(false);
  const actionFeedbackFocusRequested = useRef(false);
  const router = useRouter();
  const auth = useAuthSession();
  const [loadState, setLoadState] = useState<LoadState>({
    status: "loading",
  });
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [directoryQuery, setDirectoryQuery] = useState("");
  const [directoryLimit, setDirectoryLimit] = useState(24);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [nameError, setNameError] = useState<string | undefined>();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Only relocate focus following an explicit user action, not hydration.
  useEffect(() => {
    if (!retryFocusRequested.current || loadState.status === "loading") return;
    retryFocusRequested.current = false;
    const frame = window.requestAnimationFrame(() => {
      const heading = document.getElementById("organization-select-heading");
      heading?.focus();
      heading?.scrollIntoView({ block: "start", behavior: "instant" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loadState.status]);

  useEffect(() => {
    if (!actionFeedbackFocusRequested.current || creating || !submitError) return;
    actionFeedbackFocusRequested.current = false;
    const frame = window.requestAnimationFrame(() => {
      const feedback = document.getElementById("organization-action-feedback");
      feedback?.focus();
      feedback?.scrollIntoView({ block: "nearest", behavior: "instant" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [submitError, creating]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadOrganizations() {
      try {
        const organizations = await organizationService.listAccessible({
          signal: controller.signal,
        });

        if (!controller.signal.aborted) {
          setLoadState({ status: "success", organizations });
        }
      } catch (error) {
        if (
          controller.signal.aborted ||
          (error instanceof DOMException && error.name === "AbortError")
        ) {
          return;
        }

        if (isDefinitiveSessionFailure(error)) {
          authSession.logout();
          return;
        }

        setLoadState({ status: "error" });
      }
    }

    void loadOrganizations();

    return () => controller.abort();
  }, [loadAttempt]);

  const accessible = useMemo(() => {
    if (
      auth.status !== "authenticated" ||
      loadState.status !== "success"
    ) {
      return [];
    }

    return joinAccessibleOrganizations(
      loadState.organizations,
      auth.memberships,
    );
  }, [auth, loadState]);

  const directoryMatches = searchLoadedItems(accessible, directoryQuery, entry => [
    entry.organization.name, entry.organization.description,
    entry.organization.organizationId, entry.membership.role,
  ]);
  const directoryVisible = visibleLoadedItems(directoryMatches, directoryLimit);

  function handleSelect(
    organizationId: string,
    role: "STAFF" | "ORGANIZATION_ADMIN",
  ) {
    if (
      auth.status !== "authenticated" ||
      !rememberActiveOrganizationId(organizationId, auth.memberships)
    ) {
      actionFeedbackFocusRequested.current = true;
      setSubmitError(
        "ไม่สามารถเลือกหน่วยงานนี้ได้ กรุณารีเฟรชสิทธิ์แล้วลองใหม่",
      );
      return;
    }

    router.push(organizationLandingHref(organizationId, role));
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (creating) {
      return;
    }

    const validation = validateOrganizationForm({
      name,
      description,
    });

    setNameError(validation.errors.name);
    setSubmitError(null);

    if (!validation.valid) {
      focusErrorSummary("organization-create-error-summary");
      return;
    }

    actionFeedbackFocusRequested.current = true;
    setCreating(true);

    try {
      const organization = await organizationService.create(
        validation.values,
      );
      const refreshed = await authSession.restore();

      if (
        refreshed.status !== "authenticated" ||
        !rememberActiveOrganizationId(
          organization.organizationId,
          refreshed.memberships,
        )
      ) {
        setSubmitError(
          "สร้างหน่วยงานสำเร็จแล้ว แต่ยังรีเฟรชสิทธิ์ไม่สำเร็จ กรุณาโหลดหน้าใหม่อีกครั้ง",
        );
        return;
      }

      router.push(settingsHref(organization.organizationId));
    } catch (error) {
      if (isDefinitiveSessionFailure(error)) {
        authSession.logout();
        return;
      }

      setSubmitError(
        error instanceof ApiClientError
          ? error.userMessage
          : "ไม่สามารถสร้างหน่วยงานได้ กรุณาลองใหม่อีกครั้ง",
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className={styles.page} data-page="organization-entry">
      <main className={styles.main}>
        <header className={styles.workspaceHeader} data-workspace-state={loadState.status}>
          <div className={styles.headerCopy}>
            <span className={styles.entryEyebrow}>พื้นที่ทำงาน / หน่วยงานที่ได้รับสิทธิ์</span>
            <h1 id="organization-select-heading" tabIndex={-1} className={styles.title}>วันนี้จะทำงานกับหน่วยงานไหน?</h1>
            <p className={styles.description}>
              เลือกหน่วยงานของคุณเพื่อเปิดงานที่ได้รับมอบหมาย แต่ละแห่งมีบทบาทและสิทธิ์แยกจากกัน
            </p>
          </div>

          {loadState.status === "success" ? (
            <div
              className={styles.headerSummary}
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              <span className={styles.headerSummaryLabel}>เข้าถึงได้</span>
              <strong data-numeric>{accessible.length}</strong>
              <span>หน่วยงาน</span>
              <a href="#organizations" className={styles.workspaceJump}>ไปที่รายชื่อ ↓</a>
            </div>
          ) : null}
        </header>

        {submitError ? (
          <div id="organization-action-feedback" tabIndex={-1}>
            <Notice tone="danger" role="alert" title="ดำเนินการไม่สำเร็จ">
              {submitError}
            </Notice>
          </div>
        ) : null}

        <div className={styles.workspaceGrid}>
          <section
            className={styles.organizationSection}
            aria-labelledby="organizations"
          >
            <div className={styles.sectionHeading}>
              <div>
                <h2 className={styles.sectionTitle} id="organizations">
                  เลือกพื้นที่เพื่อเริ่มงาน
                </h2>
              </div>
              <p className={styles.sectionDescription}>
                ดูสถานะและสิทธิ์ของแต่ละหน่วยงาน แล้วกดเข้าใช้งานที่ต้องการ
              </p>
            </div>

            {loadState.status === "loading" ? (
              <LoadingState
                title="กำลังโหลดหน่วยงาน"
                description="กำลังตรวจสอบหน่วยงานและสิทธิ์ที่บัญชีนี้เข้าถึงได้"
              />
            ) : null}

            {loadState.status === "error" ? (
              <ErrorState
                title="ไม่สามารถโหลดหน่วยงานได้"
                description="ลองดึงหน่วยงานและสิทธิ์ล่าสุดอีกครั้ง"
                actions={
                  <Button
                    onClick={() => {
                      retryFocusRequested.current = true;
                      setLoadState({ status: "loading" });
                      setLoadAttempt((attempt) => attempt + 1);
                    }}
                  >
                    ลองโหลดอีกครั้ง
                  </Button>
                }
              />
            ) : null}

            {loadState.status === "success" && accessible.length === 0 ? (
              <EmptyState
                title="ยังไม่มีหน่วยงานที่เข้าถึงได้"
                description="หากต้องการเริ่มพื้นที่ใหม่ สามารถสร้างหน่วยงานได้จากแบบฟอร์มด้านข้าง"
              />
            ) : null}

            {loadState.status === "success" && accessible.length > 0 ? (
              <>
                <LoadedDirectoryControls
                  id="organization-directory-search"
                  label="ค้นหาหน่วยงานที่เข้าถึงได้"
                  query={directoryQuery}
                  onQueryChange={value => { setDirectoryQuery(value); setDirectoryLimit(24); }}
                  loadedCount={accessible.length}
                  matchingCount={directoryMatches.length}
                  visibleCount={directoryVisible.length}
                  onShowMore={() => setDirectoryLimit(value => value + 24)}
                  placeholder="ชื่อหน่วยงาน คำอธิบาย หรือรหัส"
                />
                <ul className={styles.organizationList}>
                {directoryVisible.map(({ organization, membership }) => (
                  <li
                    className={styles.organizationRow}
                    key={organization.organizationId}
                  >
                    <div className={styles.organizationCopy}>
                      <div className={styles.organizationHeading}>
                        <h3 className={styles.organizationName}>
                          {organization.name}
                        </h3>
                        <div className={styles.metaRow}>
                          <Badge
                            tone={organizationStatusTone(organization.status)}
                          >
                            {organizationStatusLabel(organization.status)}
                          </Badge>
                          <Badge
                            tone={
                              membership.role === "ORGANIZATION_ADMIN"
                                ? "info"
                                : "neutral"
                            }
                          >
                            {membershipRoleLabel(membership.role)}
                          </Badge>
                        </div>
                      </div>

                      <p className={styles.organizationDescription}>
                        {organization.description ||
                          "ยังไม่มีคำอธิบายหน่วยงาน"}
                      </p>

                      <details className={styles.organizationTechnical}>
                        <summary>ดูรหัสหน่วยงาน</summary>
                        <code className={styles.organizationReference} data-technical>
                          {organization.organizationId}
                        </code>
                      </details>
                    </div>

                    <div className={styles.organizationAction}>
                      <Button
                        aria-label={`เข้าใช้งาน ${organization.name}`}
                        onClick={() =>
                          handleSelect(
                            organization.organizationId,
                            membership.role,
                          )
                        }
                      >
                        เข้าใช้งาน
                      </Button>
                    </div>
                  </li>
                ))}
                </ul>
              </>
            ) : null}
          </section>

          <aside className={styles.createPanel} aria-labelledby="create-organization">
            <div className={styles.createPanelHeading}>
              <h2 className={styles.sectionTitle} id="create-organization">
                ต้องการพื้นที่ใหม่?
              </h2>
              <p className={styles.sectionDescription}>
                สร้างหน่วยงานเฉพาะเมื่อยังไม่มีพื้นที่ที่ต้องการ ผู้สร้างจะเป็นผู้ดูแลและต้องรออนุมัติจากส่วนกลาง
              </p>
            </div>

            <form className={styles.form} onSubmit={handleCreate} noValidate>
              <ErrorSummary
                id="organization-create-error-summary"
                items={
                  nameError
                    ? [{ fieldId: "organization-name", message: nameError }]
                    : []
                }
              />
              <TextField
                id="organization-name"
                label="ชื่อหน่วยงาน"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setNameError(undefined);
                  setSubmitError(null);
                }}
                error={nameError}
                announceError={false}
                onBlur={() => {
                  const validation = validateOrganizationForm({
                    name,
                    description,
                  });
                  setNameError(validation.errors.name);
                }}
                required
                disabled={creating}
              />

              <TextareaField
                id="organization-description"
                label="คำอธิบาย"
                value={description}
                onChange={(event) => {
                  setDescription(event.target.value);
                  setSubmitError(null);
                }}
                disabled={creating}
              />

              <div className={styles.createActions}>
                <Button
                  type="submit"
                  size="large"
                  pending={creating}
                  pendingLabel="กำลังสร้างหน่วยงาน"
                >
                  สร้างหน่วยงาน
                </Button>
                <span className={styles.createHint}>
                  หลังสร้างสำเร็จ ระบบจะพาไปตั้งค่าหน่วยงานต่อ
                </span>
              </div>
            </form>
          </aside>
        </div>
      </main>
    </div>
  );
}
