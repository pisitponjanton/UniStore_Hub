import type { HTMLAttributes, ReactNode } from "react";

import styles from "./primitives.module.css";

type CardSurface = "default" | "muted" | "flat" | "raised" | "feature";
type CardDensity = "comfortable" | "compact";

export interface CardProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  heading?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  surface?: CardSurface;
  density?: CardDensity;
  children: ReactNode;
}

const surfaceClass: Record<CardSurface, string> = {
  default: "",
  muted: styles.cardMuted,
  flat: styles.cardFlat,
  raised: styles.cardRaised,
  feature: styles.cardFeature,
};

export function Card({
  heading,
  description,
  actions,
  footer,
  surface = "default",
  density = "comfortable",
  className,
  children,
  ...props
}: CardProps) {
  const classes = [
    styles.card,
    surfaceClass[surface],
    density === "compact" ? styles.cardCompact : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
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
          {actions ? <div className={styles.cardActions}>{actions}</div> : null}
        </header>
      ) : null}
      <div className={styles.cardBody}>{children}</div>
      {footer ? <footer className={styles.cardFooter}>{footer}</footer> : null}
    </section>
  );
}
