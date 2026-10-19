import Link from "next/link";

import styles from "./platform-workspace-nav.module.css";

type PlatformArea = "summary" | "organizations" | "users";

const destinations = [
  { key: "summary", label: "ภาพรวมระบบ", href: "/platform/summary/" },
  { key: "organizations", label: "หน่วยงาน", href: "/platform/organizations/" },
  { key: "users", label: "ผู้ใช้", href: "/platform/users/" },
] as const;

export function PlatformWorkspaceNav({ current }: { current: PlatformArea }) {
  return (
    <nav aria-label="ส่วนจัดการ Platform" className={styles.root}>
      <span className={styles.caption}>PLATFORM WORKSPACE</span>
      <div className={styles.links}>
        {destinations.map(item =>
          item.key === current ? (
            <span key={item.key} className={styles.link} data-active aria-current="page">
              {item.label}
            </span>
          ) : (
            <Link key={item.key} className={styles.link} href={item.href}>
              {item.label}
            </Link>
          )
        )}
      </div>
    </nav>
  );
}
