import type {
  CSSProperties,
  HTMLAttributes,
  ReactNode,
} from "react";

import styles from "./primitives.module.css";

type MediaTone = "brand" | "warm" | "cool" | "neutral";
type MediaFit = "contain" | "cover";
type SkeletonShape = "text" | "block" | "circle";
export type BrandIllustrationVariant =
  | "market"
  | "parcel"
  | "product"
  | "payment"
  | "pickup"
  | "notification";

export interface MediaShellProps extends HTMLAttributes<HTMLDivElement> {
  tone?: MediaTone;
  fit?: MediaFit;
  aspectRatio?: CSSProperties["aspectRatio"];
  decorative?: boolean;
  children: ReactNode;
}

export function MediaShell({
  tone = "brand",
  fit = "cover",
  aspectRatio,
  decorative = false,
  className,
  style,
  children,
  "aria-hidden": ariaHidden,
  ...props
}: MediaShellProps) {
  const classes = [styles.mediaShell, className].filter(Boolean).join(" ");

  return (
    <div
      {...props}
      className={classes}
      data-tone={tone}
      data-fit={fit}
      data-decorative={decorative || undefined}
      aria-hidden={decorative ? true : ariaHidden}
      style={{ aspectRatio, ...style }}
    >
      {children}
    </div>
  );
}

export interface BrandIllustrationProps
  extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  variant?: BrandIllustrationVariant;
  decorative?: boolean;
  label?: string;
}

export function BrandIllustration({
  variant = "market",
  decorative = true,
  label,
  className,
  ...props
}: BrandIllustrationProps) {
  const hidden = decorative || !label;
  const classes = [styles.brandIllustration, className]
    .filter(Boolean)
    .join(" ");

  return (
    <span
      {...props}
      className={classes}
      data-illustration={variant}
      aria-hidden={hidden ? true : undefined}
      role={hidden ? undefined : "img"}
      aria-label={hidden ? undefined : label}
    >
      <span className={styles.illustrationBackdrop} />
      <span className={styles.illustrationObject}>
        <span className={styles.illustrationObjectDetail} />
      </span>
      <span className={styles.illustrationAccent} />
      <span className={styles.illustrationTag} />
    </span>
  );
}

export interface MediaFallbackProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  label: string;
  variant?: BrandIllustrationVariant;
}

export function MediaFallback({
  label,
  variant = "product",
  className,
  ...props
}: MediaFallbackProps) {
  const classes = [styles.mediaFallback, className]
    .filter(Boolean)
    .join(" ");

  return (
    <div {...props} className={classes}>
      <BrandIllustration variant={variant} decorative />
      <span className={styles.mediaFallbackLabel}>{label}</span>
    </div>
  );
}

export interface SkeletonProps extends HTMLAttributes<HTMLSpanElement> {
  shape?: SkeletonShape;
}

const shapeClass: Record<SkeletonShape, string> = {
  text: styles.skeletonText,
  block: styles.skeletonBlock,
  circle: styles.skeletonCircle,
};

export function Skeleton({
  shape = "text",
  className,
  ...props
}: SkeletonProps) {
  const classes = [styles.skeleton, shapeClass[shape], className]
    .filter(Boolean)
    .join(" ");

  return <span {...props} className={classes} aria-hidden="true" />;
}
