import Link from "next/link";

import styles from "./organization-admin-nav.module.css";

type Area = "dashboard" | "staff" | "settings";

export function OrganizationAdminNav({
  organizationId,
  current,
}: {
  organizationId: string;
  current: Area;
}) {
  const qs = new URLSearchParams({ organizationId }).toString();
  const destinations = [
    { id: "dashboard", label: "ภาพรวมงาน", href: "/org/dashboard/?" + qs },
    { id: "staff", label: "สมาชิกและสิทธิ์", href: "/org/staff/?" + qs },
    { id: "settings", label: "ข้อมูลหน่วยงาน", href: "/org/settings/?" + qs },
  ] as const;

  return (
    <nav aria-label="พื้นที่จัดการหน่วยงาน" className={styles.root}>
      <span className={styles.caption}>จัดการหน่วยงาน</span>
      <div className={styles.tabs}>
        {destinations.map((destination) =>
          destination.id === current ? (
            <span
              key={destination.id}
              className={styles.tab}
              aria-current="page"
              data-selected
            >
              {destination.label}
            </span>
          ) : (
            <Link key={destination.id} className={styles.tab} href={destination.href}>
              {destination.label}
            </Link>
          ),
        )}
        <Link className={styles.switch} href="/org/select/">
          เปลี่ยนหน่วยงาน
        </Link>
      </div>
    </nav>
  );
}
