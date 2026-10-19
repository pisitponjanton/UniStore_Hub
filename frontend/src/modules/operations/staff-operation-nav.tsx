import Link from "next/link";

import styles from "./staff-operation-nav.module.css";

type OperationalQueue = "orders" | "payments" | "pickups";

export function StaffOperationNav({
  organizationId,
  current,
  isDetail = false,
}: {
  organizationId: string;
  current: OperationalQueue;
  isDetail?: boolean;
}) {
  const params = new URLSearchParams({ organizationId }).toString();
  const routes = [
    { key: "orders", text: "คำสั่งซื้อ", href: "/org/orders/?" + params },
    { key: "payments", text: "ตรวจชำระเงิน", href: "/org/payments/?" + params },
    { key: "pickups", text: "รับสินค้า", href: "/org/pickups/?" + params },
  ] as const;

  return (
    <nav className={styles.nav} aria-label="คิวงานเจ้าหน้าที่">
      <span className={styles.label}>WORKSPACE / คิวงาน</span>
      <div className={styles.links}>
        {routes.map((route) =>
          route.key === current && !isDetail ? (
            <span key={route.key} className={styles.item} data-active aria-current="page">
              {route.text}
            </span>
          ) : (
            <Link key={route.key} className={styles.item} href={route.href}>
              {route.text}
            </Link>
          ),
        )}
      </div>
    </nav>
  );
}
