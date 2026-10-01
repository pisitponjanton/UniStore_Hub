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
        <Link href="/" className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true" />
          <span>UniStore Hub</span>
        </Link>

        <div className={styles.introCopy}>
          <h1 className={styles.introTitle}>{introTitle}</h1>
          <p className={styles.introDescription}>{introDescription}</p>
        </div>

        <p className={styles.introMeta}>
          ร้านค้า พรีออเดอร์ การชำระเงิน และการรับสินค้าของหน่วยงานในมหาวิทยาลัย
        </p>
      </section>

      <section className={styles.panel} aria-label="บัญชี UniStore Hub">
        {children}
      </section>
    </main>
  );
}
