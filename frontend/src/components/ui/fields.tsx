"use client";

import {
  Children,
  forwardRef,
  Fragment,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type HTMLAttributes,
  type ChangeEvent,
  type FocusEventHandler,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";

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

interface SelectOption {
  value: string;
  label: ReactNode;
  text: string;
  disabled: boolean;
}

function optionText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(optionText).join("");
  }
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return optionText(node.props.children);
  }
  return "";
}

function getSelectOptions(children: ReactNode): SelectOption[] {
  const options: SelectOption[] = [];

  function collect(nodes: ReactNode) {
    Children.forEach(nodes, (child) => {
      if (!isValidElement<{ children?: ReactNode; value?: string; disabled?: boolean }>(child)) {
        return;
      }

      if (child.type === Fragment) {
        collect(child.props.children);
        return;
      }

      if (child.type !== "option") {
        return;
      }

      const label = child.props.children;
      options.push({
        value: child.props.value ?? optionText(label),
        label,
        text: optionText(label).trim(),
        disabled: Boolean(child.props.disabled),
      });
    });
  }

  collect(children);
  return options;
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
  value,
  defaultValue,
  onChange,
  onBlur,
  onFocus,
  onKeyDown,
  disabled = false,
  name,
  form,
  autoFocus,
  title,
  ...props
}: SelectFieldProps) {
  const generatedId = useId();
  const listboxId = `${id}-options-${generatedId.replace(/:/g, "")}`;
  const options = getSelectOptions(children);
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(String(defaultValue ?? ""));
  const selectedValue = String(isControlled ? value ?? "" : internalValue);
  const selectedIndex = options.findIndex((option) => option.value === selectedValue);
  const selectedOption = options[selectedIndex];
  const [open, setOpen] = useState(false);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(Math.max(0, selectedIndex));
  const [menuStyle, setMenuStyle] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
    position: "fixed" | "absolute";
  }>();
  const rootRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const nativeSelectRef = useRef<HTMLSelectElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLDivElement | null>>([]);
  const typeaheadRef = useRef("");
  const typeaheadTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const classes = [styles.selectTrigger, error ? styles.fieldInvalid : "", className]
    .filter(Boolean)
    .join(" ");

  const closeMenu = useCallback((restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) {
      requestAnimationFrame(() => triggerRef.current?.focus());
    }
  }, []);

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const viewportPadding = 12;
    const desiredHeight = Math.min(280, Math.max(48, options.length * 44 + 8));
    const dialog = trigger.closest<HTMLElement>('[role="dialog"]');
    const dialogRect = dialog?.getBoundingClientRect();
    const boundsTop = dialogRect?.top ?? viewportPadding;
    const boundsBottom = dialogRect?.bottom ?? window.innerHeight - viewportPadding;
    const below = boundsBottom - rect.bottom - (dialogRect ? 8 : viewportPadding);
    const above = rect.top - boundsTop - (dialogRect ? 8 : 0);
    const placeAbove = below < Math.min(desiredHeight, 180) && above > below;
    const maxHeight = Math.max(48, Math.min(desiredHeight, placeAbove ? above : below));
    const top = placeAbove ? rect.top - maxHeight - 8 : rect.bottom + 8;
    const left = Math.max(
      viewportPadding,
      Math.min(rect.left, window.innerWidth - rect.width - viewportPadding),
    );

    setMenuStyle({
      top: dialogRect ? top - dialogRect.top : Math.max(viewportPadding, top),
      left: dialogRect ? left - dialogRect.left : left,
      width: Math.min(rect.width, window.innerWidth - viewportPadding * 2),
      maxHeight,
      position: dialogRect ? "absolute" : "fixed",
    });
  }, [options.length]);

  const showMenu = useCallback((index = selectedIndex) => {
    if (disabled) return;
    setActiveIndex(Math.max(0, index));
    setPortalContainer(
      triggerRef.current?.closest<HTMLElement>('[role="dialog"]') ?? document.body,
    );
    updateMenuPosition();
    setOpen(true);
  }, [disabled, selectedIndex, updateMenuPosition]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !listboxRef.current?.contains(target)) {
        closeMenu();
      }
    };
    const onViewportChange = () => updateMenuPosition();

    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, true);
    };
  }, [closeMenu, open, updateMenuPosition]);

  useEffect(() => {
    if (open) {
      optionRefs.current[activeIndex]?.scrollIntoView?.({ block: "nearest" });
    }
  }, [activeIndex, open]);

  useEffect(() => {
    if (autoFocus) triggerRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => () => {
    if (typeaheadTimerRef.current) clearTimeout(typeaheadTimerRef.current);
  }, []);

  function moveActive(direction: 1 | -1) {
    if (!options.length) return;
    let next = activeIndex;
    for (let count = 0; count < options.length; count += 1) {
      next = (next + direction + options.length) % options.length;
      if (!options[next]?.disabled) break;
    }
    setActiveIndex(next);
  }

  function commitValue(nextValue: string) {
    const nativeSelect = nativeSelectRef.current;
    if (!nativeSelect) return;
    if (!isControlled) setInternalValue(nextValue);
    nativeSelect.value = nextValue;
    nativeSelect.dispatchEvent(new Event("change", { bubbles: true }));
    closeMenu(true);
  }

  function handleNativeChange(event: ChangeEvent<HTMLSelectElement>) {
    if (!isControlled) setInternalValue(event.currentTarget.value);
    onChange?.(event);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    onKeyDown?.(event as unknown as KeyboardEvent<HTMLSelectElement>);
    if (event.defaultPrevented) return;

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        showMenu(selectedIndex >= 0 ? selectedIndex : 0);
      } else {
        moveActive(event.key === "ArrowDown" ? 1 : -1);
      }
      return;
    }

    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      if (!open) showMenu();
      const direction = event.key === "Home" ? 1 : -1;
      const start = event.key === "Home" ? 0 : options.length - 1;
      let index = start;
      while (options[index]?.disabled && index >= 0 && index < options.length) index += direction;
      setActiveIndex(Math.max(0, Math.min(options.length - 1, index)));
      return;
    }

    if (event.key === "Escape" && open) {
      event.preventDefault();
      closeMenu(true);
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open && options[activeIndex]) commitValue(options[activeIndex].value);
      else showMenu();
      return;
    }

    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      typeaheadRef.current += event.key.toLocaleLowerCase();
      if (typeaheadTimerRef.current) clearTimeout(typeaheadTimerRef.current);
      typeaheadTimerRef.current = setTimeout(() => { typeaheadRef.current = ""; }, 700);
      const match = options.findIndex((option) =>
        !option.disabled && option.text.toLocaleLowerCase().startsWith(typeaheadRef.current),
      );
      if (match >= 0) {
        if (!open) showMenu(match);
        else setActiveIndex(match);
      }
    }
  }

  return (
    <FieldChrome
      id={id}
      label={label}
      hint={hint}
      error={error}
      announceError={announceError}
      required={required}
    >
      <span ref={rootRef} className={styles.selectShell}>
        <select
          ref={nativeSelectRef}
          id={`${id}-native`}
          name={name}
          form={form}
          required={required}
          value={selectedValue}
          onChange={handleNativeChange}
          className={styles.nativeSelect}
          aria-hidden="true"
          tabIndex={-1}
          onInvalid={(event) => {
            event.preventDefault();
            triggerRef.current?.focus();
            showMenu();
          }}
          {...props}
        >
          {children}
        </select>
        <button
          ref={triggerRef}
          id={id}
          type="button"
          className={classes}
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listboxId : undefined}
          aria-activedescendant={open ? `${listboxId}-option-${activeIndex}` : undefined}
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error)}
          aria-errormessage={error ? `${id}-error` : undefined}
          disabled={disabled}
          title={title}
          onFocus={onFocus as unknown as FocusEventHandler<HTMLButtonElement>}
          onBlur={onBlur as unknown as FocusEventHandler<HTMLButtonElement>}
          onKeyDown={handleKeyDown}
          onClick={() => open ? closeMenu() : showMenu()}
        >
          <span className={styles.selectValue}>
            {selectedOption?.label ?? <span className={styles.selectPlaceholder}>เลือก...</span>}
          </span>
          <svg
            className={`${styles.selectChevron} ${open ? styles.selectChevronOpen : ""}`}
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="none"
          >
            <path
              d="m5.5 7.5 4.5 4.5 4.5-4.5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        {open && typeof document !== "undefined" ? createPortal(
          <div
            ref={listboxRef}
            id={listboxId}
            role="listbox"
            aria-label={`${String(label)} ตัวเลือก`}
            className={`${styles.selectMenu} scrollbarOnHover`}
            style={menuStyle}
          >
            {options.map((option, index) => (
              <div
                key={`${option.value}-${index}`}
                ref={(node) => { optionRefs.current[index] = node; }}
                id={`${listboxId}-option-${index}`}
                role="option"
                aria-selected={option.value === selectedValue}
                aria-disabled={option.disabled || undefined}
                className={[
                  styles.selectOption,
                  index === activeIndex ? styles.selectOptionActive : "",
                  option.value === selectedValue ? styles.selectOptionSelected : "",
                  option.disabled ? styles.selectOptionDisabled : "",
                ].filter(Boolean).join(" ")}
                onMouseMove={() => !option.disabled && setActiveIndex(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => !option.disabled && commitValue(option.value)}
              >
                <span className={styles.selectOptionLabel}>{option.label}</span>
                {option.value === selectedValue ? (
                  <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
                    <path d="m4 10 4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : null}
              </div>
            ))}
          </div>,
          portalContainer ?? document.body,
        ) : null}
      </span>
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
