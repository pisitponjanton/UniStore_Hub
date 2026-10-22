import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createRef } from "react";

import { ErrorSummary, FileField, SelectField } from "./fields";

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


describe("Native SelectField behavior during visual migration", () => {
  it("retains the HTML select, label, hint, validation and keyboard change semantics", () => {
    const onChange = vi.fn();
    render(
      <SelectField
        id="campaign-status"
        label="สถานะรอบสั่งซื้อ"
        hint="เลือกสถานะที่ต้องการ"
        error="กรุณาเลือกสถานะ"
        defaultValue=""
        onChange={onChange}
        required
      >
        <option value="">เลือกสถานะ</option>
        <option value="OPEN">เปิดรับคำสั่งซื้อ</option>
        <option value="CLOSED">ปิดรับคำสั่งซื้อ</option>
      </SelectField>,
    );

    const select = screen.getByRole("combobox", { name: /สถานะรอบสั่งซื้อ/ });
    expect(select.tagName).toBe("SELECT");
    expect(select).toBeRequired();
    expect(select).toHaveAttribute("aria-invalid", "true");
    expect(select).toHaveAttribute(
      "aria-describedby",
      "campaign-status-hint campaign-status-error",
    );
    expect(select).toHaveAttribute("aria-errormessage", "campaign-status-error");
    expect(screen.getByRole("option", { name: "เปิดรับคำสั่งซื้อ" })).toHaveValue("OPEN");
    fireEvent.change(select, { target: { value: "OPEN" } });
    expect(select).toHaveValue("OPEN");
    expect(onChange).toHaveBeenCalledOnce();
  });
});
