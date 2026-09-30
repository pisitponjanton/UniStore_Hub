"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  SelectField,
  TextField,
} from "@/components";
import {
  authSession,
  isDefinitiveSessionFailure,
} from "@/modules/auth";
import { ApiClientError } from "@/services";
import type {
  MembershipRole,
  OrganizationMemberDTO,
} from "@/types";

import {
  activeAdminCount,
  isFinalActiveAdmin,
  normalizeStaffEmail,
  staffRoleLabel,
  validateStaffEmail,
} from "./staff-helpers";
import { staffService } from "./staff-service";
import styles from "./staff-view.module.css";

type StaffState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "success"; members: OrganizationMemberDTO[] };

function membershipStatusLabel(
  status: OrganizationMemberDTO["status"],
): string {
  return status === "ACTIVE" ? "ใช้งาน" : "ไม่ใช้งาน";
}

function membershipStatusTone(
  status: OrganizationMemberDTO["status"],
): "success" | "neutral" {
  return status === "ACTIVE" ? "success" : "neutral";
}

function operationErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.code === "USER_NOT_FOUND") {
      return "ไม่พบผู้ใช้ที่ใช้อีเมลนี้ ผู้ใช้ต้องสมัครบัญชีก่อนจึงจะเพิ่มเป็นบุคลากรได้";
    }

    if (error.code === "LAST_ORGANIZATION_ADMIN") {
      return "ไม่สามารถเปลี่ยนหรือลบ Organization Admin คนสุดท้ายได้";
    }

    if (error.code === "MEMBER_NOT_FOUND") {
      return "ไม่พบสมาชิกนี้แล้ว กรุณารีเฟรชรายการ";
    }

    return error.userMessage;
  }

  return "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง";
}

