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
  validateRegisterFields,
  type AuthFieldErrors,
} from "./auth-validation";
import { getAuthReturnPath } from "./return-route";
import { authSession } from "./session";

export function RegisterForm() {
  const [name, setName] = useState("");
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

    const nextErrors = validateRegisterFields({ name, email, password });
    setFieldErrors(nextErrors);
    setServerError(null);

    if (hasAuthFieldErrors(nextErrors)) {
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
        <h2 className={styles.title}>สร้างบัญชี</h2>
        <p className={styles.description}>
          สมัครบัญชีเพื่อสั่งสินค้า ติดตามคำสั่งซื้อ และรับการแจ้งเตือน
        </p>
      </div>

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <TextField
          id="register-name"
          label="ชื่อ"
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={fieldErrors.name}
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
          onChange={(event) => setEmail(event.target.value)}
          error={fieldErrors.email}
          disabled={pending}
          required
        />
        <TextField
          id="register-password"
          label="รหัสผ่าน"
          type="password"
          autoComplete="new-password"
          hint="ใช้รหัสผ่านขนาด 8–72 ไบต์"
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
          <Button type="submit" size="large" pending={pending} pendingLabel="กำลังสร้างบัญชี">
            สมัครสมาชิก
          </Button>
        </div>
      </form>

      <p className={styles.switchText}>
        มีบัญชีแล้ว?{" "}
        <Link href="/login/" className={styles.switchLink}>
          เข้าสู่ระบบ
        </Link>
      </p>

      <Link href="/" className={styles.backLink}>
        กลับหน้าร้านค้า
      </Link>
    </div>
  );
}
