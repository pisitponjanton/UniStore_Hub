"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  ErrorSummary,
  LoadingState,
  Notice,
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
  return status === "ACTIVE" ? "ใช้งานอยู่" : "ไม่ใช้งาน";
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
      return "ไม่สามารถเปลี่ยนหรือลบผู้ดูแลหน่วยงานคนสุดท้ายได้";
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
  const addErrorSummaryRef = useRef<HTMLDivElement>(null);

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
  const activeMembers = members.filter(
    (member) => member.status === "ACTIVE",
  );
  const activeStaffCount = activeMembers.filter(
    (member) => member.role === "STAFF",
  ).length;
  const inactiveCount = members.length - activeMembers.length;

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
      requestAnimationFrame(() => addErrorSummaryRef.current?.focus());
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
      setNotice(`นำ ${member.user.name} ออกจากหน่วยงานแล้ว`);
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
            <LoadingState
              title="กำลังโหลดรายชื่อบุคลากร"
              description="กำลังดึงสมาชิกและบทบาทล่าสุดของหน่วยงาน"
            />
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
          <div className={styles.headerCopy}>
            <h1 className={styles.title}>บุคลากรและสิทธิ์</h1>
            <p className={styles.description}>
              เพิ่มผู้ใช้ที่มีบัญชีอยู่แล้ว กำหนดบทบาท และจัดการสมาชิกของหน่วยงาน
            </p>
          </div>
        </header>

        <section className={styles.summaryStrip} aria-label="สรุปบุคลากร">
          <div>
            <span className={styles.summaryLabel}>สมาชิกที่ใช้งาน</span>
            <strong>{activeMembers.length}</strong>
          </div>
          <div>
            <span className={styles.summaryLabel}>ผู้ดูแลหน่วยงาน</span>
            <strong>{adminCount}</strong>
          </div>
          <div>
            <span className={styles.summaryLabel}>เจ้าหน้าที่</span>
            <strong>{activeStaffCount}</strong>
          </div>
          <div>
            <span className={styles.summaryLabel}>ไม่ใช้งาน</span>
            <strong>{inactiveCount}</strong>
          </div>
        </section>

        {inlineError ? (
          <Notice tone="danger" role="alert" title="ดำเนินการไม่สำเร็จ">
            {inlineError}
          </Notice>
        ) : null}

        {notice ? (
          <Notice tone="success" role="status" title="อัปเดตแล้ว">
            {notice}
          </Notice>
        ) : null}

        <div className={styles.grid}>
          <section className={styles.memberSection} aria-labelledby="member-list">
            <div className={styles.sectionHeading}>
              <div>
                <h2 className={styles.sectionTitle} id="member-list">
                  สมาชิกในหน่วยงาน
                </h2>
                <p className={styles.sectionDescription}>
                  การเปลี่ยนบทบาทและการนำออกต้องยืนยันก่อนทุกครั้ง
                </p>
              </div>
              <span className={styles.sectionMeta}>
                {members.length.toLocaleString("th-TH")} รายการ
              </span>
            </div>

            {members.length === 0 ? (
              <EmptyState
                title="ยังไม่มีสมาชิก"
                description="เพิ่มสมาชิกด้วยอีเมลจากแบบฟอร์มด้านข้าง"
              />
            ) : (
              <div className={styles.memberList}>
                {members.map((member) => {
                  const finalAdmin = isFinalActiveAdmin(member, members);
                  const draftRole =
                    roleDrafts[member.userId] ?? member.role;
                  const pending = operationId === member.userId;
                  const inactive = member.status !== "ACTIVE";
                  const roleChanged = draftRole !== member.role;

                  return (
                    <article
                      className={[
                        styles.memberCard,
                        inactive ? styles.memberCardInactive : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
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
                          สมาชิกคนนี้เป็นผู้ดูแลหน่วยงานที่ใช้งานอยู่คนสุดท้าย จึงไม่สามารถลดสิทธิ์หรือนำออกได้
                        </div>
                      ) : null}

                      {inactive ? (
                        <div className={styles.inactiveNote}>
                          สมาชิกนี้ไม่ได้อยู่ในสถานะใช้งาน จึงไม่สามารถแก้บทบาทหรือนำออกจากหน้านี้ได้
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
                          <option value="STAFF">เจ้าหน้าที่</option>
                          <option value="ORGANIZATION_ADMIN">
                            ผู้ดูแลหน่วยงาน
                          </option>
                        </SelectField>

                        <ConfirmDialog
                          trigger={
                            <Button
                              variant="secondary"
                              disabled={
                                inactive ||
                                pending ||
                                !roleChanged ||
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
                })}
              </div>
            )}
          </section>

          <aside className={styles.panel}>
            <div className={styles.panelHeading}>
              <h2 className={styles.sectionTitle}>เพิ่มสมาชิก</h2>
              <p className={styles.sectionDescription}>
                ใช้อีเมลของผู้ใช้ที่สมัครบัญชี UniStore Hub แล้ว
              </p>
            </div>

            <form className={styles.form} onSubmit={handleAdd} noValidate>
              <ErrorSummary
                ref={addErrorSummaryRef}
                id="staff-add-error-summary"
                items={
                  emailError
                    ? [{ fieldId: "staff-email", message: emailError }]
                    : []
                }
              />
              <TextField
                id="staff-email"
                type="email"
                label="อีเมลผู้ใช้"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setEmailError(undefined);
                  setInlineError(null);
                }}
                error={emailError}
                announceError={false}
                onBlur={() => {
                  setEmailError(validateStaffEmail(email) ?? undefined);
                }}
                autoComplete="email"
                required
                disabled={adding}
              />

              <SelectField
                id="staff-role"
                label="บทบาทเริ่มต้น"
                value={addRole}
                onChange={(event) =>
                  setAddRole(event.target.value as MembershipRole)
                }
                disabled={adding}
              >
                <option value="STAFF">เจ้าหน้าที่</option>
                <option value="ORGANIZATION_ADMIN">
                  ผู้ดูแลหน่วยงาน
                </option>
              </SelectField>

              <div className={styles.roleHelp}>
                <strong>{staffRoleLabel(addRole)}</strong>
                <span>
                  {addRole === "ORGANIZATION_ADMIN"
                    ? "จัดการข้อมูลหน่วยงาน บุคลากร และงานสำหรับผู้ดูแลได้"
                    : "เข้าถึงงานปฏิบัติการตามสิทธิ์ของเจ้าหน้าที่"}
                </span>
              </div>

              <Button
                type="submit"
                size="large"
                pending={adding}
                pendingLabel="กำลังเพิ่มสมาชิก"
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
