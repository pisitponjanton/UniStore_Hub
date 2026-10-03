"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";

import { Button, ErrorSummary, Notice, TextField } from "@/components";
import { ApiClientError } from "@/services";

import styles from "./auth-form.module.css";
import { authService } from "./auth-service";
import {
  hasAuthFieldErrors,
  normalizeEmailInput,
  validateRegisterFields,
  type AuthFieldErrors,
} from "./auth-validation";
import { getAuthReturnPath } from "./return-route";
import { authSession } from "./session";
import { useAuthNavigationContext } from "./use-auth-navigation-context";

export function RegisterForm() {
  const navigation = useAuthNavigationContext();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function updateName(value: string) {
    setName(value);
    setFieldErrors((current) => ({ ...current, name: undefined }));
    setServerError(null);
  }

  function updateEmail(value: string) {
    setEmail(value);
    setFieldErrors((current) => ({ ...current, email: undefined }));
    setServerError(null);
  }

  function updatePassword(value: string) {
    setPassword(value);
    setFieldErrors((current) => ({ ...current, password: undefined }));
    setServerError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (pending) {
      return;
    }

    const nextErrors = validateRegisterFields({ name, email, password });
    setFieldErrors(nextErrors);
    setServerError(null);

    if (hasAuthFieldErrors(nextErrors)) {
      requestAnimationFrame(() => errorSummaryRef.current?.focus());
      return;
    }

    setPending(true);

    try {
      const result = await authService.register({
        name: name.trim(),
        email: normalizeEmailInput(email),
        password,
      });
      const state = await authSession.establish(result.token);

      if (state.status !== "authenticated") {
        throw new Error("SESSION_RESTORE_FAILED");
      }

      window.location.assign(getAuthReturnPath(window.location.search));
    } catch (error) {
      setServerError(
        error instanceof ApiClientError
          ? error.userMessage
          : "ไม่สามารถสมัครสมาชิกได้ กรุณาลองใหม่อีกครั้ง",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={styles.formShell}>
      <div className={styles.headingGroup}>
        <h2 className={styles.title}>สร้างบัญชีของคุณ</h2>
        <p className={styles.description}>
          ใช้บัญชีเดียวสำหรับสั่งซื้อ ติดตามการชำระเงิน และดูข้อมูลรับสินค้า
        </p>
      </div>

      {navigation.hasReturnContext ? (
        <Notice tone="info" title="สมัครแล้วกลับไปทำรายการต่อ">
          เมื่อสร้างบัญชีสำเร็จ ระบบจะพาคุณกลับไปยังหน้าที่กำลังใช้งานก่อนหน้านี้
        </Notice>
      ) : null}

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <ErrorSummary
          ref={errorSummaryRef}
          id="register-error-summary"
          items={[
            ...(fieldErrors.name
              ? [{ fieldId: "register-name", message: fieldErrors.name }]
              : []),
            ...(fieldErrors.email
              ? [{ fieldId: "register-email", message: fieldErrors.email }]
              : []),
            ...(fieldErrors.password
              ? [{ fieldId: "register-password", message: fieldErrors.password }]
              : []),
          ]}
        />

        <div className={styles.formFields}>
          <TextField
            id="register-name"
            label="ชื่อที่แสดง"
            autoComplete="name"
            value={name}
            onChange={(event) => updateName(event.target.value)}
            error={fieldErrors.name}
            announceError={false}
            disabled={pending}
            required
          />
          <TextField
            id="register-email"
            label="อีเมล"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(event) => updateEmail(event.target.value)}
            error={fieldErrors.email}
            announceError={false}
            disabled={pending}
            required
          />
          <TextField
            id="register-password"
            label="รหัสผ่าน"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            hint="รหัสผ่านต้องมีความยาว 8 ถึง 72 ไบต์"
            value={password}
            onChange={(event) => updatePassword(event.target.value)}
            error={fieldErrors.password}
            announceError={false}
            disabled={pending}
            required
          />
          <button
            type="button"
            className={styles.passwordToggle}
            aria-controls="register-password"
            aria-pressed={showPassword}
            disabled={pending}
            onClick={() => setShowPassword((current) => !current)}
          >
            {showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
          </button>
        </div>

        {serverError ? (
          <Notice tone="danger" role="alert" title="สมัครสมาชิกไม่สำเร็จ">
            {serverError}
          </Notice>
        ) : null}

        <div className={styles.formActions}>
          <Button
            type="submit"
            size="large"
            pending={pending}
            pendingLabel="กำลังสร้างบัญชี"
          >
            สร้างบัญชี
          </Button>
        </div>
      </form>

      <div className={styles.formDivider} aria-hidden="true" />

      <div className={styles.formFooter}>
        <p className={styles.switchText}>
          มีบัญชีแล้ว?
          <Link href={navigation.loginHref} className={styles.switchLink}>
            เข้าสู่ระบบ
          </Link>
        </p>

        <Link href={navigation.returnPath} className={styles.backLink}>
          {navigation.hasReturnContext
            ? "กลับไปหน้าที่กำลังใช้งาน"
            : "กลับหน้าร้านค้า"}
        </Link>
      </div>
    </div>
  );
}