export function StaffView({
  organizationId,
}: {
  organizationId: string;
}) {
  const [state, setState] = useState<StaffState>({
    status: "loading",
  });
  const [email, setEmail] = useState("");
  const [addRole, setAddRole] =
    useState<MembershipRole>("STAFF");
  const [emailError, setEmailError] = useState<string | undefined>();
  const [adding, setAdding] = useState(false);
  const [operationId, setOperationId] = useState<string | null>(null);
  const [roleDrafts, setRoleDrafts] = useState<
    Record<string, MembershipRole>
  >({});
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refreshMembers = useCallback(
    async (signal?: AbortSignal) => {
      const members = await staffService.list(organizationId, { signal });
      setState({ status: "success", members });
      setRoleDrafts(
        Object.fromEntries(
          members.map((member) => [member.userId, member.role]),
        ),
      );
    },
    [organizationId],
  );

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        await refreshMembers(controller.signal);
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

        setState({ status: "error" });
      }
    }

    void load();

    return () => controller.abort();
  }, [refreshMembers]);

  const members =
    state.status === "success" ? state.members : [];

  const adminCount = activeAdminCount(members);

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (adding) {
      return;
    }

    const error = validateStaffEmail(email);
    setEmailError(error ?? undefined);
    setInlineError(null);
    setNotice(null);

    if (error) {
      return;
    }

    setAdding(true);

    try {
      const normalizedEmail = normalizeStaffEmail(email);
      await staffService.add(organizationId, {
        email: normalizedEmail,
        role: addRole,
      });
      await refreshMembers();
      setEmail("");
      setAddRole("STAFF");
      setNotice(`เพิ่ม ${normalizedEmail} เป็นบุคลากรแล้ว`);
    } catch (error) {
      if (isDefinitiveSessionFailure(error)) {
        authSession.logout();
        return;
      }

      setInlineError(operationErrorMessage(error));
    } finally {
      setAdding(false);
    }
  }

  async function handleRoleChange(member: OrganizationMemberDTO) {
    const nextRole = roleDrafts[member.userId] ?? member.role;

    if (nextRole === member.role || operationId) {
      return;
    }

    setOperationId(member.userId);
    setInlineError(null);
    setNotice(null);

    try {
      await staffService.updateRole(
        organizationId,
        member.userId,
        nextRole,
      );
      await refreshMembers();
      setNotice(
        `อัปเดตสิทธิ์ของ ${member.user.name} เป็น ${staffRoleLabel(nextRole)} แล้ว`,
      );
      await authSession.restore();
    } catch (error) {
      if (isDefinitiveSessionFailure(error)) {
        authSession.logout();
        return;
      }

      setRoleDrafts((current) => ({
        ...current,
        [member.userId]: member.role,
      }));
      setInlineError(operationErrorMessage(error));
    } finally {
      setOperationId(null);
    }
  }

  async function handleRemove(member: OrganizationMemberDTO) {
    if (operationId) {
      return;
    }

    setOperationId(member.userId);
    setInlineError(null);
    setNotice(null);

    try {
      await staffService.remove(organizationId, member.userId);
      await refreshMembers();
      setNotice(`ลบ ${member.user.name} ออกจากหน่วยงานแล้ว`);
      await authSession.restore();
    } catch (error) {
      if (isDefinitiveSessionFailure(error)) {
        authSession.logout();
        return;
      }

      setInlineError(operationErrorMessage(error));
    } finally {
      setOperationId(null);
    }
  }

  if (state.status !== "success") {
    return (
      <div className={styles.page}>
        <main className={styles.stateWrap}>
          {state.status === "loading" ? (
            <LoadingState title="กำลังโหลดรายชื่อบุคลากร" />
          ) : (
            <ErrorState
              title="ไม่สามารถโหลดรายชื่อบุคลากรได้"
              description="กรุณาลองโหลดหน้านี้ใหม่อีกครั้ง"
            />
          )}
        </main>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.header}>
          <div className={styles.headerCopy} data-ledger-heading>
            <span className={styles.eyebrow}>Staff management</span>
            <h1 className={styles.title}>บุคลากร</h1>
            <p className={styles.description}>
              เพิ่มผู้ใช้ที่มีบัญชีอยู่แล้ว เปลี่ยนบทบาท และนำสมาชิกออกจากหน่วยงาน
              โดย Backend เป็นผู้ตรวจสอบกฎ Organization Admin คนสุดท้าย
            </p>
          </div>
          <Badge tone="info">
            Admin ที่ใช้งานอยู่ {adminCount} คน
          </Badge>
        </header>

        {inlineError ? (
          <div className={styles.inlineError} role="alert">
            {inlineError}
          </div>
        ) : null}

        {notice ? (
          <div className={styles.notice} role="status">
            {notice}
          </div>
        ) : null}

        <div className={styles.grid}>
          <section className={styles.memberList} aria-labelledby="member-list">
            <h2 className={styles.sectionTitle} id="member-list">
              สมาชิกในหน่วยงาน
            </h2>

            {members.length === 0 ? (
              <EmptyState
                title="ยังไม่มีสมาชิก"
                description="เพิ่มสมาชิกด้วยอีเมลจากแบบฟอร์มด้านข้าง"
              />
            ) : (
              members.map((member) => {
                const finalAdmin = isFinalActiveAdmin(member, members);
                const draftRole =
                  roleDrafts[member.userId] ?? member.role;
                const pending = operationId === member.userId;
                const inactive = member.status !== "ACTIVE";

                return (
                  <article
                    className={styles.memberCard}
                    key={member.userId}
                  >
                    <div className={styles.memberHeader}>
                      <div className={styles.memberIdentity}>
                        <h3 className={styles.memberName}>
                          {member.user.name}
                        </h3>
                        <span className={styles.memberEmail}>
                          {member.user.email}
                        </span>
                        <span className={styles.meta}>
                          User ID: {member.userId}
                        </span>
                      </div>

                      <div className={styles.badges}>
                        <Badge
                          tone={
                            member.role === "ORGANIZATION_ADMIN"
                              ? "info"
                              : "neutral"
                          }
                        >
                          {staffRoleLabel(member.role)}
                        </Badge>
                        <Badge tone={membershipStatusTone(member.status)}>
                          {membershipStatusLabel(member.status)}
                        </Badge>
                      </div>
                    </div>

                    {finalAdmin ? (
                      <div className={styles.finalAdmin}>
                        สมาชิกคนนี้เป็น Organization Admin ที่ใช้งานอยู่คนสุดท้าย
                        จึงไม่สามารถลดสิทธิ์หรือนำออกได้
                      </div>
                    ) : null}

                    <div className={styles.memberActions}>
                      <SelectField
                        id={`role-${member.userId}`}
                        label="บทบาท"
                        value={draftRole}
                        onChange={(event) =>
                          setRoleDrafts((current) => ({
                            ...current,
                            [member.userId]:
                              event.target.value as MembershipRole,
                          }))
                        }
                        disabled={inactive || pending}
                      >
                        <option value="STAFF">Staff</option>
                        <option value="ORGANIZATION_ADMIN">
                          Organization Admin
                        </option>
                      </SelectField>

                      <ConfirmDialog
                        trigger={
                          <Button
                            variant="secondary"
                            disabled={
                              inactive ||
                              pending ||
                              draftRole === member.role ||
                              (finalAdmin && draftRole === "STAFF")
                            }
                          >
                            บันทึกบทบาท
                          </Button>
                        }
                        title="ยืนยันการเปลี่ยนบทบาท"
                        description={`เปลี่ยนบทบาทของ ${member.user.name} จาก ${staffRoleLabel(member.role)} เป็น ${staffRoleLabel(draftRole)} ใช่หรือไม่`}
                        confirmLabel="ยืนยันการเปลี่ยน"
                        pending={pending}
                        onConfirm={() => {
                          void handleRoleChange(member);
                        }}
                      />

                      <ConfirmDialog
                        trigger={
                          <Button
                            variant="danger"
                            disabled={inactive || pending || finalAdmin}
                          >
                            นำออก
                          </Button>
                        }
                        title="ยืนยันการนำสมาชิกออก"
                        description={`นำ ${member.user.name} ออกจากหน่วยงานใช่หรือไม่`}
                        confirmLabel="นำออกจากหน่วยงาน"
                        danger
                        pending={pending}
                        onConfirm={() => {
                          void handleRemove(member);
                        }}
                      />
                    </div>
                  </article>
                );
              })
            )}
          </section>

          <aside className={styles.panel}>
            <div>
              <h2 className={styles.sectionTitle}>เพิ่มสมาชิก</h2>
              <p className={styles.description}>
                เพิ่มได้เฉพาะอีเมลของผู้ใช้ที่มีบัญชี UniStore Hub อยู่แล้ว
              </p>
            </div>

            <form className={styles.form} onSubmit={handleAdd}>
              <TextField
                id="staff-email"
                type="email"
                label="อีเมลผู้ใช้"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setEmailError(undefined);
                }}
                error={emailError}
                autoComplete="email"
                required
                disabled={adding}
              />

              <SelectField
                id="staff-role"
                label="บทบาท"
                value={addRole}
                onChange={(event) =>
                  setAddRole(event.target.value as MembershipRole)
                }
                disabled={adding}
              >
                <option value="STAFF">Staff</option>
                <option value="ORGANIZATION_ADMIN">
                  Organization Admin
                </option>
              </SelectField>

              <Button
                type="submit"
                pending={adding}
                pendingLabel="กำลังเพิ่ม"
              >
                เพิ่มสมาชิก
              </Button>
            </form>
          </aside>
        </div>
      </main>
    </div>
  );
}
