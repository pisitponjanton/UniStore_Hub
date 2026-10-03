import Link from "next/link";
import type { ReactNode } from "react";

import styles from "./auth-form.module.css";

export function AuthPageFrame({
  introKicker = "บัญชี UniStore Hub",
  introTitle,
  introDescription,
  children,
}: {
  introKicker?: string;
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
            <span className={styles.introKicker}>{introKicker}</span>
            <h1 className={styles.introTitle}>{introTitle}</h1>
            <p className={styles.introDescription}>{introDescription}</p>
          </div>

          <div className={styles.accountJourney} aria-label="สิ่งที่ทำต่อได้ด้วยบัญชี">
            <div className={styles.accountJourneyItem}>
              <span className={styles.accountJourneyIndex}>01</span>
              <div>
                <strong>สั่งซื้อ</strong>
                <span>เลือกสินค้าและรอบขายที่เปิดรับ</span>
              </div>
            </div>
            <div className={styles.accountJourneyItem}>
              <span className={styles.accountJourneyIndex}>02</span>
              <div>
                <strong>ติดตาม</strong>
                <span>ดูสถานะคำสั่งซื้อและการชำระเงิน</span>
              </div>
            </div>
            <div className={styles.accountJourneyItem}>
              <span className={styles.accountJourneyIndex}>03</span>
              <div>
                <strong>รับสินค้า</strong>
                <span>ดูข้อมูลรับสินค้าเมื่อรายการพร้อม</span>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.introFooter}>
          <span>บัญชีเดียวสำหรับการซื้อและงานที่ได้รับสิทธิ์</span>
          <Link href="/" className={styles.introBackLink}>
            กลับหน้าร้านค้า
          </Link>
        </div>
      </section>

      <section className={styles.panel} aria-label="บัญชี UniStore Hub">
        <div className={styles.panelInner}>{children}</div>
      </section>
    </main>
  );
}
