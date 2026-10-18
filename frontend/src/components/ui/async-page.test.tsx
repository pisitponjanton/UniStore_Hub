import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AsyncPageFallback, PageStateHeading, PageLoadingRows } from "./async-page";

describe("Phase 1 shared async page accessibility", () => {
  it("preserves H1 and a decorative skeleton while loading", () => {
    render(
      <AsyncPageFallback
        status="loading"
        pageTitle="ตรวจสอบการชำระเงิน"
        loadingTitle="กำลังโหลดรายการ"
        backHref="/org/select/"
      />,
    );
    expect(screen.getByRole("heading", { level: 1, name: "ตรวจสอบการชำระเงิน" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByTestId("page-loading-skeleton")).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("button", { name: "ลองใหม่" })).not.toBeInTheDocument();
  });

  it("exposes retry and safe navigation without losing the route identity on 503", () => {
    render(<AsyncPageFallback status="error" pageTitle="จัดการหน่วยงาน" errorTitle="ไม่สามารถโหลดหน่วยงานได้" backHref="/platform/summary/" />);
    expect(screen.getByRole("heading", { level: 1, name: "จัดการหน่วยงาน" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("ไม่สามารถโหลดหน่วยงานได้");
    expect(screen.getByRole("button", { name: "ลองใหม่" })).toHaveAttribute("type", "button");
    expect(screen.getByRole("link", { name: "กลับไปหน้าก่อนหน้า" })).toHaveAttribute("href", "/platform/summary/");
  });

  it("makes unauthorized and forbidden recovery routes explicit", () => {
    const { rerender } = render(<AsyncPageFallback status="unauthorized" pageTitle="รายการรับสินค้า" backHref="/org/select/" />);
    expect(screen.getByRole("link", { name: "เข้าสู่ระบบ" })).toHaveAttribute("href", "/login/");
    rerender(<AsyncPageFallback status="forbidden" pageTitle="รายการรับสินค้า" backHref="/org/select/" />);
    expect(screen.getByRole("link", { name: "กลับไปหน้าก่อนหน้า" })).toHaveAttribute("href", "/org/select/");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("รายการรับสินค้า");
  });

  it("renders a single H1 when the route uses its own conditional states", () => {
    render(<><PageStateHeading title="รายละเอียดสินค้า" /><PageLoadingRows /></>);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByTestId("page-loading-skeleton")).toHaveAttribute("aria-hidden", "true");
  });
});
