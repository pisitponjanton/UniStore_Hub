"use client";

import { PlatformWorkspaceNav } from "./platform-workspace-nav";

import { AsyncPageFallback } from "@/components/ui/async-page";
import { LoadedDirectoryControls } from "@/modules/organization-directory/loaded-directory-controls";
import { searchLoadedItems, visibleLoadedItems } from "@/modules/organization-directory/loaded-directory-helpers";
import { PlatformDirectoryFilters } from "./platform-directory-filters";

import { useEffect, useRef, useState } from "react";

import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Notice,
} from "@/components";
import {
  authSession,
  isDefinitiveSessionFailure,
} from "@/modules/auth";
import { ApiClientError } from "@/services";
import type { OrganizationDTO } from "@/types";
import { formatIsoDateTime } from "@/utils";

import {
  canApproveOrganization,
  canSuspendOrganization,
  platformOrganizationStatusLabel,
  platformOrganizationStatusTone,
} from "./platform-admin-helpers";
import { platformAdminService } from "./platform-admin-service";
import styles from "./platform-admin.module.css";

type OrganizationsState =
  | { status: "loading" }
  | { status: "unauthorized" }
  | { status: "forbidden" }
  | { status: "error" }
  | { status: "success"; organizations: OrganizationDTO[] };

type PendingAction =
  | {
      organizationId: string;
      action: "approve" | "suspend";
    }
  | null;

function actionErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.code === "ORGANIZATION_NOT_FOUND") {
      return "ไม่พบหน่วยงานนี้แล้ว ระบบจะโหลดรายการล่าสุด";
    }

    if (error.code === "INVALID_STATUS_TRANSITION") {
      return "สถานะหน่วยงานเปลี่ยนไปแล้วและ action นี้ไม่สามารถทำได้ ระบบจะโหลดรายการล่าสุด";
    }

    return error.userMessage;
  }

  return "ไม่สามารถเปลี่ยนสถานะหน่วยงานได้ กรุณาลองใหม่อีกครั้ง";
}

