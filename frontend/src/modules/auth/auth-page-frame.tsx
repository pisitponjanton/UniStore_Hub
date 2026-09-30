import Link from "next/link";
import type { ReactNode } from "react";

import styles from "./auth-form.module.css";

export function AuthPageFrame({
  eyebrow,
  introTitle,
  introDescription,
  children,
}: {
  eyebrow: string;
  introTitle: string;
  introDescription: string;
  children: ReactNode;
}) {
  return (
    <main className={styles.page}>
      <section className={styles.intro} aria-label="UniStore Hub">
        <Link href="/" className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true" />
          <span>UniStore Hub</span>
        </Link>

        <div className={styles.introCopy}>
          <span className={styles.eyebrow}>{eyebrow}</span>
          <h1 className={styles.introTitle}>{introTitle}</h1>
          <p className={styles.introDescription}>{introDescription}</p>
        </div>

        <p className={styles.introMeta}>
          ระบบร้านค้า พรีออเดอร์ การชำระเงิน และการรับสินค้าสำหรับหน่วยงานในมหาวิทยาลัย
        </p>
      </section>

      <section className={styles.panel}>{children}</section>
    </main>
  );
}
