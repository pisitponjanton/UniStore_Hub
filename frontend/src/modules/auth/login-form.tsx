"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { Button, Notice, TextField } from "@/components";
import { ApiClientError } from "@/services";

import styles from "./auth-form.module.css";
import { authService } from "./auth-service";
import {
  hasAuthFieldErrors,
  normalizeEmailInput,
  validateLoginFields,
  type AuthFieldErrors,
} from "./auth-validation";
import { getAuthReturnPath } from "./return-route";
import { authSession } from "./session";
import { useAuthNavigationContext } from "./use-auth-navigation-context";

function focusFirstInvalidField(errors: AuthFieldErrors) {
  const id = errors.email
    ? "login-email"
    : errors.password
      ? "login-password"
      : null;

  if (id) {
    document.getElementById(id)?.focus();
  }
}

export function LoginForm() {
  const navigation = useAuthNavigationContext();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

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

    const nextErrors = validateLoginFields({ email, password });
    setFieldErrors(nextErrors);
    setServerError(null);

    if (hasAuthFieldErrors(nextErrors)) {
      focusFirstInvalidField(nextErrors);
      return;
    }

    setPending(true);

    try {
      const result = await authService.login({
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
          : "ไม่สามารถเข้าสู่ระบบได้ กรุณาลองใหม่อีกครั้ง",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={styles.formShell}>
      <div className={styles.headingGroup}>
        <h2 className={styles.title}>เข้าสู่ระบบ</h2>
        <p className={styles.description}>
          ใช้อีเมลและรหัสผ่านของคุณเพื่อเข้าสู่ UniStore Hub
        </p>
      </div>

      {navigation.hasReturnContext ? (
        <Notice tone="info" title="กลับไปทำรายการเดิมต่อได้">
          หลังเข้าสู่ระบบ ระบบจะพาคุณกลับไปยังหน้าที่กำลังใช้งานก่อนหน้านี้
        </Notice>
      ) : null}

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <TextField
          id="login-email"
          label="อีเมล"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(event) => updateEmail(event.target.value)}
          error={fieldErrors.email}
          disabled={pending}
          autoFocus
          required
        />
        <TextField
          id="login-password"
          label="รหัสผ่าน"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => updatePassword(event.target.value)}
          error={fieldErrors.password}
          disabled={pending}
          required
        />

        {serverError ? (
          <Notice tone="danger" role="alert" title="เข้าสู่ระบบไม่สำเร็จ">
            {serverError}
          </Notice>
        ) : null}

        <div className={styles.formActions}>
          <Button
            type="submit"
            size="large"
            pending={pending}
            pendingLabel="กำลังเข้าสู่ระบบ"
          >
            เข้าสู่ระบบ
          </Button>
        </div>
      </form>

      <div className={styles.formFooter}>
        <p className={styles.switchText}>
          ยังไม่มีบัญชี?{" "}
          <Link href={navigation.registerHref} className={styles.switchLink}>
            สมัครสมาชิก
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
