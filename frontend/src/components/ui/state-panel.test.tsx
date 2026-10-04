import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BrandIllustration } from "./media";
import {
  EmptyState,
  ErrorState,
  ForbiddenState,
  LoadingState,
  UnauthorizedState,
} from "./state-panel";

describe("shared async and access states", () => {
  it("renders loading as a polite atomic status", () => {
    render(
      <LoadingState
        title="กำลังโหลดรายการ"
        description="โปรดรอสักครู่"
      />,
    );

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveAttribute("aria-atomic", "true");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(
      screen.getByRole("heading", { name: "กำลังโหลดรายการ" }),
    ).toBeInTheDocument();
  });

  it("renders an explicit empty state without generic English chrome", () => {
    render(
      <EmptyState
        title="ยังไม่มีรายการ"
        description="ไม่มีข้อมูลในขณะนี้"
      />,
    );

    expect(
      screen.getByRole("heading", { name: "ยังไม่มีรายการ" }),
    ).toBeInTheDocument();
    expect(screen.getByText("ยังไม่มีข้อมูล")).toBeInTheDocument();
    expect(screen.queryByText("Empty")).not.toBeInTheDocument();
  });

  it("supports optional decorative media without changing empty-state semantics", () => {
    const { container } = render(
      <EmptyState
        title="ไม่มีการแจ้งเตือน"
        media={<BrandIllustration variant="notification" decorative />}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "ไม่มีการแจ้งเตือน" }),
    ).toBeInTheDocument();
    expect(
      container.querySelector('[data-illustration="notification"]'),
    ).toHaveAttribute("aria-hidden", "true");
  });

  it("renders errors with alert semantics and an explicit status label", () => {
    render(
      <ErrorState
        title="โหลดข้อมูลไม่สำเร็จ"
        description="กรุณาลองใหม่"
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "โหลดข้อมูลไม่สำเร็จ",
    );
    expect(screen.getByText("เกิดข้อผิดพลาด")).toBeInTheDocument();
  });

  it("distinguishes unauthorized from forbidden states", () => {
    const { rerender } = render(<UnauthorizedState />);

    expect(
      screen.getByRole("heading", { name: "กรุณาเข้าสู่ระบบ" }),
    ).toBeInTheDocument();
    expect(screen.getByText("ต้องเข้าสู่ระบบ")).toBeInTheDocument();

    rerender(<ForbiddenState />);

    expect(
      screen.getByRole("heading", { name: "ไม่มีสิทธิ์เข้าถึง" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("ไม่มีสิทธิ์เข้าถึง")).toHaveLength(2);
  });
  });

  it("supports an h1 for full-page access states while keeping h2 as the default", () => {
    const { rerender } = render(<UnauthorizedState headingLevel={1} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "กรุณาเข้าสู่ระบบ" }),
    ).toBeInTheDocument();

    rerender(<ForbiddenState />);

    expect(
      screen.getByRole("heading", { level: 2, name: "ไม่มีสิทธิ์เข้าถึง" }),
    ).toBeInTheDocument();
  });
