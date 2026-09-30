import { describe, expect, it } from "vitest";

import {
  normalizeEmailInput,
  validateEmail,
  validateName,
  validatePassword,
} from "./auth-validation";
import { sanitizeAuthReturnPath } from "./return-route";

describe("auth validation", () => {
  it("normalizes email according to the API baseline", () => {
    expect(normalizeEmailInput("  Student@Example.COM ")).toBe(
      "student@example.com",
    );
  });

  it("validates obvious email, password, and name constraints", () => {
    expect(validateEmail("bad-email")).toBeTruthy();
    expect(validateEmail("student@example.com")).toBeUndefined();
    expect(validatePassword("short")).toBeTruthy();
    expect(validatePassword("password123")).toBeUndefined();
    expect(validateName("   ")).toBeTruthy();
    expect(validateName("Student Name")).toBeUndefined();
  });

  it("counts password UTF-8 bytes rather than JavaScript characters", () => {
    expect(validatePassword("กก")).toBeTruthy();
    expect(validatePassword("กกก")).toBeUndefined();
  });
});

describe("auth return route", () => {
  it("allows internal paths and rejects external or protocol-relative redirects", () => {
    expect(sanitizeAuthReturnPath("/my/orders/?orderId=1")).toBe(
      "/my/orders/?orderId=1",
    );
    expect(sanitizeAuthReturnPath("https://example.com")).toBe("/");
    expect(sanitizeAuthReturnPath("//example.com/path")).toBe("/");
    expect(sanitizeAuthReturnPath("/\\example.com")).toBe("/");
  });
});
