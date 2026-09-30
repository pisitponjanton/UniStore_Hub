import type { HTMLAttributes, ReactNode } from "react";

import styles from "./primitives.module.css";

export interface CardProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  heading?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

export function Card({
  heading,
  description,
  actions,
  footer,
  className,
  children,
  ...props
}: CardProps) {
  const classes = [styles.card, className].filter(Boolean).join(" ");
  const hasHeader = heading || description || actions;

  return (
    <section className={classes} {...props}>
      {hasHeader ? (
        <header className={styles.cardHeader}>
          <div>
            {heading ? <h2 className={styles.cardTitle}>{heading}</h2> : null}
            {description ? (
              <p className={styles.cardDescription}>{description}</p>
            ) : null}
          </div>
          {actions}
        </header>
      ) : null}
      <div className={styles.cardBody}>{children}</div>
      {footer ? <footer className={styles.cardFooter}>{footer}</footer> : null}
    </section>
  );
}
