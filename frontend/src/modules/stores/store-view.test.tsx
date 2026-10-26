import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { StoreDTO } from "@/types";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  get: vi.fn(),
  update: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("@/modules/auth", () => ({
  authSession: {
    logout: mocks.logout,
  },
  isDefinitiveSessionFailure: () => false,
}));

vi.mock("./store-service", () => ({
  storeService: {
    list: mocks.list,
    create: mocks.create,
    get: mocks.get,
    update: mocks.update,
  },
}));

import { StoreManagementView } from "./store-view";

const store: StoreDTO = {
  storeId: "store-1",
  organizationId: "org-1",
  name: "Main Store",
  description: "Faculty merchandise",
  status: "ACTIVE",
  createdAt: "2026-09-29T10:00:00.000Z",
  updatedAt: "2026-09-29T10:00:00.000Z",
};

describe("StoreManagementView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.list.mockResolvedValue([store]);
  });

  it("creates a store with normalized name and description", async () => {
    mocks.create.mockResolvedValue({
      ...store,
      storeId: "store-2",
      name: "Second Store",
      description: "Second floor",
    });

    render(<StoreManagementView organizationId="org-1" />);

    await screen.findByText("Main Store");
    fireEvent.click(screen.getByRole("button", { name: "+ สร้างร้านค้า" }));

    fireEvent.change(screen.getByLabelText(/ชื่อร้านค้า/), {
      target: { value: "  Second Store  " },
    });
    fireEvent.change(screen.getByLabelText(/คำอธิบาย/), {
      target: { value: "  Second floor  " },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "สร้างร้านค้า" }),
    );

    expect(mocks.create).toHaveBeenCalledWith("org-1", {
      name: "Second Store",
      description: "Second floor",
    });
    expect(
      await screen.findByText("สร้างร้านค้า Second Store แล้ว"),
    ).toBeInTheDocument();
  });

  it("shows uploaded store covers and a fallback for stores without one", async () => {
    mocks.list.mockResolvedValue([
      { ...store, imageUrl: "/test-store-cover.png" },
      { ...store, storeId: "store-2", name: "Without Cover", imageUrl: null },
    ]);
    render(<StoreManagementView organizationId="org-1" />);
    await screen.findByText("Without Cover");
    expect(screen.getByRole("img", { name: "รูปหน้าร้าน Main Store" }))
      .toHaveAttribute("src", "/test-store-cover.png");
    expect(screen.getByText("ยังไม่มีรูปหน้าร้าน")).toBeInTheDocument();
  });

  it("uses the store workspace as the single editing location", async () => {
    render(<StoreManagementView organizationId="org-1" />);
    await screen.findByText("Main Store");
    expect(screen.queryByRole("button", { name: "แก้ไขข้อมูล" })).toBeNull();
    expect(screen.queryByRole("button", { name: "ปิดใช้งาน" })).toBeNull();
    const manage = screen.getByRole("link", { name: "จัดการร้านค้า" });
    expect(manage.getAttribute("href")).toContain("storeId=store-1");
    expect(mocks.get).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("focuses a validation summary when a store is submitted without a name", async () => {
    render(<StoreManagementView organizationId="org-1" />);

    await screen.findByText("Main Store");
    fireEvent.click(screen.getByRole("button", { name: "+ สร้างร้านค้า" }));

    fireEvent.click(
      screen.getByRole("button", { name: "สร้างร้านค้า" }),
    );

    const summary = await screen.findByRole("alert");
    expect(
      screen.getByRole("link", { name: "กรุณาระบุชื่อร้านค้า" }),
    ).toHaveAttribute("href", "#store-create-name");
    await waitFor(() => expect(summary).toHaveFocus());
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
