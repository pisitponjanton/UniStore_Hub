import {
  forwardRef,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

import styles from "./primitives.module.css";

interface FieldChromeProps {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  announceError?: boolean;
  children: ReactNode;
}

function FieldChrome({
  id,
  label,
  hint,
  error,
  required,
  announceError = true,
  children,
}: FieldChromeProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel} htmlFor={id}>
        <span>{label}</span>
        {required ? (
          <span className={styles.fieldRequired} aria-hidden="true" />
        ) : null}
      </label>
      {children}
      {hint ? (
        <span className={styles.fieldHint} id={hintId}>
          {hint}
        </span>
      ) : null}
      {error ? (
        <span
          className={styles.fieldError}
          id={errorId}
          role={announceError ? "alert" : undefined}
        >
          {error}
        </span>
      ) : null}
    </div>
  );
}

function describedBy(id: string, hint?: ReactNode, error?: ReactNode) {
  return [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(" ") || undefined;
}

export interface ErrorSummaryItem {
  fieldId: string;
  message: ReactNode;
}

export interface ErrorSummaryProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title?: ReactNode;
  items: ErrorSummaryItem[];
}

export const ErrorSummary = forwardRef<HTMLDivElement, ErrorSummaryProps>(
  function ErrorSummary(
    {
      title = "กรุณาตรวจสอบข้อมูล",
      items,
      className,
      id = "form-error-summary",
      ...props
    },
    ref,
  ) {
    if (items.length === 0) {
      return null;
    }

    const titleId = `${id}-title`;
    const classes = [styles.errorSummary, className].filter(Boolean).join(" ");

    return (
      <div
        ref={ref}
        id={id}
        className={classes}
        role="alert"
        tabIndex={-1}
        aria-labelledby={titleId}
        {...props}
      >
        <h2 className={styles.errorSummaryTitle} id={titleId}>
          {title}
        </h2>
        <ul className={styles.errorSummaryList}>
          {items.map((item) => (
            <li key={item.fieldId}>
              <a className={styles.errorSummaryLink} href={`#${item.fieldId}`}>
                {item.message}
              </a>
            </li>
          ))}
        </ul>
      </div>
    );
  },
);

export interface TextFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  announceError?: boolean;
}

export function TextField({
  id,
  label,
  hint,
  error,
  announceError,
  required,
  className,
  ...props
}: TextFieldProps) {
  const classes = [
    styles.fieldControl,
    error ? styles.fieldInvalid : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <FieldChrome
      id={id}
      label={label}
      hint={hint}
      error={error}
      announceError={announceError}
      required={required}
    >
      <input
        id={id}
        required={required}
        className={classes}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        aria-errormessage={error ? `${id}-error` : undefined}
        {...props}
      />
    </FieldChrome>
  );
}

export interface TextareaFieldProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  announceError?: boolean;
}

export function TextareaField({
  id,
  label,
  hint,
  error,
  announceError,
  required,
  className,
  ...props
}: TextareaFieldProps) {
  const classes = [
    styles.fieldControl,
    styles.textarea,
    error ? styles.fieldInvalid : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <FieldChrome
      id={id}
      label={label}
      hint={hint}
      error={error}
      announceError={announceError}
      required={required}
    >
      <textarea
        id={id}
        required={required}
        className={classes}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        aria-errormessage={error ? `${id}-error` : undefined}
        {...props}
      />
    </FieldChrome>
  );
}

export interface SelectFieldProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  announceError?: boolean;
}

export function SelectField({
  id,
  label,
  hint,
  error,
  announceError,
  required,
  className,
  children,
  ...props
}: SelectFieldProps) {
  const classes = [
    styles.fieldControl,
    styles.selectControl,
    error ? styles.fieldInvalid : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <FieldChrome
      id={id}
      label={label}
      hint={hint}
      error={error}
      announceError={announceError}
      required={required}
    >
      <select
        id={id}
        required={required}
        className={classes}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        aria-errormessage={error ? `${id}-error` : undefined}
        {...props}
      >
        {children}
      </select>
    </FieldChrome>
  );
}

export interface FileFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "type"> {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  announceError?: boolean;
}

export function FileField({
  id,
  label,
  hint,
  error,
  announceError,
  required,
  className,
  ...props
}: FileFieldProps) {
  const classes = [
    styles.fieldControl,
    styles.fileControl,
    error ? styles.fieldInvalid : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <FieldChrome
      id={id}
      label={label}
      hint={hint}
      error={error}
      announceError={announceError}
      required={required}
    >
      <input
        id={id}
        type="file"
        required={required}
        className={classes}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        aria-errormessage={error ? `${id}-error` : undefined}
        {...props}
      />
    </FieldChrome>
  );
}
