import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuditLogDTO } from "@/types";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("@/modules/auth", () => ({
  authSession: {
    logout: mocks.logout,
  },
  isDefinitiveSessionFailure: () => false,
}));

vi.mock("./audit-service", () => ({
  auditService: {
    list: mocks.list,
  },
}));

import { AuditView } from "./audit-view";

const audit: AuditLogDTO = {
  auditId: "audit-1",
  organizationId: "org-1",
  actorId: "staff-1",
  action: "PAYMENT_APPROVED",
  resourceType: "PAYMENT",
  resourceId: "payment-1",
  metadata: {
    orderId: "order-1",
    campaignId: "campaign-1",
  },
  createdAt: "2026-09-30T02:00:00.000Z",
};

describe("AuditView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.list.mockResolvedValue({
      items: [audit],
      nextCursor: null,
    });
  });

  it("renders read-only audit rows and Backend-sanitized metadata", async () => {
    render(<AuditView organizationId="org-1" />);

    expect(
      await screen.findByText("PAYMENT_APPROVED"),
    ).toBeInTheDocument();
    expect(screen.getByText("staff-1")).toBeInTheDocument();
    expect(screen.getByText("PAYMENT")).toBeInTheDocument();
    expect(screen.getByText("payment-1")).toBeInTheDocument();
    expect(
      screen.getByText(/"orderId": "order-1"/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/หน้านี้ไม่มี action แก้ไขหรือลบ Audit Log/),
    ).toBeInTheDocument();
  });

  it("submits only documented audit filters after trimming", async () => {
    render(<AuditView organizationId="org-1" />);

    await screen.findByText("PAYMENT_APPROVED");

    fireEvent.change(screen.getByLabelText("Actor ID"), {
      target: { value: "  staff-2  " },
    });
    fireEvent.change(screen.getByLabelText("Action"), {
      target: { value: "  PICKUP_CONFIRMED  " },
    });
    fireEvent.change(screen.getByLabelText("Resource Type"), {
      target: { value: "  PICKUP  " },
    });
    fireEvent.change(screen.getByLabelText("Resource ID"), {
      target: { value: "  pickup-1  " },
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "ค้นหา / กรอง",
      }),
    );

    await waitFor(() => {
      expect(mocks.list).toHaveBeenLastCalledWith(
        "org-1",
        {
          actorId: "staff-2",
          action: "PICKUP_CONFIRMED",
          resourceType: "PICKUP",
          resourceId: "pickup-1",
        },
      );
    });
  });

  it("keeps applied filters while paging with the opaque cursor", async () => {
    mocks.list
      .mockResolvedValueOnce({
        items: [audit],
        nextCursor: "opaque-next",
      })
      .mockResolvedValueOnce({
        items: [
          {
            ...audit,
            auditId: "audit-2",
            resourceId: "payment-2",
          },
        ],
        nextCursor: null,
      });

    render(<AuditView organizationId="org-1" />);

    await screen.findByText("PAYMENT_APPROVED");

    fireEvent.click(
      screen.getByRole("button", { name: "โหลดเพิ่มเติม" }),
    );

    expect(
      await screen.findByText("payment-2"),
    ).toBeInTheDocument();

    expect(mocks.list).toHaveBeenLastCalledWith("org-1", {
      actorId: null,
      action: null,
      resourceType: null,
      resourceId: null,
      cursor: "opaque-next",
    });
  });
});
