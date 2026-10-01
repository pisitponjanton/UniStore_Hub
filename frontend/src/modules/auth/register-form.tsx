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
  validateRegisterFields,
  type AuthFieldErrors,
} from "./auth-validation";
import { getAuthReturnPath } from "./return-route";
import { authSession } from "./session";
import { useAuthNavigationContext } from "./use-auth-navigation-context";

function focusFirstInvalidField(errors: AuthFieldErrors) {
  const id = errors.name
    ? "register-name"
    : errors.email
      ? "register-email"
      : errors.password
        ? "register-password"
        : null;

  if (id) {
    document.getElementById(id)?.focus();
  }
}

export function RegisterForm() {
  const navigation = useAuthNavigationContext();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
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
      focusFirstInvalidField(nextErrors);
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
          สมัครเพื่อสั่งสินค้า ติดตามคำสั่งซื้อ และรับการแจ้งเตือนจากระบบ
        </p>
      </div>

      {navigation.hasReturnContext ? (
        <Notice tone="info" title="กลับไปทำรายการเดิมต่อได้">
          หลังสมัครสำเร็จ ระบบจะพาคุณกลับไปยังหน้าที่กำลังใช้งานก่อนหน้านี้
        </Notice>
      ) : null}

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <TextField
          id="register-name"
          label="ชื่อ"
          autoComplete="name"
          value={name}
          onChange={(event) => updateName(event.target.value)}
          error={fieldErrors.name}
          disabled={pending}
          autoFocus
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
          disabled={pending}
          required
        />
        <TextField
          id="register-password"
          label="รหัสผ่าน"
          type="password"
          autoComplete="new-password"
          hint="ใช้รหัสผ่านขนาด 8 ถึง 72 ไบต์"
          value={password}
          onChange={(event) => updatePassword(event.target.value)}
          error={fieldErrors.password}
          disabled={pending}
          required
        />

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
            สมัครสมาชิก
          </Button>
        </div>
      </form>

      <div className={styles.formFooter}>
        <p className={styles.switchText}>
          มีบัญชีแล้ว?{" "}
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
