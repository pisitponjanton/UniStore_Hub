import { AppIcon } from "@/components/ui/app-icon";
import Link from "next/link";

import styles from "./customer-journey-nav.module.css";

export type CustomerJourneyArea = "shop" | "checkout" | "orders" | "detail" | "payment" | "pickup" | "notifications";

interface CustomerJourneyNavProps {
  current: CustomerJourneyArea;
  orderId?: string;
}

export function CustomerJourneyNav({ current, orderId }: CustomerJourneyNavProps) {
  const tabs = [
    { key: "shop", title: "ค้นหาร้านค้า", href: "/shops/" },
    { key: "orders", title: "คำสั่งซื้อ", href: "/my/orders/" },
    { key: "notifications", title: "การแจ้งเตือน", href: "/notifications/" },
  ] as const;
  const isCheckout = current === "checkout";
  const isOrderFlow = current === "detail" || current === "payment" || current === "pickup";
  const relevantOrderHref = orderId
    ? "/my/order/?" + new URLSearchParams({ orderId }).toString()
    : null;

  return (
    <nav className={styles.nav} aria-label="เส้นทางผู้ซื้อ">
      <div className={styles.navIntro}>
        <span className={styles.navCaption}>UNISTORE / CUSTOMER</span>
        <strong>พื้นที่ของผู้ซื้อ</strong>
      </div>
      <div className={styles.tabList}>
        {tabs.map((tab) =>
          tab.key === current || (tab.key === "orders" && isOrderFlow) ? (
            <span
              key={tab.key}
              className={styles.tab}
              data-active={tab.key === current || (tab.key === "orders" && isOrderFlow) || undefined}
              aria-current={tab.key === current ? "page" : undefined}
            >
              {tab.title}
            </span>
          ) : (
            <Link key={tab.key} className={styles.tab} data-active={(isCheckout && tab.key === "shop") || undefined} href={tab.href}>
              {tab.title}
            </Link>
          ),
        )}
      </div>
      {relevantOrderHref && current !== "detail" ? (
        <Link className={styles.contextLink} href={relevantOrderHref}>
          กลับคำสั่งซื้อนี้ <AppIcon name="arrow-up-right" size={17} />
        </Link>
      ) : null}
    </nav>
  );
}
