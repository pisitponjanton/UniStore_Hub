import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

import styles from "./primitives.module.css";

interface FieldChromeProps {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  children: ReactNode;
}

function FieldChrome({
  id,
  label,
  hint,
  error,
  required,
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
        <span className={styles.fieldError} id={errorId} role="alert">
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

export interface TextFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
}

export function TextField({
  id,
  label,
  hint,
  error,
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
      required={required}
    >
      <input
        id={id}
        required={required}
        className={classes}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
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
}

export function TextareaField({
  id,
  label,
  hint,
  error,
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
      required={required}
    >
      <textarea
        id={id}
        required={required}
        className={classes}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
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
}

export function SelectField({
  id,
  label,
  hint,
  error,
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
      required={required}
    >
      <select
        id={id}
        required={required}
        className={classes}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
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
}

export function FileField({
  id,
  label,
  hint,
  error,
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
      required={required}
    >
      <input
        id={id}
        type="file"
        required={required}
        className={classes}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...props}
      />
    </FieldChrome>
  );
}
