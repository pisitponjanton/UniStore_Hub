"use client";

import { useEffect, useState } from "react";

import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  ForbiddenState,
  LoadingState,
  Notice,
  UnauthorizedState,
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
  const [inlineError, setInlineError] = useState<string | null>(
    null,
  );
  const [notice, setNotice] = useState<string | null>(null);

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
    }
  }

  if (state.status !== "success") {
    return (
      <div className={styles.page}>
        <main className={styles.stateWrap}>
          {state.status === "loading" ? (
            <LoadingState
              title="กำลังโหลดหน่วยงานทั้งหมด"
              description="กำลังดึงสถานะล่าสุดจาก Platform"
            />
          ) : null}
          {state.status === "unauthorized" ? (
            <UnauthorizedState />
          ) : null}
          {state.status === "forbidden" ? (
            <ForbiddenState />
          ) : null}
          {state.status === "error" ? (
            <ErrorState
              title="ไม่สามารถโหลดหน่วยงานได้"
              description="กรุณาลองโหลดหน้านี้ใหม่อีกครั้ง"
            />
          ) : null}
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

  return (
    <div className={styles.page}>
      <main className={styles.main}>
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

        <Notice tone="warning" title="ตรวจสอบก่อนเปลี่ยนสถานะ">
          อนุมัติได้เฉพาะหน่วยงานที่อยู่สถานะรออนุมัติ
          ส่วนการระงับจะเปลี่ยนสถานะหน่วยงานเป็น SUSPENDED ตามผลจากระบบ
        </Notice>

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
                สถานะปัจจุบันเป็นตัวกำหนด action ที่เปิดให้ทำในแต่ละรายการ
              </p>
            </div>
          </div>

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
              {prioritizedOrganizations.map((organization) => {
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
                            Organization ID
                          </dt>
                          <dd className={styles.code}>
                            {organization.organizationId}
                          </dd>
                        </div>
                        <div className={styles.metaItem}>
                          <dt className={styles.metaLabel}>
                            Created by
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
                              trigger={
                                <Button disabled={pending !== null}>
                                  อนุมัติ
                                </Button>
                              }
                              title={`อนุมัติ ${organization.name}?`}
                              description="ระบบจะเปลี่ยนสถานะหน่วยงานจาก PENDING เป็น ACTIVE และบันทึกผลการดำเนินการ"
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
                              trigger={
                                <Button
                                  variant="danger"
                                  disabled={pending !== null}
                                >
                                  ระงับหน่วยงาน
                                </Button>
                              }
                              title={`ระงับ ${organization.name}?`}
                              description="ระบบจะเปลี่ยนสถานะหน่วยงานเป็น SUSPENDED และบันทึกผลการดำเนินการ"
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
