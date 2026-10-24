"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, CircleAlert, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { LoadedDirectoryControls } from "@/modules/organization-directory/loaded-directory-controls";
import { searchLoadedItems, visibleLoadedItems } from "@/modules/organization-directory/loaded-directory-helpers";

import {
  Badge,
  Button,
  Dialog,
  ErrorState,
  LoadingState,
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
  applicationHref,
  organizationLandingHref,
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
  const [nameEdited, setNameEdited] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createdOrganizationId, setCreatedOrganizationId] = useState<string | null>(null);

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

  const newApplicant = loadState.status === "success" && accessible.length === 0;

  const directoryMatches = searchLoadedItems(accessible, directoryQuery, entry => [
    entry.organization.name, entry.organization.description,
    entry.organization.organizationId, entry.membership.role,
  ]);
  const directoryVisible = visibleLoadedItems(directoryMatches, directoryLimit);
  const showDirectorySearch = accessible.length > 5;

  function handleCreateDialogChange(open: boolean) {
    if (creating) return;
    setCreateOpen(open);
    if (!open) {
      setName("");
      setDescription("");
      setNameError(undefined);
      setNameEdited(false);
      setSubmitError(null);
      setCreatedOrganizationId(null);
      actionFeedbackFocusRequested.current = false;
    }
  }

  function handleSelect(
    organizationId: string,
    role: "STAFF" | "ORGANIZATION_ADMIN",
    status: OrganizationDTO["status"],
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

    router.push(
      status !== "ACTIVE" && role === "ORGANIZATION_ADMIN"
        ? applicationHref(organizationId)
        : organizationLandingHref(organizationId, role),
    );
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
      document.getElementById("organization-name")?.focus();
      return;
    }

    actionFeedbackFocusRequested.current = true;
    setCreating(true);

    try {
      const organization = await organizationService.create(
        validation.values,
      );
      setCreatedOrganizationId(organization.organizationId);
      try {
        const refreshed = await authSession.restore();
        if (
          refreshed.status !== "authenticated" ||
          !rememberActiveOrganizationId(organization.organizationId, refreshed.memberships)
        ) {
          setSubmitError("ส่งคำขอหน่วยงานแล้ว แต่ระบบยังรีเฟรชสิทธิ์ไม่สำเร็จ กรุณาโหลดหน้าใหม่เพื่อตรวจสอบสถานะ");
          return;
        }
      } catch (error) {
        if (isDefinitiveSessionFailure(error)) { authSession.logout(); return; }
        setSubmitError("ส่งคำขอหน่วยงานแล้ว แต่ยังรีเฟรชสิทธิ์ไม่สำเร็จ กรุณาเข้าสู่ระบบอีกครั้งเพื่อตรวจสอบสถานะ");
        return;
      }
      router.push(applicationHref(organization.organizationId));
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

  // Wait for the authoritative response before picking the selection or signup layout.
  if (loadState.status !== "success") {
    return (
      <div className={styles.page} data-page="organization-entry" data-loading={loadState.status}>
        <main className={styles.main}>
          <header className={styles.workspaceHeader}>
            <div className={styles.headerCopy}>
              <h1 id="organization-select-heading" tabIndex={-1} className={styles.title}>พื้นที่หน่วยงาน</h1>
              <p className={styles.description}>จัดการหน่วยงานและคำขอเปิดร้านของคุณ</p>
            </div>
          </header>
          <div className={styles.entryLoading}>
            {loadState.status === "loading" ? (
              <LoadingState title="กำลังตรวจสอบข้อมูลหน่วยงาน" description="กำลังโหลดสิทธิ์และข้อมูลล่าสุดของคุณ" />
            ) : (
              <ErrorState
                title="ไม่สามารถโหลดหน่วยงานได้"
                description="ลองดึงหน่วยงานและสิทธิ์ล่าสุดอีกครั้ง"
                actions={<Button onClick={() => {
                  retryFocusRequested.current = true;
                  setLoadState({ status: "loading" });
                  setLoadAttempt((attempt) => attempt + 1);
                }}>ลองโหลดอีกครั้ง</Button>}
              />
            )}
          </div>
        </main>
      </div>
    );
  }

  const createForm = (
            <form className={styles.form} onSubmit={handleCreate} noValidate>
              <TextField
                id="organization-name"
                label="ชื่อหน่วยงาน"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setNameEdited(true);
                  setNameError(undefined);
                  setSubmitError(null);
                }}
                error={nameError ? (
                  <span className={styles.inlineFieldError}>
                    <CircleAlert size={15} strokeWidth={2} aria-hidden="true" />
                    <span>{nameError}</span>
                  </span>
                ) : undefined}
                announceError
                onBlur={() => {
                  if (!nameEdited) return;
                  setNameError(validateOrganizationForm({ name, description }).errors.name);
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
                placeholder="แนะนำหน่วยงานของคุณ (ไม่บังคับ)"
                disabled={creating}
              />

              <div className={styles.createActions}>
                {!newApplicant ? (
                  <Button type="button" variant="secondary" disabled={creating} onClick={() => handleCreateDialogChange(false)}>
                    ยกเลิก
                  </Button>
                ) : null}
                <Button
                  type="submit"
                  size="large"
                  pending={creating}
                  pendingLabel="กำลังสร้างหน่วยงาน"
                >
                  {newApplicant ? "ส่งคำขอสมัครหน่วยงาน" : "ส่งคำขอ"}
                  {!newApplicant ? <ArrowRight size={18} strokeWidth={2.5} aria-hidden="true" /> : null}
                </Button>
              </div>
            </form>
  );

  return (
    <div className={styles.page} data-page="organization-entry" data-onboarding={newApplicant ? "true" : undefined}>
      <main className={styles.main}>
        <header className={styles.workspaceHeader} data-workspace-state={loadState.status}>
          <div className={styles.headerCopy}>
            <h1 id="organization-select-heading" tabIndex={-1} className={styles.title}>{newApplicant ? "สมัครเปิดร้านสำหรับหน่วยงาน" : "หน่วยงานของฉัน"}</h1>
            <p className={styles.description}>
              {newApplicant
                ? "สร้างพื้นที่ขายสินค้าสำหรับชมรม คณะ หรือหน่วยงานของคุณ"
                : "เลือกหน่วยงานเพื่อเข้าใช้งาน หรือติดตามสถานะคำขอ"}
            </p>
          </div>
          {!newApplicant ? (
            <Dialog
              open={createOpen}
              onOpenChange={handleCreateDialogChange}
              onOpenAutoFocus={event => {
                event.preventDefault();
                document.getElementById("organization-name")?.focus();
              }}
              contentClassName={styles.createModal}
              title="สร้างหน่วยงาน"
              description="กรอกข้อมูลหน่วยงานเพื่อส่งคำขออนุมัติ"
              trigger={
                <Button type="button" className={styles.createHeaderButton}>
                  <Plus size={18} strokeWidth={2.2} aria-hidden="true" />
                  สร้างหน่วยงาน
                </Button>
              }
            >
              <div className={styles.modalForm}>
                {submitError ? (
                  <div id="organization-action-feedback" className={styles.actionError} role="alert" tabIndex={-1}>
                    <CircleAlert size={17} strokeWidth={1.9} aria-hidden="true" />
                    <span>{submitError}</span>
                  </div>
                ) : null}
                {createdOrganizationId && submitError ? (
                  <Link href={applicationHref(createdOrganizationId)}>เปิดหน้าติดตามคำขอหน่วยงาน</Link>
                ) : null}
                {createForm}
              </div>
            </Dialog>
          ) : null}
        </header>

        {submitError && (newApplicant || !createOpen) ? (
          <div
            id="organization-action-feedback"
            className={styles.actionError}
            tabIndex={-1}
            role="alert"
          >
            <CircleAlert size={17} strokeWidth={1.9} aria-hidden="true" />
            <span>{submitError}</span>
          </div>
        ) : null}

        {createdOrganizationId && submitError && (newApplicant || !createOpen) ? (
          <div className={styles.createdApplicationLink}>
            <Link href={applicationHref(createdOrganizationId)}>เปิดหน้าติดตามคำขอหน่วยงาน</Link>
          </div>
        ) : null}

        <div className={styles.workspaceGrid}>
          {!newApplicant ? <section
            className={styles.organizationSection}
            aria-labelledby="organizations"
          >
            <div className={styles.sectionHeading}>
              <h2 className={styles.sectionTitle} id="organizations">หน่วยงาน ({accessible.length.toLocaleString("th-TH")})</h2>
            </div>

            {loadState.status === "success" && accessible.length > 0 ? (
              <>
                {showDirectorySearch ? <LoadedDirectoryControls
                  id="organization-directory-search"
                  label="ค้นหาหน่วยงานที่เข้าถึงได้"
                  query={directoryQuery}
                  onQueryChange={value => { setDirectoryQuery(value); setDirectoryLimit(24); }}
                  loadedCount={accessible.length}
                  matchingCount={directoryMatches.length}
                  visibleCount={directoryVisible.length}
                  onShowMore={() => setDirectoryLimit(value => value + 24)}
                  placeholder="ค้นหาชื่อหน่วยงาน"
                /> : null}
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
                        <Badge tone={organizationStatusTone(organization.status)}>
                          {organizationStatusLabel(organization.status)}
                        </Badge>
                      </div>

                      <p className={styles.organizationRole}>{membershipRoleLabel(membership.role)}</p>
                      {organization.status === "PENDING" ? (
                        <p className={styles.organizationDescription}>กำลังรอการตรวจสอบจากผู้ดูแลแพลตฟอร์ม</p>
                      ) : organization.status === "SUSPENDED" ? (
                        <p className={styles.organizationDescription}>หน่วยงานนี้ถูกระงับการใช้งานชั่วคราว</p>
                      ) : organization.description ? (
                        <p className={styles.organizationDescription}>{organization.description}</p>
                      ) : null}

                      <details className={styles.organizationTechnical}>
                        <summary>ดูรหัสหน่วยงาน</summary>
                        <code className={styles.organizationReference} data-technical>
                          {organization.organizationId}
                        </code>
                      </details>
                    </div>

                    <div className={styles.organizationAction}>
                      <Button
                        aria-label={organization.status !== "ACTIVE" && membership.role === "ORGANIZATION_ADMIN" ? `ดูสถานะคำขอ ${organization.name}` : `เข้าใช้งาน ${organization.name}`}
                        disabled={organization.status !== "ACTIVE" && membership.role === "STAFF"}
                        onClick={() =>
                          handleSelect(
                            organization.organizationId,
                            membership.role,
                            organization.status,
                          )
                        }
                      >
                        {organization.status !== "ACTIVE" ? membership.role === "ORGANIZATION_ADMIN" ? "ดูสถานะคำขอ" : "ยังไม่เปิดใช้งาน" : "เข้าใช้งาน"}
                      </Button>
                    </div>
                  </li>
                ))}
                </ul>
              </>
            ) : null}
          </section> : null}

          {newApplicant ? (
            <section id="create-organization-panel" className={styles.createPanel} aria-labelledby="create-organization">
              <h2 className={styles.formOnlyHeading} id="create-organization">ข้อมูลหน่วยงาน</h2>
              {createForm}
            </section>
          ) : null}
          {newApplicant ? (
            <aside className={styles.onboardingGuide} aria-labelledby="onboarding-guide-heading">
              <h2 id="onboarding-guide-heading">ขั้นตอนการเปิดร้าน</h2>
              <ol className={styles.onboardingSteps}>
                <li><span className={styles.onboardingStepNumber}>1</span><div><strong>กรอกข้อมูล</strong><p>ระบุชื่อและรายละเอียดหน่วยงานที่ต้องการเปิดร้าน</p></div></li>
                <li><span className={styles.onboardingStepNumber}>2</span><div><strong>รอการอนุมัติ</strong><p>ผู้ดูแลแพลตฟอร์มจะตรวจสอบคำขอของคุณ</p></div></li>
                <li><span className={styles.onboardingStepNumber}>3</span><div><strong>เริ่มเปิดร้าน</strong><p>หลังได้รับอนุมัติ คุณจะจัดการร้านและสินค้าได้</p></div></li>
              </ol>
              <p className={styles.guideNote}>หลังส่งคำขอ ระบบจะพาไปติดตามสถานะการอนุมัติ</p>
            </aside>
          ) : null}
        </div>
      </main>
    </div>
  );
}
