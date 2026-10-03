"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

import {
  Badge,
  Button,
  ErrorState,
  ForbiddenState,
  LoadingState,
  Notice,
  TextareaField,
  TextField,
  UnauthorizedState,
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
  const [state, setState] = useState<SettingsState>({
    status: "loading",
  });
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [nameError, setNameError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

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
  }, [organizationId]);

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
        <main className={styles.stateWrap}>
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
              description="กรุณาลองโหลดหน้านี้ใหม่อีกครั้ง"
              actions={<Link href="/org/select/">กลับไปเลือกหน่วยงาน</Link>}
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
        <header className={styles.settingsHeader}>
          <div className={styles.headerCopy}>
            <span className={styles.pageKicker}>ข้อมูลพื้นฐานของหน่วยงาน</span>
            <h1 className={styles.title}>ตั้งค่าหน่วยงาน</h1>
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

        <section className={styles.referenceStrip} aria-label="ข้อมูลอ้างอิงหน่วยงาน">
          <div>
            <span className={styles.detailLabel}>รหัสหน่วยงาน</span>
            <strong className={styles.detailValue} data-technical>
              {organization.organizationId}
            </strong>
          </div>
          <div>
            <span className={styles.detailLabel}>สร้างเมื่อ</span>
            <strong className={styles.detailValue}>
              {formatIsoDateTime(organization.createdAt)}
            </strong>
          </div>
          <div>
            <span className={styles.detailLabel}>อัปเดตล่าสุด</span>
            <strong className={styles.detailValue}>
              {formatIsoDateTime(organization.updatedAt)}
            </strong>
          </div>
        </section>

        <div className={styles.settingsWorkspace}>
          <section className={styles.settingsPanel} aria-labelledby="organization-edit">
            <div className={styles.sectionHeading}>
              <div>
                <span className={styles.sectionKicker}>ข้อมูลที่แก้ไขได้</span>
                <h2 className={styles.sectionTitle} id="organization-edit">
                  ข้อมูลที่แสดง
                </h2>
              </div>
              <p className={styles.sectionDescription}>
                การเปลี่ยนแปลงด้านล่างมีผลกับหน่วยงานนี้เท่านั้น และจะบันทึกเมื่อกดปุ่มยืนยัน
              </p>
            </div>

            <form className={styles.settingsForm} onSubmit={handleSubmit}>
              <TextField
                id="organization-settings-name"
                label="ชื่อหน่วยงาน"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setNameError(undefined);
                  setSaved(false);
                  setSaveError(null);
                }}
                error={nameError}
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

              <div className={styles.settingsActions}>
                <Button
                  type="submit"
                  pending={saving}
                  pendingLabel="กำลังบันทึก"
                  disabled={!isDirty}
                >
                  บันทึกการเปลี่ยนแปลง
                </Button>
                <Link href="/org/select/" className={styles.secondaryLink}>
                  เปลี่ยนหน่วยงาน
                </Link>
                {!isDirty && !saved ? (
                  <span className={styles.unsavedHint}>
                    ยังไม่มีข้อมูลที่เปลี่ยนแปลง
                  </span>
                ) : null}
              </div>
            </form>
          </section>

          <aside className={styles.governancePanel} aria-labelledby="organization-governance">
            <div>
              <span className={styles.sectionKicker}>ขอบเขตสิทธิ์</span>
              <h2 className={styles.sectionTitle} id="organization-governance">
                สิ่งที่หน้านี้เปลี่ยนไม่ได้
              </h2>
            </div>

            <div className={styles.governanceList}>
              <div>
                <strong>สถานะหน่วยงาน</strong>
                <span>อนุมัติหรือระงับโดย Platform Admin</span>
              </div>
              <div>
                <strong>สิทธิ์สมาชิก</strong>
                <span>จัดการผ่านส่วนสมาชิกของหน่วยงานตามสิทธิ์ที่กำหนด</span>
              </div>
              <div>
                <strong>ข้อมูลธุรกรรม</strong>
                <span>ยอดคำสั่งซื้อ การชำระเงิน และการรับสินค้าไม่เปลี่ยนจากหน้านี้</span>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
