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
});