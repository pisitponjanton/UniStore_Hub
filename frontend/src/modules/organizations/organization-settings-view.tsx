"use client";


import { PageLoadingRows, PageStateHeading } from "@/components/ui/async-page";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import {
  Badge,
  Button,
  ErrorState,
  ErrorSummary,
  ForbiddenState,
  LoadingState,
  Notice,
  TextareaField,
  TextField,
  UnauthorizedState,
  useErrorSummaryFocus,
} from "@/components";
import {
  authSession,
  isDefinitiveSessionFailure,
} from "@/modules/auth";
import { ApiClientError } from "@/services";
import type { OrganizationDTO } from "@/types";
import { formatIsoDateTime } from "@/utils";

import { validateOrganizationForm } from "./organization-helpers";
import { organizationService } from "./organization-service";
import styles from "./organization-view.module.css";

type SettingsState =
  | { status: "loading" }
  | { status: "notFound" }
  | { status: "unauthorized" }
  | { status: "forbidden" }
  | { status: "error" }
  | { status: "success"; organization: OrganizationDTO };

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

export function OrganizationSettingsView({
  organizationId,
}: {
  organizationId: string;
}) {
  const focusErrorSummary = useErrorSummaryFocus();
  const [invalidSubmitRevision, setInvalidSubmitRevision] = useState(0);
  const invalidSummaryRef = useCallback((node: HTMLDivElement | null) => {
    // Attach focus in the commit that mounts/updates the invalid summary.
    // This avoids cross-browser races between blur, React rendering and RAF.
    if (node && invalidSubmitRevision > 0) {
      node.focus({ preventScroll: false });
    }
  }, [invalidSubmitRevision]);
  const [state, setState] = useState<SettingsState>({
    status: "loading",
  });
  const [loadAttempt, setLoadAttempt] = useState(0);
  const retryFocusRequested = useRef(false);

  useEffect(() => {
    if (!retryFocusRequested.current || state.status === "loading") return;
    retryFocusRequested.current = false;
    const frame = window.requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>("[data-organization-settings-result]");
      target?.focus();
      target?.scrollIntoView({ behavior: "instant", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [state.status]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [nameError, setNameError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!invalidSubmitRevision || !nameError) return;
    // Deferred blur validation may settle after commit-time ref focus on Firefox.
    // Restore focus once, after that blur update, only for an invalid submit.
    const timeout = window.setTimeout(() => {
      document.getElementById("organization-settings-error-summary")?.focus();
    }, 100);
    return () => window.clearTimeout(timeout);
  }, [invalidSubmitRevision, nameError]);



  useEffect(() => {
    const controller = new AbortController();

    async function loadOrganization() {
      try {
        const organization = await organizationService.get(
          organizationId,
          { signal: controller.signal },
        );

        if (controller.signal.aborted) {
          return;
        }

        setState({ status: "success", organization });
        setName(organization.name);
        setDescription(organization.description);
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

        if (error instanceof ApiClientError) {
          if (error.kind === "unauthorized") {
            setState({ status: "unauthorized" });
            return;
          }

          if (error.kind === "forbidden") {
            setState({ status: "forbidden" });
            return;
          }

          if (error.kind === "notFound") {
            setState({ status: "notFound" });
            return;
          }
        }

        setState({ status: "error" });
      }
    }

    void loadOrganization();

    return () => controller.abort();
  }, [organizationId, loadAttempt]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (state.status !== "success" || saving) {
      return;
    }

    const validation = validateOrganizationForm({
      name,
      description,
    });

    setNameError(validation.errors.name);
    setSaveError(null);
    setSaved(false);

    if (!validation.valid) {
      focusErrorSummary("organization-settings-error-summary");
      // Firefox may deliver the input blur/render after the shared RAF focus.
      // A post-event focus ensures the newly mounted summary remains the
      // keyboard destination, rather than leaving focus on the submit button.
      setInvalidSubmitRevision(value => value + 1);
      return;
    }

    setSaving(true);

    try {
      const updated = await organizationService.update(
        organizationId,
        validation.values,
      );

      setState({ status: "success", organization: updated });
      setName(updated.name);
      setDescription(updated.description);
      setSaved(true);
    } catch (error) {
      if (isDefinitiveSessionFailure(error)) {
        authSession.logout();
        return;
      }

      if (error instanceof ApiClientError && error.kind === "forbidden") {
        setSaveError(
          "บัญชีนี้ไม่มีสิทธิ์แก้ไขข้อมูลหน่วยงาน หรือสิทธิ์มีการเปลี่ยนแปลงแล้ว",
        );
      } else {
        setSaveError(
          error instanceof ApiClientError
            ? error.userMessage
            : "ไม่สามารถบันทึกข้อมูลหน่วยงานได้ กรุณาลองใหม่อีกครั้ง",
        );
      }
    } finally {
      setSaving(false);
    }
  }

  if (state.status !== "success") {
    return (
      <div className={styles.page}>
        <main className={styles.stateWrap} tabIndex={-1} data-organization-settings-result>
          <PageStateHeading title="ตั้งค่าหน่วยงาน" description="ตรวจสอบและจัดการข้อมูลหน่วยงาน" />
          {state.status === "loading" ? <PageLoadingRows /> : null}
          {state.status === "loading" ? (
            <LoadingState
              title="กำลังโหลดข้อมูลหน่วยงาน"
              description="กำลังดึงข้อมูลล่าสุดก่อนเปิดการตั้งค่า"
            />
          ) : null}
          {state.status === "notFound" ? (
            <ErrorState
              title="ไม่พบหน่วยงาน"
              description="หน่วยงานนี้ไม่มีอยู่หรือไม่สามารถเข้าถึงได้"
              actions={<Link href="/org/select/">เลือกหน่วยงานอื่น</Link>}
            />
          ) : null}
          {state.status === "unauthorized" ? <UnauthorizedState /> : null}
          {state.status === "forbidden" ? <ForbiddenState /> : null}
          {state.status === "error" ? (
            <ErrorState
              title="ไม่สามารถโหลดข้อมูลหน่วยงานได้"
              description="ลองดึงข้อมูลหน่วยงานล่าสุดอีกครั้ง หรือกลับไปเลือกหน่วยงาน"
              actions={
                <>
                  <Button
                    onClick={() => {
                      retryFocusRequested.current = true;
                      setState({ status: "loading" });
                      setLoadAttempt((attempt) => attempt + 1);
                    }}
                  >
                    ลองโหลดอีกครั้ง
                  </Button>
                  <Link href="/org/select/">กลับไปเลือกหน่วยงาน</Link>
                </>
              }
            />
          ) : null}
        </main>
      </div>
    );
  }

  const { organization } = state;
  const isDirty =
    name !== organization.name ||
    description !== organization.description;

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.settingsHeader} data-organization-status={organization.status}>
          <div className={styles.headerCopy}>
            <span className={styles.managementEyebrow}>กำลังดูแล: {organization.name}</span>
            <h1 className={styles.title} tabIndex={-1} data-organization-settings-result>ตั้งค่าหน่วยงาน</h1>
            <p className={styles.description}>
              แก้ไขข้อมูลที่ผู้ใช้เห็นได้ โดยไม่กระทบสถานะอนุมัติ สิทธิ์สมาชิก หรือขอบเขตอำนาจของ Platform Admin
            </p>
          </div>

          <div className={styles.statusBlock}>
            <span className={styles.statusLabel}>สถานะปัจจุบัน</span>
            <Badge tone={organizationStatusTone(organization.status)}>
              {organizationStatusLabel(organization.status)}
            </Badge>
          </div>
        </header>

        <details className={styles.referenceDisclosure}>
          <summary>ดูรหัสหน่วยงานและประวัติการอัปเดต</summary>
          <dl className={styles.referenceStrip} aria-label="ข้อมูลอ้างอิงหน่วยงาน">
          <div>
            <dt className={styles.detailLabel}>รหัสหน่วยงาน</dt>
            <dd className={styles.detailValue} data-technical>
              {organization.organizationId}
            </dd>
          </div>
          <div>
            <dt className={styles.detailLabel}>สร้างเมื่อ</dt>
            <dd className={styles.detailValue}>
              <time dateTime={organization.createdAt}>
                {formatIsoDateTime(organization.createdAt)}
              </time>
            </dd>
          </div>
          <div>
            <dt className={styles.detailLabel}>อัปเดตล่าสุด</dt>
            <dd className={styles.detailValue}>
              <time dateTime={organization.updatedAt}>
                {formatIsoDateTime(organization.updatedAt)}
              </time>
            </dd>
          </div>
          </dl>
        </details>

        <div className={styles.settingsWorkspace}>
          <section className={styles.settingsPanel} aria-labelledby="organization-edit">
            <div className={styles.sectionHeading}>
              <div>
                <h2 className={styles.sectionTitle} id="organization-edit">
                  ข้อมูลที่แสดง
                </h2>
              </div>
              <p className={styles.sectionDescription}>
                การเปลี่ยนแปลงด้านล่างมีผลกับหน่วยงานนี้เท่านั้น และจะบันทึกเมื่อกดปุ่มยืนยัน
              </p>
            </div>

            <form className={styles.settingsForm} onSubmit={handleSubmit} noValidate>
              <ErrorSummary
                ref={invalidSummaryRef}
                id="organization-settings-error-summary"
                items={
                  nameError
                    ? [
                        {
                          fieldId: "organization-settings-name",
                          message: nameError,
                        },
                      ]
                    : []
                }
              />
              <TextField
                id="organization-settings-name"
                label="ชื่อหน่วยงาน"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setInvalidSubmitRevision(0);
                  setNameError(undefined);
                  setSaved(false);
                  setSaveError(null);
                }}
                error={nameError}
                announceError={false}
                required
                disabled={saving}
              />

              <TextareaField
                id="organization-settings-description"
                label="คำอธิบาย"
                value={description}
                onChange={(event) => {
                  setDescription(event.target.value);
                  setSaved(false);
                  setSaveError(null);
                }}
                disabled={saving}
              />

              {saved ? (
                <Notice tone="success" role="status" title="บันทึกแล้ว">
                  ข้อมูลหน่วยงานถูกอัปเดตเรียบร้อย
                </Notice>
              ) : null}

              {saveError ? (
                <Notice tone="danger" role="alert" title="บันทึกไม่สำเร็จ">
                  {saveError}
                </Notice>
              ) : null}

              {isDirty ? (
                <p className={styles.unsavedHint} role="status">
                  มีข้อมูลที่แก้ไขแต่ยังไม่ได้บันทึก การคืนค่าจะยกเลิกเฉพาะข้อมูลในฟอร์มนี้
                </p>
              ) : null}

              <div className={styles.settingsActions}>
                <Button
                  type="submit"
                  formNoValidate
                  pending={saving}
                  pendingLabel="กำลังบันทึก"
                  disabled={!isDirty}
                >
                  บันทึกการเปลี่ยนแปลง
                </Button>
                {isDirty ? (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={saving}
                    onClick={() => {
                      setName(organization.name);
                      setDescription(organization.description);
                      setNameError(undefined);
                      setSaveError(null);
                      setSaved(false);
                    }}
                  >
                    คืนค่าที่ยังไม่บันทึก
                  </Button>
                ) : null}
                {!isDirty && !saved ? (
                  <span className={styles.unsavedHint}>
                    ไม่มีการแก้ไขที่รอบันทึก
                  </span>
                ) : null}
              </div>
            </form>
          </section>

          <aside className={styles.governancePanel} aria-labelledby="organization-governance">
            <div>
              <h2 className={styles.sectionTitle} id="organization-governance">
                สิ่งที่หน้านี้เปลี่ยนไม่ได้
              </h2>
            </div>

            <ul className={styles.governanceList}>
              <li>
                <strong>สถานะหน่วยงาน</strong>
                <span>อนุมัติหรือระงับโดย Platform Admin</span>
              </li>
              <li>
                <strong>สิทธิ์สมาชิก</strong>
                <span>จัดการผ่านส่วนสมาชิกของหน่วยงานตามสิทธิ์ที่กำหนด</span>
              </li>
              <li>
                <strong>ข้อมูลธุรกรรม</strong>
                <span>ยอดคำสั่งซื้อ การชำระเงิน และการรับสินค้าไม่เปลี่ยนจากหน้านี้</span>
              </li>
            </ul>
          </aside>
        </div>
      </main>
    </div>
  );
}
