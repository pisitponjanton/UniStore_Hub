export interface AuthFieldErrors {
  email?: string;
  password?: string;
  name?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmailInput(value: string): string {
  return value.trim().toLowerCase();
}

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

export function validateEmail(value: string): string | undefined {
  const email = normalizeEmailInput(value);

  if (!email) {
    return "กรุณากรอกอีเมล";
  }

  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return "รูปแบบอีเมลไม่ถูกต้อง";
  }

  return undefined;
}

export function validatePassword(value: string): string | undefined {
  const bytes = utf8ByteLength(value);

  if (bytes < 8) {
    return "รหัสผ่านต้องมีอย่างน้อย 8 ไบต์";
  }

  if (bytes > 72) {
    return "รหัสผ่านต้องมีความยาวไม่เกิน 72 ไบต์";
  }

  return undefined;
}

export function validateName(value: string): string | undefined {
  const name = value.trim();
  const length = Array.from(name).length;

  if (!name) {
    return "กรุณากรอกชื่อ";
  }

  if (length > 100) {
    return "ชื่อต้องมีความยาวไม่เกิน 100 ตัวอักษร";
  }

  return undefined;
}

export function validateLoginFields({
  email,
  password,
}: {
  email: string;
  password: string;
}): AuthFieldErrors {
  return {
    email: validateEmail(email),
    password: validatePassword(password),
  };
}

export function validateRegisterFields({
  email,
  password,
  name,
}: {
  email: string;
  password: string;
  name: string;
}): AuthFieldErrors {
  return {
    email: validateEmail(email),
    password: validatePassword(password),
    name: validateName(name),
  };
}

export function hasAuthFieldErrors(errors: AuthFieldErrors): boolean {
  return Object.values(errors).some(Boolean);
}
