import type { HTMLAttributes, ReactNode } from "react";

import styles from "./primitives.module.css";

type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  showDot?: boolean;
  children: ReactNode;
}

const toneClass: Record<BadgeTone, string> = {
  neutral: styles.badgeNeutral,
  info: styles.badgeInfo,
  success: styles.badgeSuccess,
  warning: styles.badgeWarning,
  danger: styles.badgeDanger,
};

export function Badge({
  tone = "neutral",
  showDot = true,
  className,
  children,
  ...props
}: BadgeProps) {
  const classes = [styles.badge, toneClass[tone], className]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes} {...props}>
      {showDot ? <span className={styles.badgeDot} aria-hidden="true" /> : null}
      <span>{children}</span>
    </span>
  );
}
