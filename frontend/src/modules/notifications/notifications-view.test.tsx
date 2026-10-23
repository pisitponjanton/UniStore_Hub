import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { NotificationDTO } from "@/types";

const mocks = vi.hoisted(() => ({
  listNotifications: vi.fn(),
  markRead: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("@/modules/auth", () => ({
  authSession: {
    logout: mocks.logout,
  },
  isDefinitiveSessionFailure: () => false,
}));

vi.mock("./notification-service", async () => {
  const actual = await vi.importActual<
    typeof import("./notification-service")
  >("./notification-service");

  return {
    ...actual,
    notificationService: {
      listNotifications: mocks.listNotifications,
      markRead: mocks.markRead,
    },
  };
});

import { NotificationsView } from "./notifications-view";

function makeNotification(
  overrides: Partial<NotificationDTO> = {},
): NotificationDTO {
  return {
    notificationId: "notification-1",
    userId: "user-1",
    type: "PAYMENT_REJECTED",
    title: "การชำระเงินถูกปฏิเสธ",
    message: "กรุณาตรวจสอบรายการชำระเงิน",
    resourceType: "PAYMENT",
    resourceId: "payment-1",
    readAt: null,
    createdAt: "2026-09-29T12:00:00.000Z",
    ...overrides,
  };
}

describe("NotificationsView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a compact shared illustration without duplicated empty-state chrome", async () => {
    mocks.listNotifications.mockResolvedValue({ items: [], nextCursor: null });

    render(<NotificationsView />);

    expect(
      await screen.findByRole("heading", { name: "ไม่มีการแจ้งเตือน" }),
    ).toBeInTheDocument();
    expect(document.querySelector('[data-empty-artwork]')).toHaveAttribute(
      "src",
      "/images/empty.png",
    );
    expect(screen.queryByText("ยังไม่มีข้อมูล")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "รีเฟรชรายการ" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ยังไม่อ่าน" })).toBeInTheDocument();
  });

  it("renders unread presentation and updates the item after mark-read", async () => {
    const notification = makeNotification();
    const updated = {
      ...notification,
      readAt: "2026-09-29T13:00:00.000Z",
    };

    mocks.listNotifications.mockResolvedValue({
      items: [notification],
      nextCursor: null,
    });
    mocks.markRead.mockResolvedValue(updated);

    render(<NotificationsView />);

    expect(
      await screen.findByText("การชำระเงินถูกปฏิเสธ"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("ยังไม่อ่าน").length).toBeGreaterThan(0);

    fireEvent.click(
      screen.getByRole("button", {
        name: "ทำเครื่องหมายว่าอ่านแล้ว",
      }),
    );

    expect(
      await screen.findByText("อ่านแล้ว", { exact: false }),
    ).toBeInTheDocument();
    expect(mocks.markRead).toHaveBeenCalledWith("notification-1");
  });

  it("switches to unread filter and removes an item after marking it read", async () => {
    const notification = makeNotification();

    mocks.listNotifications.mockResolvedValue({
      items: [notification],
      nextCursor: null,
    });
    mocks.markRead.mockResolvedValue({
      ...notification,
      readAt: "2026-09-29T13:00:00.000Z",
    });

    render(<NotificationsView />);

    await screen.findByText("การชำระเงินถูกปฏิเสธ");

    fireEvent.click(
      screen.getByRole("button", { name: "ยังไม่อ่าน" }),
    );

    expect(mocks.listNotifications).toHaveBeenLastCalledWith(
      expect.objectContaining({
        filter: "unread",
        signal: expect.any(AbortSignal),
      }),
    );

    await screen.findByText("การชำระเงินถูกปฏิเสธ");

    fireEvent.click(
      screen.getByRole("button", {
        name: "ทำเครื่องหมายว่าอ่านแล้ว",
      }),
    );

    expect(
      await screen.findByText("ไม่มีการแจ้งเตือน"),
    ).toBeInTheDocument();
  });

  it("keeps the inbox shell and visible content stable while switching filters", async () => {
    const unread = makeNotification();
    let resolveRead!: (value: { items: NotificationDTO[]; nextCursor: null }) => void;
    const readResponse = new Promise<{ items: NotificationDTO[]; nextCursor: null }>((resolve) => {
      resolveRead = resolve;
    });
    mocks.listNotifications.mockImplementation(({ filter }: { filter: string }) =>
      filter === "read" ? readResponse : Promise.resolve({ items: [unread], nextCursor: null }),
    );

    render(<NotificationsView />);
    await screen.findByText("การชำระเงินถูกปฏิเสธ");

    fireEvent.click(screen.getByRole("button", { name: /^อ่านแล้ว$/ }));
    expect(screen.getByRole("button", { name: /^อ่านแล้ว$/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("การชำระเงินถูกปฏิเสธ")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "เส้นทางผู้ซื้อ" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "กำลังโหลดการแจ้งเตือน" })).not.toBeInTheDocument();
    expect(screen.getByText("กำลังอัปเดตรายการตามตัวกรอง...")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "รายการการแจ้งเตือน" })).toHaveAttribute("aria-busy", "true");

    resolveRead({ items: [], nextCursor: null });
    expect(await screen.findByRole("heading", { name: "ไม่มีการแจ้งเตือน" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "เส้นทางผู้ซื้อ" })).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "กรองการแจ้งเตือน" })).toBeInTheDocument();
    expect(screen.queryByText("กำลังอัปเดตรายการตามตัวกรอง...")).not.toBeInTheDocument();
  });

  it("does not apply a stale filter response after switching again", async () => {
    const notification = makeNotification();
    let resolveRead!: (value: { items: NotificationDTO[]; nextCursor: null }) => void;
    mocks.listNotifications.mockImplementation(({ filter }: { filter: string }) =>
      filter === "read"
        ? new Promise(resolve => { resolveRead = resolve; })
        : Promise.resolve({ items: [notification], nextCursor: null }),
    );
    render(<NotificationsView />);
    await screen.findByText(notification.title);

    fireEvent.click(screen.getByRole("button", { name: /^อ่านแล้ว$/ }));
    fireEvent.click(screen.getByRole("button", { name: /^ทั้งหมด$/ }));
    resolveRead({ items: [], nextCursor: null });

    expect(await screen.findByText(notification.title)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^ทั้งหมด$/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("heading", { name: "ไม่มีการแจ้งเตือน" })).not.toBeInTheDocument();
  });

  it("loads the next page with the opaque cursor", async () => {
    const first = makeNotification();
    const second = makeNotification({
      notificationId: "notification-2",
      title: "พร้อมรับสินค้า",
      type: "READY_FOR_PICKUP",
      message: "คำสั่งซื้อพร้อมรับแล้ว",
    });

    mocks.listNotifications
      .mockResolvedValueOnce({
        items: [first],
        nextCursor: "opaque-next",
      })
      .mockResolvedValueOnce({
        items: [second],
        nextCursor: null,
      });

    render(<NotificationsView />);

    await screen.findByText("การชำระเงินถูกปฏิเสธ");

    fireEvent.click(
      screen.getByRole("button", { name: "โหลดเพิ่มเติม" }),
    );

    expect(
      await screen.findByRole("heading", { name: "พร้อมรับสินค้า" }),
    ).toBeInTheDocument();
    expect(mocks.listNotifications).toHaveBeenLastCalledWith({
      filter: "all",
      cursor: "opaque-next",
    });
  });

  it("refreshes the current filter without changing pagination semantics", async () => {
    const first = makeNotification();
    const refreshed = makeNotification({
      notificationId: "notification-2",
      title: "ชำระเงินผ่านแล้ว",
      type: "PAYMENT_APPROVED",
      message: "การชำระเงินได้รับการอนุมัติ",
    });

    mocks.listNotifications
      .mockResolvedValueOnce({
        items: [first],
        nextCursor: null,
      })
      .mockResolvedValueOnce({
        items: [refreshed],
        nextCursor: null,
      });

    render(<NotificationsView />);

    await screen.findByText("การชำระเงินถูกปฏิเสธ");
    fireEvent.click(screen.getByRole("button", { name: "รีเฟรชรายการ" }));

    expect(await screen.findByText("ชำระเงินผ่านแล้ว")).toBeInTheDocument();
    expect(mocks.listNotifications).toHaveBeenLastCalledWith({
      filter: "all",
    });
    expect(
      await screen.findByText(
        "อัปเดตรายการแจ้งเตือนล่าสุดแล้ว ตอนนี้แสดง 1 รายการ",
      ),
    ).toBeInTheDocument();
  });
  it("links only ORDER resources to the authoritative next customer step", async () => {
    mocks.listNotifications.mockResolvedValue({
      items: [
        makeNotification({ notificationId: "n-rejected", resourceType: "ORDER", resourceId: "o-1" }),
        makeNotification({ notificationId: "n-pickup", title: "สินค้าพร้อมรับ", type: "READY_FOR_PICKUP", resourceType: "ORDER", resourceId: "o-2" }),
        makeNotification({ notificationId: "n-approved", title: "จ่ายเงินผ่าน", type: "PAYMENT_APPROVED", resourceType: "ORDER", resourceId: "o-3" }),
        makeNotification({ notificationId: "n-no-id", title: "ไม่ได้ผูกคำสั่งซื้อ", type: "PAYMENT_REJECTED", resourceType: "PAYMENT", resourceId: "payment-4" }),
      ], nextCursor: null,
    });
    render(<NotificationsView />);
    await screen.findByText("สินค้าพร้อมรับ");
    expect(screen.getByRole("link", { name: "ตรวจสอบและส่งหลักฐานใหม่" })).toHaveAttribute("href", "/my/payment?orderId=o-1");
    expect(screen.getByRole("link", { name: "เปิดข้อมูลรับสินค้า" })).toHaveAttribute("href", "/my/pickup?orderId=o-2");
    expect(screen.getByRole("link", { name: "ดูสถานะคำสั่งซื้อ" })).toHaveAttribute("href", "/my/order?orderId=o-3");
    expect(screen.getByRole("region", { name: "รายการการแจ้งเตือน" }).querySelectorAll("a[href]")).toHaveLength(3);
  });

});