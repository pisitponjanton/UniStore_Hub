"use client";


import { AsyncPageFallback } from "@/components/ui/async-page";
import { LoadedDirectoryControls } from "@/modules/organization-directory/loaded-directory-controls";
import { searchLoadedItems, visibleLoadedItems } from "@/modules/organization-directory/loaded-directory-helpers";
import { PlatformDirectoryFilters } from "./platform-directory-filters";

import { useEffect, useState } from "react";

import {
  Badge,
  EmptyState,
  Notice,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
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
  const [directoryQuery, setDirectoryQuery] = useState("");
  const [directoryLimit, setDirectoryLimit] = useState(24);
  const [viewFilter, setViewFilter] = useState<"all" | "ACTIVE" | "DISABLED" | "admin">("all");
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
          <AsyncPageFallback
            status={state.status}
            pageTitle="ผู้ใช้ระดับ Platform"
            pageDescription="ตรวจสอบผู้ใช้และบทบาทระดับ Platform"
            loadingTitle="กำลังโหลดผู้ใช้ทั้งหมด"
            errorTitle="ไม่สามารถโหลดผู้ใช้ได้"
            backHref="/platform/summary/"
            backLabel="กลับไปพื้นที่ทำงาน"
          />
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

  const matchingUsers = searchLoadedItems(
    state.users.filter(user =>
      viewFilter === "all" || (viewFilter === "admin" ? user.platformRole === "PLATFORM_ADMIN" : user.status === viewFilter)
    ),
    directoryQuery,
    user => [user.userId, user.name, user.email, user.status, user.platformRole],
  );
  const displayedUsers = visibleLoadedItems(matchingUsers, directoryLimit);

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.header}>
          <div className={styles.headerCopy}>
            <h1 className={styles.title}>ผู้ใช้ระดับ Platform</h1>
            <p className={styles.description}>
              ตรวจสอบสถานะผู้ใช้และ Platform role ที่บันทึกอยู่ในระบบ
              โดยสามารถค้นหาและกรองจากรายชื่อที่โหลดแล้วได้ (อ่านอย่างเดียว)
            </p>
          </div>

          <div className={styles.headerAside}>
            <div
              className={styles.scopeContext}
              aria-label="ขอบเขตสิทธิ์ Platform Admin"
            >
              <Badge tone="info">Platform Admin</Badge>
              <span>รายการผู้ใช้ระดับ Platform แบบอ่านอย่างเดียว</span>
            </div>
            <div className={styles.headerCount}>
              <strong data-numeric>
                {state.users.length.toLocaleString("th-TH")}
              </strong>
              <span>ผู้ใช้ที่โหลด</span>
            </div>
          </div>
        </header>



        <Notice tone="neutral" title="รายการนี้เป็น read-only">
          API ปัจจุบันเปิดให้ Platform Admin ดูรายการผู้ใช้เท่านั้น
          หน้านี้จึงไม่มี action สำหรับแก้ไขสถานะหรือ Platform role
        </Notice>

        <section
          className={styles.priorityStrip}
          aria-label="สรุปผู้ใช้ระดับ Platform"
        >
          <article className={styles.priorityItem}>
            <span className={styles.metricLabel}>Platform Admin</span>
            <strong className={styles.priorityValue} data-numeric>
              {platformAdminCount.toLocaleString("th-TH")}
            </strong>
            <span className={styles.metricHint}>
              ผู้ใช้ที่มี platformRole = PLATFORM_ADMIN
            </span>
          </article>

          <article className={styles.priorityItem}>
            <span className={styles.metricLabel}>ใช้งานอยู่</span>
            <strong className={styles.priorityValue} data-numeric>
              {activeCount.toLocaleString("th-TH")}
            </strong>
            <span className={styles.metricHint}>
              ผู้ใช้ที่มีสถานะ ACTIVE ในรายการที่โหลด
            </span>
          </article>

          <article className={styles.priorityItem}>
            <span className={styles.metricLabel}>ปิดใช้งาน</span>
            <strong className={styles.priorityValue} data-numeric>
              {disabledCount.toLocaleString("th-TH")}
            </strong>
            <span className={styles.metricHint}>
              ผู้ใช้ที่มีสถานะ DISABLED ในรายการที่โหลด
            </span>
          </article>
        </section>

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
                ค้นหาด้วยชื่อ อีเมล หรือรหัสผู้ใช้ แล้วตรวจสถานะและสิทธิ์ที่ระบบบันทึกไว้
              </p>
            </div>
          </div>

          <PlatformDirectoryFilters
            label="กรองผู้ใช้ตามสถานะและบทบาทที่โหลดแล้ว"
            options={[
              { value: "all", label: "ทั้งหมด", count: state.users.length },
              { value: "ACTIVE", label: "ใช้งานอยู่", count: activeCount },
              { value: "DISABLED", label: "ปิดใช้งาน", count: disabledCount },
              { value: "admin", label: "Platform Admin", count: platformAdminCount },
            ]}
            value={viewFilter}
            onChange={value => { setViewFilter(value); setDirectoryLimit(24); }}
          />
          <LoadedDirectoryControls
            id="platform-users-search"
            label="ค้นหาผู้ใช้ที่โหลดแล้ว"
            query={directoryQuery}
            onQueryChange={value => { setDirectoryQuery(value); setDirectoryLimit(24); }}
            loadedCount={state.users.length}
            matchingCount={matchingUsers.length}
            visibleCount={displayedUsers.length}
            onShowMore={() => setDirectoryLimit(limit => limit + 24)}
            placeholder="ชื่อผู้ใช้ อีเมล User ID หรือ Platform role"
          />

          {state.users.length === 0 ? (
            <EmptyState
              title="ยังไม่มีผู้ใช้"
              description="Platform ยังไม่มี User ในระบบ"
            />
          ) : (
            <Table
              caption="รายการผู้ใช้ระดับ Platform"
              density="compact"
              className={styles.platformUsersTable}
            >
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
                {displayedUsers.map((user) => (
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
                      <time className={styles.timeValue} dateTime={user.createdAt}>
                        {formatIsoDateTime(user.createdAt)}
                      </time>
                    </TableCell>
                    <TableCell>
                      <time className={styles.timeValue} dateTime={user.updatedAt}>
                        {formatIsoDateTime(user.updatedAt)}
                      </time>
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
