import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FileField } from "./fields";

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
    expect(screen.getByText("รองรับ JPEG, PNG หรือ WebP")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "ไฟล์มีขนาดใหญ่เกินไป",
    );
  });
});
