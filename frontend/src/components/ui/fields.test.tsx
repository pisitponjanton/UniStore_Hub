import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createRef } from "react";

import { ErrorSummary, FileField, SelectField } from "./fields";

describe("SelectField", () => {
  it("opens a themed listbox, supports selection, and retains the native change event", () => {
    const onChange = vi.fn();
    render(
      <SelectField id="organization" label="หน่วยงาน" required onChange={onChange}>
        <option value="">เลือกหน่วยงาน</option>
        <option value="org-1">คณะวิศวกรรมศาสตร์</option>
      </SelectField>,
    );

    const select = screen.getByRole("combobox", { name: "หน่วยงาน" });
    expect(select).toHaveAttribute("aria-required", "true");
    fireEvent.click(select);

    const listbox = screen.getByRole("listbox", { name: "หน่วยงาน ตัวเลือก" });
    expect(listbox).toBeInTheDocument();
    expect(listbox).toHaveClass("scrollbarOnHover");
    fireEvent.click(screen.getByRole("option", { name: "คณะวิศวกรรมศาสตร์" }));

    expect(select).toHaveTextContent("คณะวิศวกรรมศาสตร์");
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange.mock.calls[0]?.[0].target.value).toBe("org-1");
    expect(document.querySelector("svg[aria-hidden='true']")).toBeInTheDocument();
    expect(document.querySelector("svg[aria-hidden='true']")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });
  it("supports arrow-key navigation, Enter selection, and Escape dismissal", () => {
    render(
      <SelectField id="status" label="สถานะ" defaultValue="draft">
        <option value="draft">ฉบับร่าง</option>
        <option value="open">เปิดรับคำสั่งซื้อ</option>
      </SelectField>,
    );

    const select = screen.getByRole("combobox", { name: "สถานะ" });
    fireEvent.keyDown(select, { key: "ArrowDown" });
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(select).toHaveAttribute("aria-activedescendant", expect.stringContaining("option-0"));

    fireEvent.keyDown(select, { key: "ArrowDown" });
    expect(select).toHaveAttribute("aria-activedescendant", expect.stringContaining("option-1"));
    fireEvent.keyDown(select, { key: "Enter" });
    expect(select).toHaveTextContent("เปิดรับคำสั่งซื้อ");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    fireEvent.keyDown(select, { key: "ArrowDown" });
    fireEvent.keyDown(select, { key: "Escape" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});

describe("FileField", () => {
  it("keeps label, hint, error, required state, and file semantics connected", () => {
    render(
      <FileField
        id="payment-proof"
        label="หลักฐานการชำระเงิน"
        hint="รองรับ JPEG, PNG หรือ WebP"
        error="ไฟล์มีขนาดใหญ่เกินไป"
        accept="image/jpeg,image/png,image/webp"
        required
      />,
    );

    const input = screen.getByLabelText(/หลักฐานการชำระเงิน/);

    expect(input).toHaveAttribute("type", "file");
    expect(input).toBeRequired();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute(
      "aria-describedby",
      "payment-proof-hint payment-proof-error",
    );
    expect(input).toHaveAttribute(
      "aria-errormessage",
      "payment-proof-error",
    );
    expect(screen.getByText("รองรับ JPEG, PNG หรือ WebP")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "ไฟล์มีขนาดใหญ่เกินไป",
    );
  });

  it("provides a focusable error summary with links back to invalid fields", () => {
    const summaryRef = createRef<HTMLDivElement>();

    render(
      <>
        <ErrorSummary
          ref={summaryRef}
          items={[
            { fieldId: "email", message: "กรุณาระบุอีเมล" },
            { fieldId: "name", message: "กรุณาระบุชื่อ" },
          ]}
        />
        <input id="email" />
        <input id="name" />
      </>,
    );

    const summary = screen.getByRole("alert");
    expect(summary).toHaveAttribute("tabindex", "-1");
    expect(
      screen.getByRole("heading", { name: "กรุณาตรวจสอบข้อมูล" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "กรุณาระบุอีเมล" })).toHaveAttribute(
      "href",
      "#email",
    );

    summaryRef.current?.focus();
    expect(summary).toHaveFocus();
  });
});
