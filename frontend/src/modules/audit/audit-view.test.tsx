import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditLogDTO } from "@/types";

const mocks = vi.hoisted(() => ({ list: vi.fn(), logout: vi.fn() }));
vi.mock("@/modules/auth", () => ({
  authSession: { logout: mocks.logout },
  isDefinitiveSessionFailure: () => false,
}));
vi.mock("./audit-service", () => ({ auditService: { list: mocks.list } }));
import { AuditView } from "./audit-view";

const audit: AuditLogDTO = {
  auditId: "audit-1", organizationId: "org-1",
  actorId: "staff-1", action: "PAYMENT_APPROVED",
  resourceType: "PAYMENT", resourceId: "payment-1",
  metadata: { orderId: "order-1", campaignId: "campaign-1" },
  createdAt: "2026-09-30T02:00:00.000Z",
};

describe("AuditView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.list.mockResolvedValue({ items: [audit], nextCursor: null });
  });

  it("renders compact read-only activity rows and full metadata inside a detail popup", async () => {
    render(<AuditView organizationId="org-1" />);
    const title = await screen.findByRole("heading", { name: "อนุมัติการชำระเงิน" });
    expect(title).toBeInTheDocument();
    expect(screen.getByText("PAYMENT")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByText("payment-1")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /ดูรายละเอียด PAYMENT_APPROVED audit-1/ }));
    const detail = screen.getByRole("dialog", { name: "รายละเอียดเหตุการณ์" });
    expect(within(detail).getByText("payment-1")).toBeInTheDocument();
    expect(within(detail).getByText("PAYMENT_APPROVED")).toBeInTheDocument();
    expect(within(detail).getByText(/"orderId": "order-1"/)).toBeInTheDocument();
    expect(within(detail).getByRole("button", { name: "คัดลอก Actor ID" })).toBeInTheDocument();
    fireEvent.click(within(detail).getAllByRole("button", { name: "ปิด" })[0]);
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "รายละเอียดเหตุการณ์" })).not.toBeInTheDocument());
  });

  it("submits only documented audit filters after trimming through filter popup", async () => {
    render(<AuditView organizationId="org-1" />);
    await screen.findByRole("heading", { name: "อนุมัติการชำระเงิน" });
    fireEvent.click(screen.getByRole("button", { name: "ตัวกรอง" }));
    const dialog = screen.getByRole("dialog", { name: "ตัวกรองเหตุการณ์" });
    fireEvent.change(within(dialog).getByLabelText("ผู้ดำเนินการ (Actor ID)"), { target: { value: "  staff-2  " } });
    fireEvent.change(within(dialog).getByLabelText("การทำรายการ (Action)"), { target: { value: "  PICKUP_CONFIRMED  " } });
    fireEvent.change(within(dialog).getByLabelText("ประเภทข้อมูล (Resource Type)"), { target: { value: "  PICKUP  " } });
    fireEvent.change(within(dialog).getByLabelText("รหัสรายการ (Resource ID)"), { target: { value: "  pickup-1  " } });
    fireEvent.click(within(dialog).getByRole("button", { name: "ค้นหา / กรอง" }));
    await waitFor(() => {
      expect(mocks.list).toHaveBeenLastCalledWith("org-1", {
        actorId: "staff-2", action: "PICKUP_CONFIRMED",
        resourceType: "PICKUP", resourceId: "pickup-1",
      });
    });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "ตัวกรองเหตุการณ์" })).not.toBeInTheDocument());
    expect(screen.getByRole("status")).toHaveTextContent("แสดง 1 เหตุการณ์ตามตัวกรอง");
    expect(screen.getByRole("group", { name: "ตัวกรองที่ใช้อยู่" })).toBeInTheDocument();
  });

  it("shows only ten activities on each numbered page and preserves earlier pages", async () => {
    const records = Array.from({ length: 25 }, (_, index) => ({
      ...audit, auditId: `audit-${index + 1}`, resourceId: `payment-${index + 1}`,
    }));
    mocks.list.mockResolvedValueOnce({ items: records, nextCursor: null });
    render(<AuditView organizationId="org-1" />);
    await screen.findByRole("list", { name: "รายการ Audit Log ของหน่วยงาน" });
    const list = screen.getByRole("list", { name: "รายการ Audit Log ของหน่วยงาน" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(10);
    expect(within(list).getByRole("button", { name: "ดูรายละเอียด PAYMENT_APPROVED audit-1" })).toBeVisible();
    expect(within(list).queryByRole("button", { name: "ดูรายละเอียด PAYMENT_APPROVED audit-11" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "หน้า 1" })).toHaveAttribute("aria-current", "page");

    fireEvent.click(screen.getByRole("button", { name: "หน้า 2" }));
    expect(within(list).getAllByRole("listitem")).toHaveLength(10);
    expect(within(list).getByRole("button", { name: "ดูรายละเอียด PAYMENT_APPROVED audit-11" })).toBeVisible();
    expect(within(list).queryByRole("button", { name: "ดูรายละเอียด PAYMENT_APPROVED audit-1" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "ถัดไป" }));
    expect(within(list).getAllByRole("listitem")).toHaveLength(5);
    expect(within(list).getByRole("button", { name: "ดูรายละเอียด PAYMENT_APPROVED audit-25" })).toBeVisible();
    expect(screen.getByRole("button", { name: "ถัดไป" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "ก่อนหน้า" }));
    expect(within(list).getAllByRole("listitem")).toHaveLength(10);
    expect(screen.getByRole("button", { name: "หน้า 2" })).toHaveAttribute("aria-current", "page");
  });

  it("fetches an opaque cursor when next numbered page needs more than cached records", async () => {
    const initial = Array.from({ length: 24 }, (_, index) => ({
      ...audit, auditId: `audit-${index + 1}`, resourceId: `payment-${index + 1}`,
    }));
    const next = Array.from({ length: 15 }, (_, index) => ({
      ...audit, auditId: `audit-${index + 25}`, resourceId: `payment-${index + 25}`,
    }));
    mocks.list
      .mockResolvedValueOnce({ items: initial, nextCursor: "opaque-next" })
      .mockResolvedValueOnce({ items: next, nextCursor: null });
    render(<AuditView organizationId="org-1" />);
    await screen.findByRole("list", { name: "รายการ Audit Log ของหน่วยงาน" });
    const list = screen.getByRole("list", { name: "รายการ Audit Log ของหน่วยงาน" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(10);
    fireEvent.click(screen.getByRole("button", { name: "หน้า 2" }));
    expect(within(list).getAllByRole("listitem")).toHaveLength(10);
    expect(mocks.list).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "หน้า 3" }));
    await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith("org-1", {
      actorId: null, action: null, resourceType: null, resourceId: null, cursor: "opaque-next",
    }));
    await waitFor(() => expect(within(list).getAllByRole("listitem")).toHaveLength(10));
    expect(within(list).getByRole("button", { name: "ดูรายละเอียด PAYMENT_APPROVED audit-30" })).toBeVisible();
    expect(within(list).queryByRole("button", { name: "ดูรายละเอียด PAYMENT_APPROVED audit-1" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "หน้า 1" }));
    expect(within(list).getByRole("button", { name: "ดูรายละเอียด PAYMENT_APPROVED audit-1" })).toBeVisible();
    expect(mocks.list).toHaveBeenCalledTimes(2);
  });

  it("preserves the current page when fetching the next cursor fails and allows a retry", async () => {
    const initial = Array.from({ length: 10 }, (_, index) => ({
      ...audit, auditId: `audit-${index + 1}`, resourceId: `payment-${index + 1}`,
    }));
    mocks.list.mockResolvedValueOnce({ items: initial, nextCursor: "cursor-retry" })
      .mockRejectedValueOnce(new Error("Temporary error"))
      .mockResolvedValueOnce({ items: [{ ...audit, auditId: "audit-11" }], nextCursor: null });
    render(<AuditView organizationId="org-1" />);
    await screen.findByRole("list", { name: "รายการ Audit Log ของหน่วยงาน" });
    const list = screen.getByRole("list", { name: "รายการ Audit Log ของหน่วยงาน" });
    fireEvent.click(screen.getByRole("button", { name: "ถัดไป" }));
    await screen.findByRole("alert");
    expect(screen.getByRole("button", { name: "หน้า 1" })).toHaveAttribute("aria-current", "page");
    expect(within(list).getAllByRole("listitem")).toHaveLength(10);
    fireEvent.click(screen.getByRole("button", { name: "ถัดไป" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "หน้า 2" })).toHaveAttribute("aria-current", "page"));
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
    expect(mocks.list).toHaveBeenCalledTimes(3);
  });

});