export function PlatformOrganizationsView() {
  const [state, setState] = useState<OrganizationsState>({
    status: "loading",
  });
  const [pending, setPending] = useState<PendingAction>(null);
  const [openDialog, setOpenDialog] = useState<PendingAction>(null);
  const [directoryQuery, setDirectoryQuery] = useState("");
  const [directoryLimit, setDirectoryLimit] = useState(24);
  const [statusFilter, setStatusFilter] = useState<"all" | "PENDING" | "ACTIVE" | "SUSPENDED">("all");
  const [inlineError, setInlineError] = useState<string | null>(
    null,
  );
  const [notice, setNotice] = useState<string | null>(null);

  const feedbackRef = useRef<HTMLDivElement>(null);
  const focusFeedbackOnCloseRef = useRef<PendingAction>(null);

  useEffect(() => {
    if (openDialog || pending || (!notice && !inlineError)) return;
    // The dialog is closed before moving focus, so the user can read feedback
    // rather than remain scrolled down to the original action button.
    const frame = requestAnimationFrame(() => {
      feedbackRef.current?.focus({ preventScroll: true });
      feedbackRef.current?.scrollIntoView?.({ block: "start", behavior: "instant" });
    });
    return () => cancelAnimationFrame(frame);
  }, [openDialog, pending, notice, inlineError]);

  async function refreshOrganizations() {
    const result = await platformAdminService.listOrganizations();
    setState({
      status: "success",
      organizations: result.items,
    });
  }

  useEffect(() => {
    const controller = new AbortController();

    async function loadOrganizations() {
      try {
        const result =
          await platformAdminService.listOrganizations({
            signal: controller.signal,
          });

        if (!controller.signal.aborted) {
          setState({
            status: "success",
            organizations: result.items,
          });
        }
      } catch (error) {
        if (
          controller.signal.aborted ||
          (error instanceof DOMException &&
            error.name === "AbortError")
        ) {
          return;
        }

        if (isDefinitiveSessionFailure(error)) {
          authSession.logout();
          return;
        }

        if (error instanceof ApiClientError) {
          if (error.kind === "unauthorized") {
            setState({ status: "unauthorized" });
            return;
          }

          if (error.kind === "forbidden") {
            setState({ status: "forbidden" });
            return;
          }
        }

        setState({ status: "error" });
      }
    }

    void loadOrganizations();

    return () => controller.abort();
  }, []);

  function updateOrganization(updated: OrganizationDTO) {
    setState((current) =>
      current.status === "success"
        ? {
            status: "success",
            organizations: current.organizations.map(
              (organization) =>
                organization.organizationId ===
                updated.organizationId
                  ? updated
                  : organization,
            ),
          }
        : current,
    );
  }

  async function runAction(
    organization: OrganizationDTO,
    action: "approve" | "suspend",
  ) {
    if (pending) {
      return;
    }

    setPending({
      organizationId: organization.organizationId,
      action,
    });
    setInlineError(null);
    setNotice(null);

    try {
      const updated =
        action === "approve"
          ? await platformAdminService.approveOrganization(
              organization.organizationId,
            )
          : await platformAdminService.suspendOrganization(
              organization.organizationId,
            );

      updateOrganization(updated);
      setNotice(
        action === "approve"
          ? `อนุมัติหน่วยงาน ${updated.name} เรียบร้อยแล้ว`
          : `ระงับหน่วยงาน ${updated.name} เรียบร้อยแล้ว`,
      );
    } catch (error) {
      if (isDefinitiveSessionFailure(error)) {
        authSession.logout();
        return;
      }

      if (
        error instanceof ApiClientError &&
        error.kind === "forbidden"
      ) {
        setState({ status: "forbidden" });
        return;
      }

      setInlineError(actionErrorMessage(error));

      if (
        error instanceof ApiClientError &&
        (error.kind === "conflict" ||
          error.code === "ORGANIZATION_NOT_FOUND")
      ) {
        try {
          await refreshOrganizations();
        } catch {
          // Preserve the original transition error and last known list.
        }
      }
    } finally {
      setPending(null);
      // Defer focus until Radix has finished closing: Firefox otherwise
      // restores focus to the trigger after the feedback effect has run.
      focusFeedbackOnCloseRef.current = { organizationId: organization.organizationId, action };
      setOpenDialog(null);
    }
  }

  if (state.status !== "success") {
    return (
      <div className={styles.page}>
        <main className={styles.stateWrap}>
          <AsyncPageFallback
            status={state.status}
            pageTitle="จัดการหน่วยงาน"
            pageDescription="ตรวจสอบและจัดการสถานะหน่วยงาน"
            loadingTitle="กำลังโหลดหน่วยงานทั้งหมด"
            errorTitle="ไม่สามารถโหลดหน่วยงานได้"
            backHref="/platform/summary/"
            backLabel="กลับไปพื้นที่ทำงาน"
          />
        </main>
      </div>
    );
  }

  const pendingCount = state.organizations.filter(
    (organization) => organization.status === "PENDING",
  ).length;
  const activeCount = state.organizations.filter(
    (organization) => organization.status === "ACTIVE",
  ).length;
  const suspendedCount = state.organizations.filter(
    (organization) => organization.status === "SUSPENDED",
  ).length;
  const prioritizedOrganizations = [...state.organizations].sort(
    (left, right) =>
      Number(right.status === "PENDING") -
      Number(left.status === "PENDING"),
  );

  const matchingOrganizations = searchLoadedItems(
    prioritizedOrganizations.filter(org => statusFilter === "all" || org.status === statusFilter),
    directoryQuery,
    org => [org.name, org.description, org.organizationId, org.createdBy, org.status],
  );
  const displayedOrganizations = visibleLoadedItems(matchingOrganizations, directoryLimit);

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <PlatformWorkspaceNav current="organizations" />
        <header className={styles.header}>
          <div className={styles.headerCopy}>
            <h1 className={styles.title}>จัดการหน่วยงาน</h1>
            <p className={styles.description}>
              ตรวจสถานะของแต่ละหน่วยงานก่อนอนุมัติหรือระงับ
              โดยทุกการเปลี่ยนสถานะต้องผ่าน action ระดับ Platform
            </p>
          </div>

          <div className={styles.headerAside}>
            <div
              className={styles.scopeContext}
              aria-label="ขอบเขตสิทธิ์ Platform Admin"
            >
              <Badge tone="info">Platform Admin</Badge>
              <span>อนุมัติและระงับหน่วยงานระดับ Platform</span>
            </div>
            <div className={styles.headerCount}>
              <strong data-numeric>
                {state.organizations.length.toLocaleString("th-TH")}
              </strong>
              <span>หน่วยงานที่โหลด</span>
            </div>
          </div>
        </header>



        {notice || inlineError ? (
          <div
            id="platform-action-feedback"
            ref={feedbackRef}
            className={styles.actionFeedback}
            tabIndex={-1}
          >
            {notice ? (
              <Notice tone="success" role="status" title="อัปเดตสถานะแล้ว">
                {notice}
              </Notice>
            ) : null}
            {inlineError ? (
              <Notice tone="danger" role="alert" title="เปลี่ยนสถานะไม่สำเร็จ">
                {inlineError}
              </Notice>
            ) : null}
          </div>
        ) : null}

        <Notice tone="warning" title="ตรวจสอบก่อนเปลี่ยนสถานะ">
          อนุมัติได้เฉพาะหน่วยงานที่อยู่สถานะรออนุมัติ
          ส่วนการระงับจะเปลี่ยนสถานะหน่วยงานเป็น SUSPENDED ตามผลจากระบบ
        </Notice>

        <section
          className={styles.priorityStrip}
          aria-label="สรุปหน่วยงานที่ต้องดูแล"
        >
          <article className={styles.priorityItem} data-attention={pendingCount > 0 || undefined}>
            <span className={styles.metricLabel}>รออนุมัติ</span>
            <strong className={styles.priorityValue} data-numeric>
              {pendingCount.toLocaleString("th-TH")}
            </strong>
            <span className={styles.metricHint}>
              รายการที่ต้องตรวจและตัดสินใจจากสถานะ PENDING
            </span>
          </article>

          <article className={styles.priorityItem}>
            <span className={styles.metricLabel}>ใช้งานอยู่</span>
            <strong className={styles.priorityValue} data-numeric>
              {activeCount.toLocaleString("th-TH")}
            </strong>
            <span className={styles.metricHint}>
              หน่วยงานที่อยู่ในสถานะ ACTIVE
            </span>
          </article>

          <article className={styles.priorityItem}>
            <span className={styles.metricLabel}>ถูกระงับ</span>
            <strong className={styles.priorityValue} data-numeric>
              {suspendedCount.toLocaleString("th-TH")}
            </strong>
            <span className={styles.metricHint}>
              หน่วยงานที่อยู่ในสถานะ SUSPENDED
            </span>
          </article>
        </section>

        <section
          className={styles.section}
          aria-labelledby="platform-organizations-title"
        >
          <div className={styles.sectionHeading}>
            <div>
              <h2
                className={styles.sectionTitle}
                id="platform-organizations-title"
              >
                หน่วยงานทั้งหมด
              </h2>
              <p className={styles.sectionDescription}>
                เริ่มจากหน่วยงานรออนุมัติ แล้วตรวจชื่อ ผู้สร้าง และสถานะก่อนยืนยันการเปลี่ยนแปลง
              </p>
            </div>
          </div>

          <PlatformDirectoryFilters
            label="กรองหน่วยงานตามสถานะที่โหลดแล้ว"
            options={[
              { value: "all", label: "ทั้งหมด", count: state.organizations.length },
              { value: "PENDING", label: "รออนุมัติ", count: pendingCount },
              { value: "ACTIVE", label: "ใช้งานอยู่", count: activeCount },
              { value: "SUSPENDED", label: "ถูกระงับ", count: suspendedCount },
            ]}
            value={statusFilter}
            onChange={value => { setStatusFilter(value); setDirectoryLimit(24); }}
          />
          <LoadedDirectoryControls
            id="platform-organizations-search"
            label="ค้นหาหน่วยงานที่โหลดแล้ว"
            query={directoryQuery}
            onQueryChange={value => { setDirectoryQuery(value); setDirectoryLimit(24); }}
            loadedCount={state.organizations.length}
            matchingCount={matchingOrganizations.length}
            visibleCount={displayedOrganizations.length}
            onShowMore={() => setDirectoryLimit(limit => limit + 24)}
            placeholder="ชื่อหน่วยงาน ผู้สร้าง หรือ Organization ID"
          />

          {state.organizations.length === 0 ? (
            <EmptyState
              title="ยังไม่มีหน่วยงาน"
              description="Platform ยังไม่มี Organization ในระบบ"
            />
          ) : (
            <div
              className={styles.organizationList}
              aria-label="รายการหน่วยงานทั้งหมด"
            >
              {displayedOrganizations.map((organization) => {
                const isPending =
                  pending?.organizationId ===
                  organization.organizationId;
                const canApprove = canApproveOrganization(
                  organization.status,
                );
                const canSuspend = canSuspendOrganization(
                  organization.status,
                );

                return (
                  <article
                    className={styles.organizationRow}
                    data-attention={organization.status === "PENDING" || undefined}
                    aria-busy={isPending}
                    aria-label={`${organization.name} · ${platformOrganizationStatusLabel(organization.status)}`}
                    key={organization.organizationId}
                  >
                    <div className={styles.organizationMain}>
                      <div className={styles.organizationHeading}>
                        <div className={styles.organizationCopy}>
                          <h3 className={styles.organizationName}>
                            {organization.name}
                          </h3>
                          <p className={styles.description}>
                            {organization.description ||
                              "ไม่มีคำอธิบายหน่วยงาน"}
                          </p>
                        </div>

                        <Badge
                          tone={platformOrganizationStatusTone(
                            organization.status,
                          )}
                        >
                          {platformOrganizationStatusLabel(
                            organization.status,
                          )}
                        </Badge>
                      </div>

                      <dl className={styles.metaGrid}>
                        <div className={styles.metaItem}>
                          <dt className={styles.metaLabel}>
                            รหัสหน่วยงาน
                          </dt>
                          <dd className={styles.code}>
                            {organization.organizationId}
                          </dd>
                        </div>
                        <div className={styles.metaItem}>
                          <dt className={styles.metaLabel}>
                            รหัสผู้สร้าง
                          </dt>
                          <dd className={styles.code}>
                            {organization.createdBy}
                          </dd>
                        </div>
                        <div className={styles.metaItem}>
                          <dt className={styles.metaLabel}>
                            อัปเดตล่าสุด
                          </dt>
                          <dd className={styles.metaValue}>
                            <time dateTime={organization.updatedAt}>
                              {formatIsoDateTime(organization.updatedAt)}
                            </time>
                          </dd>
                        </div>
                      </dl>

                      {organization.status === "PENDING" ? (
                        <div className={styles.governancePriority} role="note">
                          <span className={styles.governancePriorityLabel}>
                            ต้องตัดสินใจ
                          </span>
                          <strong>ตรวจข้อมูลก่อนอนุมัติหรือระงับ</strong>
                        </div>
                      ) : null}
                    </div>

                    <div
                      className={styles.organizationActions}
                      role="group"
                      aria-label={`จัดการ ${organization.name}`}
                    >
                      <span className={styles.actionLabel}>
                        การดำเนินการที่ใช้ได้
                      </span>

                      {canApprove || canSuspend ? (
                        <div className={styles.actions}>
                          {canApprove ? (
                            <ConfirmDialog
                              open={openDialog?.organizationId === organization.organizationId && openDialog?.action === "approve"}
                              onOpenChange={(next) => {
                                if (pending) return;
                                if (next) focusFeedbackOnCloseRef.current = null;
                                setOpenDialog(next ? { organizationId: organization.organizationId, action: "approve" } : null);
                              }}
                              onCloseAutoFocus={(event) => {
                                const completed = focusFeedbackOnCloseRef.current;
                                if (completed?.organizationId !== organization.organizationId || completed.action !== "approve") {
                                  // Safari/WebKit may not restore focus after a previously
                                  // completed dialog removed its old trigger from the DOM.
                                  // Explicitly return to THIS still-mounted dialog trigger.
                                  event.preventDefault();
                                  const triggerKey = `${organization.organizationId}:approve`;
                                  requestAnimationFrame(() => {
                                    const button = [...document.querySelectorAll<HTMLButtonElement>("[data-platform-action-trigger]")]
                                      .find(node => node.dataset.platformActionTrigger === triggerKey);
                                    button?.focus({ preventScroll: true });
                                  });
                                  return;
                                }
                                focusFeedbackOnCloseRef.current = null;
                                if (!feedbackRef.current) return;
                                event.preventDefault();
                                feedbackRef.current.focus({ preventScroll: true });
                                feedbackRef.current.scrollIntoView?.({ block: "start", behavior: "instant" });
                              }}
                              trigger={
                                <Button
                                  disabled={pending !== null}
                                  data-platform-action-trigger={`${organization.organizationId}:approve`}
                                >
                                  อนุมัติ
                                </Button>
                              }
                              title={`อนุมัติ ${organization.name}?`}
                              description="ตรวจชื่อหน่วยงานและสถานะ PENDING ให้ตรงก่อนยืนยัน เมื่ออนุมัติ ระบบจะเปลี่ยนเป็น ACTIVE และบันทึกผลตามกฎเดิม"
                              confirmLabel="ยืนยันอนุมัติ"
                              pending={
                                isPending &&
                                pending?.action === "approve"
                              }
                              onConfirm={() => {
                                void runAction(
                                  organization,
                                  "approve",
                                );
                              }}
                            />
                          ) : null}

                          {canSuspend ? (
                            <ConfirmDialog
                              open={openDialog?.organizationId === organization.organizationId && openDialog?.action === "suspend"}
                              onOpenChange={(next) => {
                                if (pending) return;
                                if (next) focusFeedbackOnCloseRef.current = null;
                                setOpenDialog(next ? { organizationId: organization.organizationId, action: "suspend" } : null);
                              }}
                              onCloseAutoFocus={(event) => {
                                const completed = focusFeedbackOnCloseRef.current;
                                if (completed?.organizationId !== organization.organizationId || completed.action !== "suspend") {
                                  // Safari/WebKit may not restore focus after a previously
                                  // completed dialog removed its old trigger from the DOM.
                                  // Explicitly return to THIS still-mounted dialog trigger.
                                  event.preventDefault();
                                  const triggerKey = `${organization.organizationId}:suspend`;
                                  requestAnimationFrame(() => {
                                    const button = [...document.querySelectorAll<HTMLButtonElement>("[data-platform-action-trigger]")]
                                      .find(node => node.dataset.platformActionTrigger === triggerKey);
                                    button?.focus({ preventScroll: true });
                                  });
                                  return;
                                }
                                focusFeedbackOnCloseRef.current = null;
                                if (!feedbackRef.current) return;
                                event.preventDefault();
                                feedbackRef.current.focus({ preventScroll: true });
                                feedbackRef.current.scrollIntoView?.({ block: "start", behavior: "instant" });
                              }}
                              trigger={
                                <Button
                                  variant="danger"
                                  disabled={pending !== null}
                                  data-platform-action-trigger={`${organization.organizationId}:suspend`}
                                >
                                  ระงับหน่วยงาน
                                </Button>
                              }
                              title={`ระงับ ${organization.name}?`}
                              description="ตรวจชื่อหน่วยงานให้ถูกต้องก่อนยืนยัน เมื่อระงับ ระบบจะเปลี่ยนสถานะเป็น SUSPENDED และบันทึกผลตามกฎเดิม"
                              confirmLabel="ยืนยันระงับ"
                              pending={
                                isPending &&
                                pending?.action === "suspend"
                              }
                              danger
                              onConfirm={() => {
                                void runAction(
                                  organization,
                                  "suspend",
                                );
                              }}
                            />
                          ) : null}
                        </div>
                      ) : (
                        <span className={styles.noAction}>
                          ไม่มี action เพิ่มเติมในสถานะนี้
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>


      </main>
    </div>
  );
}
