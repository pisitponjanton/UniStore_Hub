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
            <LoadingState title="กำลังโหลดหน่วยงานทั้งหมด" />
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

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.header}>
          <div className={styles.headerCopy} data-ledger-heading>
            <span className={styles.eyebrow}>Platform admin</span>
            <h1 className={styles.title}>หน่วยงานทั้งหมด</h1>
            <p className={styles.description}>
              จัดการสถานะหน่วยงานผ่าน /platform/* เท่านั้น
              โดยอนุมัติได้เฉพาะ PENDING และระงับได้เมื่อยังไม่เป็น
              SUSPENDED ตาม Backend contract
            </p>
          </div>

          <Badge tone="neutral">
            {state.organizations.length} หน่วยงาน
          </Badge>
        </header>

        {notice ? (
          <div className={styles.notice} role="status">
            {notice}
          </div>
        ) : null}

        {inlineError ? (
          <div className={styles.errorBox} role="alert">
            {inlineError}
          </div>
        ) : null}

        {state.organizations.length === 0 ? (
          <EmptyState
            title="ยังไม่มีหน่วยงาน"
            description="Platform ยังไม่มี Organization ในระบบ"
          />
        ) : (
          <section
            className={styles.organizationList}
            aria-label="รายการหน่วยงานทั้งหมด"
          >
            {state.organizations.map((organization) => {
              const isPending =
                pending?.organizationId ===
                organization.organizationId;

              return (
                <article
                  className={styles.organizationCard}
                  key={organization.organizationId}
                >
                  <div className={styles.organizationCopy}>
                    <h2 className={styles.organizationName}>
                      {organization.name}
                    </h2>
                    <p className={styles.description}>
                      {organization.description ||
                        "ไม่มีคำอธิบายหน่วยงาน"}
                    </p>

                    <div className={styles.metaGrid}>
                      <div className={styles.metaItem}>
                        <span className={styles.metaLabel}>
                          Organization ID
                        </span>
                        <span className={styles.code}>
                          {organization.organizationId}
                        </span>
                      </div>
                      <div className={styles.metaItem}>
                        <span className={styles.metaLabel}>
                          Created by
                        </span>
                        <span className={styles.code}>
                          {organization.createdBy}
                        </span>
                      </div>
                      <div className={styles.metaItem}>
                        <span className={styles.metaLabel}>
                          อัปเดตล่าสุด
                        </span>
                        <span className={styles.metaValue}>
                          {formatIsoDateTime(
                            organization.updatedAt,
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.cardAside}>
                    <Badge
                      tone={platformOrganizationStatusTone(
                        organization.status,
                      )}
                    >
                      {platformOrganizationStatusLabel(
                        organization.status,
                      )}
                    </Badge>

                    <div className={styles.actions}>
                      {canApproveOrganization(
                        organization.status,
                      ) ? (
                        <ConfirmDialog
                          trigger={
                            <Button disabled={pending !== null}>
                              อนุมัติ
                            </Button>
                          }
                          title="ยืนยันการอนุมัติหน่วยงาน"
                          description="Backend จะเปลี่ยนสถานะ Organization จาก PENDING เป็น ACTIVE และบันทึก Audit Log"
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

                      {canSuspendOrganization(
                        organization.status,
                      ) ? (
                        <ConfirmDialog
                          trigger={
                            <Button
                              variant="danger"
                              disabled={pending !== null}
                            >
                              ระงับหน่วยงาน
                            </Button>
                          }
                          title="ยืนยันการระงับหน่วยงาน"
                          description="Backend จะเปลี่ยน Organization เป็น SUSPENDED และบันทึก Audit Log"
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
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </main>
    </div>
  );
}
