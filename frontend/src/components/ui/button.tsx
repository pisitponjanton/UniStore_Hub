import type { ButtonHTMLAttributes, ReactNode } from "react";

import styles from "./primitives.module.css";

type ButtonVariant = "primary" | "secondary" | "quiet" | "danger";
type ButtonSize = "small" | "medium" | "large";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  pending?: boolean;
  pendingLabel?: string;
  leading?: ReactNode;
}

const variantClass: Record<ButtonVariant, string> = {
  primary: styles.buttonPrimary,
  secondary: styles.buttonSecondary,
  quiet: styles.buttonQuiet,
  danger: styles.buttonDanger,
};

const sizeClass: Record<ButtonSize, string> = {
  small: styles.buttonSmall,
  medium: "",
  large: styles.buttonLarge,
};

export function Button({
  variant = "primary",
  size = "medium",
  pending = false,
  pendingLabel,
  leading,
  className,
  disabled,
  type = "button",
  children,
  ...props
}: ButtonProps) {
  const classes = [styles.button, variantClass[variant], sizeClass[size], className]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      {...props}
    >
      {pending ? <span className={styles.buttonSpinner} aria-hidden="true" /> : leading}
      <span>{pending && pendingLabel ? pendingLabel : children}</span>
    </button>
  );
}
