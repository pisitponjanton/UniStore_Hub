import Link from "next/link";

import styles from "./commerce-management-nav.module.css";

type CommerceArea = "stores" | "products" | "campaigns";

const destinations = [
  { id: "stores", title: "ร้านค้า", href: "/org/stores/" },
  { id: "products", title: "สินค้าและตัวเลือก", href: "/org/products/" },
  { id: "campaigns", title: "รอบการขาย", href: "/org/campaigns/" },
] as const;

export function CommerceManagementNav({
  current,
  organizationId,
}: {
  current: CommerceArea;
  organizationId: string;
}) {
  const search = new URLSearchParams({ organizationId }).toString();
  return (
    <nav className={styles.root} aria-label="จัดการการขายของหน่วยงาน">
      <div className={styles.heading}>
        <span>พื้นที่การขาย</span>
        <strong>จัดร้านค้า → เพิ่มสินค้า → เปิดรอบขาย</strong>
      </div>
      <div className={styles.links}>
        {destinations.map(destination =>
          destination.id === current ? (
            <span
              key={destination.id}
              className={styles.link}
              data-current
              aria-current="page"
            >
              {destination.title}
            </span>
          ) : (
            <Link
              key={destination.id}
              href={destination.href + "?" + search}
              className={styles.link}
            >
              {destination.title}
            </Link>
          ),
        )}
      </div>
    </nav>
  );
}
