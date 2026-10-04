import Link from "next/link";
import type { ReactNode } from "react";

import { BrandIllustration } from "@/components";

import styles from "./auth-form.module.css";

export function AuthPageFrame({
  introTitle,
  introDescription,
  children,
}: {
  introTitle: string;
  introDescription: string;
  children: ReactNode;
}) {
  return (
    <main className={styles.page}>
      <section className={styles.intro} aria-label="UniStore Hub">
        <Link href="/" className={styles.brand} aria-label="UniStore Hub หน้าร้าน">
          <span className={styles.brandMark} aria-hidden="true">
            <span />
          </span>
          <span className={styles.brandCopy}>
            <strong>UniStore Hub</strong>
            <span>Campus marketplace</span>
          </span>
        </Link>

        <div className={styles.introBody}>
          <div className={styles.introCopy}>
            <span className={styles.introLabel}>บัญชีสำหรับ campus commerce</span>
            <h1 className={styles.introTitle}>{introTitle}</h1>
            <p className={styles.introDescription}>{introDescription}</p>
          </div>

          <div className={styles.authVisual} aria-hidden="true">
            <BrandIllustration
              variant="parcel"
              className={styles.authVisualIllustration}
              decorative
            />
          </div>

          <section className={styles.accountJourney} aria-labelledby="account-journey-heading">
            <h2 className={styles.accountJourneyTitle} id="account-journey-heading">
              บัญชีนี้ใช้ทำอะไรได้
            </h2>
            <ul className={styles.accountJourneyList}>
              <li className={styles.accountJourneyItem}>
                <strong>สั่งซื้อ</strong>
                <span>เลือกสินค้าและรอบขายที่เปิดรับ</span>
              </li>
              <li className={styles.accountJourneyItem}>
                <strong>ติดตาม</strong>
                <span>ดูสถานะคำสั่งซื้อและการชำระเงิน</span>
              </li>
              <li className={styles.accountJourneyItem}>
                <strong>รับสินค้า</strong>
                <span>ดูข้อมูลรับสินค้าเมื่อรายการพร้อม</span>
              </li>
            </ul>
          </section>
        </div>

      </section>

      <section className={styles.panel} aria-label="บัญชี UniStore Hub">
        <div className={styles.panelInner}>
          <span className={styles.panelLabel}>บัญชี UniStore Hub</span>
          {children}
        </div>
      </section>
    </main>
  );
}
