"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import {
  Badge,
  Button,
  EmptyState,
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
      return "ใช้งาน";
    case "SUSPENDED":
      return "ระงับ";
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

export function OrganizationSelectView() {
  const router = useRouter();
  const auth = useAuthSession();
  const [loadState, setLoadState] = useState<LoadState>({
    status: "loading",
  });
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [nameError, setNameError] = useState<string | undefined>();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

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
  }, []);

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

  function handleSelect(
    organizationId: string,
    role: "STAFF" | "ORGANIZATION_ADMIN",
  ) {
    if (
      auth.status !== "authenticated" ||
      !rememberActiveOrganizationId(organizationId, auth.memberships)
    ) {
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
      return;
    }

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
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.header}>
          <div className={styles.headerCopy} data-ledger-heading>
            <span className={styles.eyebrow}>Organization context</span>
            <h1 className={styles.title}>เลือกหน่วยงาน</h1>
            <p className={styles.description}>
              เลือกเฉพาะหน่วยงานที่บัญชีนี้มี Active membership
              ข้อมูล organizationId ใน URL ใช้เพื่อการนำทางเท่านั้น
              Backend ยังคงตรวจสิทธิ์ทุกคำขอ
            </p>
          </div>
        </header>

        <div className={styles.grid}>
          <section className={styles.section} aria-labelledby="organizations">
            <h2 className={styles.sectionTitle} id="organizations">
              หน่วยงานที่เข้าถึงได้
            </h2>

            {loadState.status === "loading" ? (
              <LoadingState title="กำลังโหลดหน่วยงาน" />
            ) : null}

            {loadState.status === "error" ? (
              <ErrorState
                title="ไม่สามารถโหลดหน่วยงานได้"
                description="กรุณาลองโหลดหน้านี้ใหม่อีกครั้ง"
              />
            ) : null}

            {loadState.status === "success" && accessible.length === 0 ? (
              <EmptyState
                title="ยังไม่มีหน่วยงานที่เข้าถึงได้"
                description="คุณสามารถสร้างหน่วยงานใหม่ได้จากแบบฟอร์มด้านข้าง"
              />
            ) : null}

            {loadState.status === "success" && accessible.length > 0 ? (
              <div className={styles.list}>
                {accessible.map(({ organization, membership }) => (
                  <article
                    className={styles.card}
                    key={organization.organizationId}
                  >
                    <div className={styles.cardCopy}>
                      <h3 className={styles.cardTitle}>
                        {organization.name}
                      </h3>
                      <p className={styles.cardDescription}>
                        {organization.description || "ไม่มีคำอธิบาย"}
                      </p>
                      <div className={styles.metaRow}>
                        <Badge
                          tone={organizationStatusTone(organization.status)}
                        >
                          {organizationStatusLabel(organization.status)}
                        </Badge>
                        <span className={styles.meta}>
                          {membership.role === "ORGANIZATION_ADMIN"
                            ? "Organization Admin"
                            : "Staff"}
                        </span>
                      </div>
                    </div>

                    <div className={styles.cardActions}>
                      <Button
                        variant="secondary"
                        onClick={() =>
                          handleSelect(
                            organization.organizationId,
                            membership.role,
                          )
                        }
                      >
                        เลือกหน่วยงาน
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
          </section>

          <aside className={styles.panel}>
            <div>
              <h2 className={styles.sectionTitle}>สร้างหน่วยงานใหม่</h2>
              <p className={styles.description}>
                ผู้สร้างจะได้รับสิทธิ์ ORGANIZATION_ADMIN
                และหน่วยงานใหม่เริ่มต้นในสถานะ PENDING
              </p>
            </div>

            <form className={styles.form} onSubmit={handleCreate}>
              <TextField
                id="organization-name"
                label="ชื่อหน่วยงาน"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setNameError(undefined);
                }}
                error={nameError}
                required
                disabled={creating}
              />

              <TextareaField
                id="organization-description"
                label="คำอธิบาย"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                disabled={creating}
              />

              {submitError ? (
                <div className={styles.error} role="alert">
                  {submitError}
                </div>
              ) : null}

              <Button
                type="submit"
                pending={creating}
                pendingLabel="กำลังสร้าง"
              >
                สร้างหน่วยงาน
              </Button>
            </form>
          </aside>
        </div>
      </main>
    </div>
  );
}
