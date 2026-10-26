"use client";


import { AsyncPageFallback } from "@/components/ui/async-page";
import { searchLoadedItems, visibleLoadedItems } from "@/modules/organization-directory/loaded-directory-helpers";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { MoreHorizontal, Plus, Search, ShieldCheck } from "lucide-react";
import { ManagementModal } from "@/components/ui/management-modal";

import {
  Badge,
  Button,
  ConfirmDialog,
  Dialog,
  EmptyState,
  ErrorSummary,
  Notice,
  SelectField,
  TextField,
  useErrorSummaryFocus,
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

const STAFF_SUCCESS_NOTICE_KEY =
  "unistoreHub.staffSuccessNotice";

function rememberStaffSuccessNotice(message: string) {
  window.sessionStorage.setItem(
    STAFF_SUCCESS_NOTICE_KEY,
    message,
  );
}

function clearStaffSuccessNotice() {
  window.sessionStorage.removeItem(
    STAFF_SUCCESS_NOTICE_KEY,
  );
}

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
  const focusErrorSummary = useErrorSummaryFocus();
  const [directoryQuery, setDirectoryQuery] = useState("");
  const [directoryLimit, setDirectoryLimit] = useState(24);
  const [roleFilter, setRoleFilter] = useState<MembershipRole | "ALL">("ALL");
  const [addOpen, setAddOpen] = useState(false);
  const [manageMemberId, setManageMemberId] = useState<string | null>(null);
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

  const operationFeedbackRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!inlineError) return;
    // Mutating actions are below the member list; after failure bring the
    // newly rendered error back into the keyboard and mobile viewport.
    const frame = window.requestAnimationFrame(() => {
      operationFeedbackRef.current?.focus({ preventScroll: true });
      operationFeedbackRef.current?.scrollIntoView?.({ block: "start", behavior: "instant" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [inlineError]);

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
    const persistedNotice = window.sessionStorage.getItem(
      STAFF_SUCCESS_NOTICE_KEY,
    );

    if (!persistedNotice) {
      return;
    }

    const timeout = window.setTimeout(() => {
      clearStaffSuccessNotice();
      setNotice(persistedNotice);
    }, 0);

    return () => {
      window.clearTimeout(timeout);
    };
  }, []);

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

  const directoryMatches = searchLoadedItems(
    members.filter(member => roleFilter === "ALL" || member.role === roleFilter),
    directoryQuery, member => [member.user.name, member.user.email, member.userId, member.role, member.status],
  );
  const directoryVisible = visibleLoadedItems(directoryMatches, directoryLimit);

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
      focusErrorSummary("staff-add-error-summary");
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
      setEmailError(undefined);
      setAddOpen(false);
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

      const successMessage =
        `อัปเดตสิทธิ์ของ ${member.user.name} เป็น ${staffRoleLabel(nextRole)} แล้ว`;
      rememberStaffSuccessNotice(successMessage);
      await authSession.restore();
      setManageMemberId(null);
      setNotice(successMessage);
      window.setTimeout(() => {
        clearStaffSuccessNotice();
      }, 2000);
    } catch (error) {
      clearStaffSuccessNotice();

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

      const successMessage =
        `นำ ${member.user.name} ออกจากหน่วยงานแล้ว`;
      rememberStaffSuccessNotice(successMessage);
      await authSession.restore();
      setManageMemberId(null);
      setNotice(successMessage);
      window.setTimeout(() => {
        clearStaffSuccessNotice();
      }, 2000);
    } catch (error) {
      clearStaffSuccessNotice();
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
          <AsyncPageFallback
            status={state.status}
            pageTitle="บุคลากรและสิทธิ์"
            pageDescription="จัดการผู้ร่วมงานและบทบาทในหน่วยงาน"
            loadingTitle="กำลังโหลดรายชื่อบุคลากร"
            errorTitle="ไม่สามารถโหลดรายชื่อบุคลากรได้"
            backHref="/org/select/"
            backLabel="กลับไปพื้นที่ทำงาน"
          />
        </main>
      </div>
    );
  }

  const managedMember = members.find(member => member.userId === manageMemberId) ?? null;
  const managedRole = managedMember ? roleDrafts[managedMember.userId] ?? managedMember.role : "STAFF";
  const managedFinalAdmin = managedMember ? isFinalActiveAdmin(managedMember, members) : false;
  const managing = Boolean(managedMember && operationId === managedMember.userId);

  function closeManage() {
    if (operationId || !managedMember) return;
    setRoleDrafts(current => ({ ...current, [managedMember.userId]: managedMember.role }));
    setManageMemberId(null);
    setInlineError(null);
  }

  function closeAdd() {
    if (adding) return;
    setAddOpen(false);
    setEmail("");
    setEmailError(undefined);
    setAddRole("STAFF");
    setInlineError(null);
  }

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.header}>
          <div className={styles.headerCopy}>
            <h1 className={styles.title}>บุคลากรและสิทธิ์</h1>
            <p className={styles.description}>จัดการสมาชิกและสิทธิ์ภายในหน่วยงาน</p>
          </div>
          <Button className={styles.addMemberButton}
            leading={<Plus size={17} aria-hidden="true" />}
            disabled={Boolean(operationId) || adding}
            onClick={() => { setInlineError(null); setAddOpen(true); }}>
            เพิ่มสมาชิก
          </Button>
        </header>
        <div className={styles.summaryStrip} aria-label="สรุปบุคลากร">
          <span>สมาชิกที่ใช้งาน <strong>{activeMembers.length}</strong></span>
          <span>ผู้ดูแล <strong>{adminCount}</strong></span>
          <span>เจ้าหน้าที่ <strong>{activeStaffCount}</strong></span>
          <span>ไม่ใช้งาน <strong>{inactiveCount}</strong></span>
        </div>
        {inlineError && !addOpen && !managedMember ? (
          <div data-staff-operation-error ref={operationFeedbackRef} tabIndex={-1}
            className={styles.operationFeedback}>
            <Notice tone="danger" role="alert" title="ดำเนินการไม่สำเร็จ">{inlineError}</Notice>
          </div>
        ) : null}
        {notice ? <Notice tone="success" role="status" title="อัปเดตแล้ว">{notice}</Notice> : null}
        <section className={styles.memberSection} aria-label="สมาชิกในหน่วยงาน">
          <div className={styles.toolbar}>
            <label className={styles.searchBox}>
              <Search size={17} aria-hidden="true" />
              <input id="staff-directory-search" type="search"
                aria-label="ค้นหาสมาชิก" placeholder="ค้นหาชื่อหรืออีเมล..."
                value={directoryQuery}
                onChange={e => { setDirectoryQuery(e.target.value); setDirectoryLimit(24); }} />
            </label>
            <label className={styles.filterBox}>
              <span className={styles.visuallyHidden}>กรองตามบทบาท</span>
              <select value={roleFilter} aria-label="กรองตามบทบาท"
                onChange={e => {
                  setRoleFilter(e.target.value as MembershipRole | "ALL");
                  setDirectoryLimit(24);
                }}>
                <option value="ALL">ทุกบทบาท</option>
                <option value="ORGANIZATION_ADMIN">ผู้ดูแลหน่วยงาน</option>
                <option value="STAFF">เจ้าหน้าที่</option>
              </select>
            </label>
          </div>
          {directoryQuery || roleFilter !== "ALL" ? (
            <p className={styles.matchCount} role="status">
              แสดง {directoryVisible.length} จาก {directoryMatches.length} รายการที่ตรงเงื่อนไขในข้อมูลที่โหลดแล้ว
            </p>
          ) : null}
          {members.length === 0 ? (
            <EmptyState title="ยังไม่มีสมาชิก" description="กดเพิ่มสมาชิกเพื่อเพิ่มผู้ที่สมัครบัญชีแล้ว" />
          ) : directoryMatches.length === 0 ? (
            <EmptyState title="ไม่พบสมาชิก" description="ลองเปลี่ยนคำค้นหาหรือตัวกรองบทบาท" />
          ) : (
            <div className={styles.memberList}>
              {directoryVisible.map(member => (
                <article key={member.userId}
                  className={[styles.memberRow, member.status !== "ACTIVE" ? styles.memberInactive : ""].join(" ")}>
                  <div className={styles.memberAvatar} aria-hidden="true">
                    {member.user.name?.trim().charAt(0).toUpperCase() || "?"}
                  </div>
                  <div className={styles.memberIdentity}>
                    <h2 className={styles.memberName}>{member.user.name}</h2>
                    <span className={styles.memberEmail}>{member.user.email}</span>
                  </div>
                  <div className={styles.badges}>
                    <Badge tone={member.role === "ORGANIZATION_ADMIN" ? "info" : "neutral"}>
                      {staffRoleLabel(member.role)}
                    </Badge>
                    <Badge tone={membershipStatusTone(member.status)}>{membershipStatusLabel(member.status)}</Badge>
                  </div>
                  <button type="button" className={styles.moreButton}
                    aria-label={`จัดการสมาชิก ${member.user.name}`}
                    disabled={Boolean(operationId)}
                    onClick={() => { setInlineError(null); setManageMemberId(member.userId); }}>
                    <MoreHorizontal size={21} aria-hidden="true" />
                  </button>
                </article>
              ))}
            </div>
          )}
          {directoryMatches.length > directoryVisible.length ? (
            <button type="button" className={styles.loadMore}
              onClick={() => setDirectoryLimit(v => v + 24)}>
              แสดงเพิ่มเติม ({directoryMatches.length - directoryVisible.length} รายการ)
            </button>
          ) : null}
        </section>
      </main>

      {addOpen ? <ManagementModal title="เพิ่มสมาชิก"
        description="เพิ่มเฉพาะผู้ที่สมัครบัญชีไว้แล้ว"
        size="small" formId="staff-add-form" submitLabel="เพิ่มสมาชิก"
        submitting={adding} dirty={Boolean(email || addRole !== "STAFF")}
        onClose={closeAdd}>
        <form id="staff-add-form" className={styles.form} onSubmit={handleAdd} noValidate>
          {inlineError ? <div data-staff-operation-error ref={operationFeedbackRef}
            tabIndex={-1} className={styles.operationFeedback}>
            <Notice tone="danger" role="alert" title="ดำเนินการไม่สำเร็จ">{inlineError}</Notice>
          </div> : null}
          <ErrorSummary id="staff-add-error-summary"
            items={emailError ? [{ fieldId: "staff-email", message: emailError }] : []} />
          <TextField id="staff-email" type="email" label="อีเมลผู้ใช้"
            autoComplete="email" required disabled={adding} value={email}
            onChange={e => { setEmail(e.target.value); setEmailError(undefined); setInlineError(null); }}
            error={emailError} announceError={false}
            onBlur={() => window.setTimeout(() => setEmailError(validateStaffEmail(email) ?? undefined), 0)} />
          <SelectField id="staff-role" label="บทบาทเริ่มต้น" disabled={adding}
            value={addRole} onChange={e => setAddRole(e.target.value as MembershipRole)}>
            <option value="STAFF">เจ้าหน้าที่</option>
            <option value="ORGANIZATION_ADMIN">ผู้ดูแลหน่วยงาน</option>
          </SelectField>
          <p className={styles.helper}>
            {addRole === "ORGANIZATION_ADMIN"
              ? "จัดการข้อมูลหน่วยงาน บุคลากร และงานสำหรับผู้ดูแลได้"
              : "เข้าถึงงานปฏิบัติการตามสิทธิ์ของเจ้าหน้าที่"}
          </p>
        </form>
      </ManagementModal> : null}

      <Dialog title="จัดการสมาชิก" description={managedMember?.user.email ?? ""}
        open={Boolean(managedMember)} onOpenChange={open => { if (!open) closeManage(); }}>
        {managedMember ? <div className={styles.manageBody}>
          <div className={styles.manageIdentity}>
            <div className={styles.memberAvatar} aria-hidden="true">
              {managedMember.user.name?.trim().charAt(0).toUpperCase() || "?"}
            </div>
            <div><strong>{managedMember.user.name}</strong><p>{managedMember.user.email}</p></div>
          </div>
          {inlineError ? <Notice role="alert" tone="danger" title="ดำเนินการไม่สำเร็จ">{inlineError}</Notice> : null}
          <SelectField id="staff-manage-role" label="บทบาท"
            value={managedRole}
            disabled={managing || managedMember.status !== "ACTIVE"}
            onChange={e => setRoleDrafts(current => ({
              ...current, [managedMember.userId]: e.target.value as MembershipRole,
            }))}>
            <option value="STAFF">เจ้าหน้าที่</option>
            <option value="ORGANIZATION_ADMIN">ผู้ดูแลหน่วยงาน</option>
          </SelectField>
          {managedFinalAdmin ? <p className={styles.guardNote}>
            <ShieldCheck size={17} aria-hidden="true" />
            สมาชิกคนนี้เป็นผู้ดูแลหน่วยงานที่ใช้งานอยู่คนสุดท้าย จึงไม่สามารถลดสิทธิ์หรือนำออกได้
          </p> : managedMember.status !== "ACTIVE" ? <p className={styles.guardNote}>
            สมาชิกนี้ไม่ได้อยู่ในสถานะใช้งาน จึงไม่สามารถแก้บทบาทหรือนำออกได้
          </p> : null}
          <div className={styles.manageActions}>
            <ConfirmDialog
              trigger={<Button variant="danger" disabled={managing ||
                managedMember.status !== "ACTIVE" || managedFinalAdmin}>นำออกจากหน่วยงาน</Button>}
              title="ยืนยันการนำสมาชิกออก"
              description={`นำ ${managedMember.user.name} ออกจากหน่วยงานใช่หรือไม่`}
              danger confirmLabel="นำออกจากหน่วยงาน" pending={managing}
              onConfirm={() => { void handleRemove(managedMember); }} />
            <ConfirmDialog
              trigger={<Button disabled={managing || managedMember.status !== "ACTIVE" ||
                managedRole === managedMember.role || (managedFinalAdmin && managedRole === "STAFF")}>
                บันทึกบทบาท
              </Button>}
              title="ยืนยันการเปลี่ยนบทบาท"
              description={`เปลี่ยนบทบาทของ ${managedMember.user.name} จาก ${staffRoleLabel(managedMember.role)} เป็น ${staffRoleLabel(managedRole)} ใช่หรือไม่`}
              confirmLabel="ยืนยันการเปลี่ยน" pending={managing}
              onConfirm={() => { void handleRoleChange(managedMember); }} />
          </div>
        </div> : null}
      </Dialog>
    </div>
  );
}
