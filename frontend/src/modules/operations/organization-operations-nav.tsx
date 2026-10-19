import Link from "next/link";

import styles from "./organization-operations-nav.module.css";

type Area = "production" | "audit";

export function OrganizationOperationsNav({
  organizationId,
  current,
}: {
  organizationId: string;
  current: Area;
}) {
  const query = new URLSearchParams({ organizationId }).toString();
  const destinations = [
    { key: "production", name: "สรุปงานผลิต", href: "/org/production/?" + query },
    { key: "audit", name: "ประวัติรายการ", href: "/org/audit/?" + query },
    { key: "campaigns", name: "กลับไปรอบขาย", href: "/org/campaigns/?" + query },
  ] as const;
  return (
    <nav className={styles.root} aria-label="ข้อมูลการดำเนินงานหน่วยงาน">
      <span className={styles.eyebrow}>ข้อมูลการดำเนินงาน</span>
      <div className={styles.links}>
        {destinations.map((item) =>
          item.key === current ? (
            <span key={item.key} className={styles.link} data-active aria-current="page">
              {item.name}
            </span>
          ) : (
            <Link key={item.key} href={item.href} className={styles.link}>
              {item.name}
            </Link>
          ),
        )}
      </div>
    </nav>
  );
}
