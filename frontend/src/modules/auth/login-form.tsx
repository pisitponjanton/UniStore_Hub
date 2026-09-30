"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { Button, TextField } from "@/components";
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

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (pending) {
      return;
    }

    const nextErrors = validateLoginFields({ email, password });
    setFieldErrors(nextErrors);
    setServerError(null);

    if (hasAuthFieldErrors(nextErrors)) {
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

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <TextField
          id="login-email"
          label="อีเมล"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={fieldErrors.email}
          disabled={pending}
          required
        />
        <TextField
          id="login-password"
          label="รหัสผ่าน"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={fieldErrors.password}
          disabled={pending}
          required
        />

        {serverError ? (
          <div className={styles.serverError} role="alert">
            {serverError}
          </div>
        ) : null}

        <div className={styles.formActions}>
          <Button type="submit" size="large" pending={pending} pendingLabel="กำลังเข้าสู่ระบบ">
            เข้าสู่ระบบ
          </Button>
        </div>
      </form>

      <p className={styles.switchText}>
        ยังไม่มีบัญชี?{" "}
        <Link href="/register/" className={styles.switchLink}>
          สมัครสมาชิก
        </Link>
      </p>

      <Link href="/" className={styles.backLink}>
        กลับหน้าร้านค้า
      </Link>
    </div>
  );
}
