"use client";

import { useEffect, useState } from "react";

import {
  Badge,
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
            <LoadingState title="กำลังโหลดผู้ใช้ทั้งหมด" />
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

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.header}>
          <div className={styles.headerCopy} data-ledger-heading>
            <span className={styles.eyebrow}>Platform admin</span>
            <h1 className={styles.title}>ผู้ใช้ทั้งหมด</h1>
            <p className={styles.description}>
              รายการนี้อ่านจาก /platform/users โดยตรง
              และแสดง persisted User status กับ platformRole
              โดยไม่อนุมานสิทธิ์ Platform Admin จาก Organization membership
            </p>
          </div>

          <Badge tone="neutral">
            {state.users.length} ผู้ใช้
          </Badge>
        </header>

        <div className={styles.infoBox}>
          User list เป็น read-only ใน Frontend ตาม API contract ปัจจุบัน
        </div>

        {state.users.length === 0 ? (
          <EmptyState
            title="ยังไม่มีผู้ใช้"
            description="Platform ยังไม่มี User ในระบบ"
          />
        ) : (
          <section
            className={styles.userList}
            aria-label="รายการผู้ใช้ทั้งหมด"
          >
            {state.users.map((user) => (
              <article
                className={styles.userCard}
                key={user.userId}
              >
                <div className={styles.userCopy}>
                  <h2 className={styles.userName}>
                    {user.name}
                  </h2>
                  <span>{user.email}</span>

                  <div className={styles.metaGrid}>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>
                        User ID
                      </span>
                      <span className={styles.code}>
                        {user.userId}
                      </span>
                    </div>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>
                        สร้างเมื่อ
                      </span>
                      <span className={styles.metaValue}>
                        {formatIsoDateTime(user.createdAt)}
                      </span>
                    </div>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>
                        อัปเดตล่าสุด
                      </span>
                      <span className={styles.metaValue}>
                        {formatIsoDateTime(user.updatedAt)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className={styles.cardAside}>
                  <Badge tone={platformUserStatusTone(user.status)}>
                    {platformUserStatusLabel(user.status)}
                  </Badge>

                  <span className={styles.rolePill}>
                    {user.platformRole ?? "ไม่มี Platform role"}
                  </span>
                </div>
              </article>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
