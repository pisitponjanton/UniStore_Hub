import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useAuthNavigationContext: vi.fn(),
}));

vi.mock("./use-auth-navigation-context", () => ({
  useAuthNavigationContext: mocks.useAuthNavigationContext,
}));

import { LoginForm } from "./login-form";
import { RegisterForm } from "./register-form";

describe("authentication forms", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useAuthNavigationContext.mockReturnValue({
      returnPath: "/",
      hasReturnContext: false,
      loginHref: "/login/",
      registerHref: "/register/",
    });
  });

  it("shows a focusable validation summary and lets users reveal the login password", () => {
    render(<LoginForm />);

    const email = screen.getByLabelText("อีเมล");
    const password = screen.getByLabelText("รหัสผ่าน");
    expect(email).not.toHaveFocus();
    expect(password).toHaveAttribute("type", "password");
    expect(password).toHaveAttribute("autocomplete", "current-password");

    fireEvent.click(screen.getByRole("button", { name: "แสดงรหัสผ่าน" }));
    expect(password).toHaveAttribute("type", "text");
    expect(
      screen.getByRole("button", { name: "ซ่อนรหัสผ่าน" }),
    ).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "เข้าสู่ระบบ" }));

    const summary = screen.getByRole("alert");
    expect(summary).toHaveAttribute("tabindex", "-1");
    expect(
      screen.getByRole("link", { name: "กรุณากรอกอีเมล" }),
    ).toHaveAttribute("href", "#login-email");
    expect(
      screen.getByRole("link", {
        name: "รหัสผ่านต้องมีอย่างน้อย 8 ไบต์",
      }),
    ).toHaveAttribute("href", "#login-password");
  });

  it("keeps registration labels, autocomplete, inline errors, and summary links connected", () => {
    render(<RegisterForm />);

    const name = screen.getByLabelText("ชื่อที่แสดง");
    const password = screen.getByLabelText("รหัสผ่าน");
    expect(name).not.toHaveFocus();
    expect(password).toHaveAttribute("autocomplete", "new-password");

    fireEvent.click(screen.getByRole("button", { name: "แสดงรหัสผ่าน" }));
    expect(password).toHaveAttribute("type", "text");

    fireEvent.click(screen.getByRole("button", { name: "สร้างบัญชี" }));

    expect(document.getElementById("register-name-error")).toHaveTextContent(
      "กรุณากรอกชื่อ",
    );
    expect(screen.getByLabelText("ชื่อที่แสดง")).toHaveAttribute(
      "aria-errormessage",
      "register-name-error",
    );
    expect(
      screen.getByRole("link", { name: "กรุณากรอกชื่อ" }),
    ).toHaveAttribute("href", "#register-name");
    expect(
      screen.getByRole("link", { name: "กรุณากรอกอีเมล" }),
    ).toHaveAttribute("href", "#register-email");
  });
});
