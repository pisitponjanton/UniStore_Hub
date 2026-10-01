import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "./button";
import { Dialog } from "./dialog";

describe("Dialog accessibility", () => {
  it("exposes an accessible dialog name and returns focus to its trigger on close", async () => {
    render(
      <Dialog
        trigger={<Button>เปิดรายละเอียด</Button>}
        title="รายละเอียดคำสั่งซื้อ"
        description="ตรวจสอบข้อมูลก่อนดำเนินการต่อ"
      >
        <Button>การทำงานในหน้าต่าง</Button>
      </Dialog>,
    );

    const trigger = screen.getByRole("button", {
      name: "เปิดรายละเอียด",
    });
    fireEvent.click(trigger);

    expect(
      await screen.findByRole("dialog", {
        name: "รายละเอียดคำสั่งซื้อ",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("ตรวจสอบข้อมูลก่อนดำเนินการต่อ"),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "ปิด",
      }),
    );

    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
  });
});
