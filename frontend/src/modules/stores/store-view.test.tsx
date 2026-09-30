import { fireEvent, render, screen } from "@testing-library/react";
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

  it("loads a fresh StoreDTO before editing and submits only editable text fields", async () => {
    mocks.get.mockResolvedValue(store);
    mocks.update.mockResolvedValue({
      ...store,
      name: "Updated Store",
      description: "Updated description",
    });

    render(<StoreManagementView organizationId="org-1" />);

    await screen.findByText("Main Store");

    fireEvent.click(
      screen.getByRole("button", { name: "แก้ไขข้อมูล" }),
    );

    expect(mocks.get).toHaveBeenCalledWith("org-1", "store-1");

    const editName = await screen.findByDisplayValue("Main Store");
    const editDescription =
      screen.getByDisplayValue("Faculty merchandise");

    fireEvent.change(editName, {
      target: { value: "Updated Store" },
    });
    fireEvent.change(editDescription, {
      target: { value: "Updated description" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "บันทึกข้อมูล" }),
    );

    expect(mocks.update).toHaveBeenCalledWith(
      "org-1",
      "store-1",
      {
        name: "Updated Store",
        description: "Updated description",
      },
    );

    expect(
      await screen.findByText("บันทึกข้อมูลร้านค้า Updated Store แล้ว"),
    ).toBeInTheDocument();
  });
});
