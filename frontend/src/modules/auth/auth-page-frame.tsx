import Link from "next/link";
import type { ReactNode } from "react";

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

          <span className={styles.brandCopy}>
            <strong>UniStore Hub</strong>
          </span>
        </Link>

        <div className={styles.introBody}>
          <div className={styles.introCopy}>
            <span className={styles.introLabel}>UNISTORE / บัญชีของคุณ</span>
            <h1 className={styles.introTitle}>{introTitle}</h1>
            <p className={styles.introDescription}>{introDescription}</p>
          </div>

          <section className={styles.accountJourney} aria-labelledby="account-journey-heading">
            <h2 className={styles.accountJourneyTitle} id="account-journey-heading">
              ซื้อสินค้าแล้วทำอะไรต่อได้
            </h2>
            <ul className={styles.accountJourneyList}>
              <li className={styles.accountJourneyItem}>
                <span className={styles.accountJourneyNumber} aria-hidden="true">01</span>
                <strong>เลือกร้าน</strong>
                <span>ค้นหาสินค้าและรอบพรีออเดอร์</span>
              </li>
              <li className={styles.accountJourneyItem}>
                <span className={styles.accountJourneyNumber} aria-hidden="true">02</span>
                <strong>สั่งและชำระเงิน</strong>
                <span>ตรวจยอดและติดตามสถานะ</span>
              </li>
              <li className={styles.accountJourneyItem}>
                <span className={styles.accountJourneyNumber} aria-hidden="true">03</span>
                <strong>รับสินค้า</strong>
                <span>ดูจุดและข้อมูลรับสินค้าเมื่อพร้อม</span>
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
