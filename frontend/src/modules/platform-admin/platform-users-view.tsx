"use client";

import { useEffect, useState } from "react";

import {
  Badge,
  EmptyState,
  ErrorState,
  ForbiddenState,
  LoadingState,
  Notice,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  UnauthorizedState,
} from "@/components";
import {
  authSession,
  isDefinitiveSessionFailure,
} from "@/modules/auth";
import { ApiClientError } from "@/services";
import type { UserDTO } from "@/types";
import { formatIsoDateTime } from "@/utils";

import {
  platformUserStatusLabel,
  platformUserStatusTone,
} from "./platform-admin-helpers";
import { platformAdminService } from "./platform-admin-service";
import styles from "./platform-admin.module.css";

type UsersState =
  | { status: "loading" }
  | { status: "unauthorized" }
  | { status: "forbidden" }
  | { status: "error" }
  | { status: "success"; users: UserDTO[] };

export function PlatformUsersView() {
  const [state, setState] = useState<UsersState>({
    status: "loading",
  });

  useEffect(() => {
    const controller = new AbortController();

    async function loadUsers() {
      try {
        const result = await platformAdminService.listUsers({
          signal: controller.signal,
        });

        if (!controller.signal.aborted) {
          setState({
            status: "success",
            users: result.items,
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

    void loadUsers();

    return () => controller.abort();
  }, []);

  if (state.status !== "success") {
    return (
      <div className={styles.page}>
        <main className={styles.stateWrap}>
          {state.status === "loading" ? (
            <LoadingState
              title="กำลังโหลดผู้ใช้ทั้งหมด"
              description="กำลังดึงสถานะและ Platform role ล่าสุด"
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
              title="ไม่สามารถโหลดผู้ใช้ได้"
              description="กรุณาลองโหลดหน้านี้ใหม่อีกครั้ง"
            />
          ) : null}
        </main>
      </div>
    );
  }

  const platformAdminCount = state.users.filter(
    (user) => user.platformRole === "PLATFORM_ADMIN",
  ).length;
  const activeCount = state.users.filter(
    (user) => user.status === "ACTIVE",
  ).length;
  const disabledCount = state.users.filter(
    (user) => user.status === "DISABLED",
  ).length;

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.header}>
          <div className={styles.headerCopy} data-ledger-heading>
            <span className={styles.pageKicker}>ทะเบียนผู้ใช้ระดับ Platform</span>
            <h1 className={styles.title}>ผู้ใช้ระดับ Platform</h1>
            <p className={styles.description}>
              ตรวจสอบสถานะผู้ใช้และ Platform role ที่บันทึกอยู่ในระบบ
              โดยรายการนี้เป็นข้อมูลอ่านอย่างเดียวตาม contract ปัจจุบัน
            </p>
          </div>

          <div className={styles.headerCount}>
            <strong>{state.users.length.toLocaleString("th-TH")}</strong>
            <span>ผู้ใช้ที่โหลด</span>
          </div>
        </header>

        <section
          className={styles.priorityStrip}
          aria-label="สรุปผู้ใช้ระดับ Platform"
        >
          <article className={styles.priorityItem}>
            <span className={styles.metricLabel}>Platform Admin</span>
            <strong className={styles.priorityValue}>
              {platformAdminCount.toLocaleString("th-TH")}
            </strong>
            <span className={styles.metricHint}>
              ผู้ใช้ที่มี platformRole = PLATFORM_ADMIN
            </span>
          </article>

          <article className={styles.priorityItem}>
            <span className={styles.metricLabel}>ใช้งานอยู่</span>
            <strong className={styles.priorityValue}>
              {activeCount.toLocaleString("th-TH")}
            </strong>
            <span className={styles.metricHint}>
              ผู้ใช้ที่มีสถานะ ACTIVE ในรายการที่โหลด
            </span>
          </article>

          <article className={styles.priorityItem}>
            <span className={styles.metricLabel}>ปิดใช้งาน</span>
            <strong className={styles.priorityValue}>
              {disabledCount.toLocaleString("th-TH")}
            </strong>
            <span className={styles.metricHint}>
              ผู้ใช้ที่มีสถานะ DISABLED ในรายการที่โหลด
            </span>
          </article>
        </section>

        <Notice tone="neutral" title="รายการนี้เป็น read-only">
          API ปัจจุบันเปิดให้ Platform Admin ดูรายการผู้ใช้เท่านั้น
          หน้านี้จึงไม่มี action สำหรับแก้ไขสถานะหรือ Platform role
        </Notice>

        <section
          className={styles.section}
          aria-labelledby="platform-users-title"
        >
          <div className={styles.sectionHeading}>
            <div>
              <h2
                className={styles.sectionTitle}
                id="platform-users-title"
              >
                ผู้ใช้ทั้งหมด
              </h2>
              <p className={styles.sectionDescription}>
                สถานะและ Platform role แสดงจาก UserDTO ที่ระบบส่งกลับ
              </p>
            </div>
          </div>

          {state.users.length === 0 ? (
            <EmptyState
              title="ยังไม่มีผู้ใช้"
              description="Platform ยังไม่มี User ในระบบ"
            />
          ) : (
            <Table caption="รายการผู้ใช้ระดับ Platform">
              <TableHead>
                <TableRow>
                  <TableHeaderCell>ผู้ใช้</TableHeaderCell>
                  <TableHeaderCell>สถานะ</TableHeaderCell>
                  <TableHeaderCell>Platform role</TableHeaderCell>
                  <TableHeaderCell>สร้างเมื่อ</TableHeaderCell>
                  <TableHeaderCell>อัปเดตล่าสุด</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {state.users.map((user) => (
                  <TableRow key={user.userId}>
                    <TableCell>
                      <div className={styles.userIdentity}>
                        <strong>{user.name}</strong>
                        <span>{user.email}</span>
                        <span className={styles.code}>
                          {user.userId}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        tone={platformUserStatusTone(user.status)}
                      >
                        {platformUserStatusLabel(user.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.platformRole === "PLATFORM_ADMIN" ? (
                        <Badge tone="info">Platform Admin</Badge>
                      ) : (
                        <span className={styles.noRole}>
                          ไม่มี Platform role
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={styles.timeValue}>
                        {formatIsoDateTime(user.createdAt)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={styles.timeValue}>
                        {formatIsoDateTime(user.updatedAt)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      </main>
    </div>
  );
}
