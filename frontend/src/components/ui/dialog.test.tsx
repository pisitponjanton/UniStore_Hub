import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./button";
import { ConfirmDialog, Dialog } from "./dialog";

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
    ).toHaveAttribute("aria-modal", "true");
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
  it("requires a deliberate confirmation and restores focus after Cancel", async () => {
    const confirm = vi.fn();
    render(
      <ConfirmDialog
        trigger={<Button>ระงับหน่วยงาน</Button>}
        title="ยืนยันระงับหน่วยงาน"
        description="สถานะหน่วยงานจะถูกเปลี่ยนหลังยืนยัน"
        danger
        onConfirm={confirm}
      />,
    );

    const trigger = screen.getByRole("button", { name: "ระงับหน่วยงาน" });
    fireEvent.click(trigger);
    expect(await screen.findByRole("dialog", { name: "ยืนยันระงับหน่วยงาน" })).toHaveAttribute("aria-modal", "true");
    fireEvent.click(screen.getByRole("button", { name: "ยกเลิก" }));
    expect(confirm).not.toHaveBeenCalled();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("prevents re-submission and Cancel while a confirmation is pending", async () => {
    const confirm = vi.fn();
    render(
      <ConfirmDialog
        trigger={<Button>ตรวจสอบการชำระเงิน</Button>}
        title="ยืนยันผล"
        description="ตรวจสอบหลักฐานอีกครั้ง"
        pending
        onConfirm={confirm}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "ตรวจสอบการชำระเงิน" }));
    expect(await screen.findByRole("dialog", { name: "ยืนยันผล" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ยกเลิก" })).toBeDisabled();
    const submit = screen.getByRole("button", { name: "กำลังดำเนินการ" });
    expect(submit).toBeDisabled();
    fireEvent.click(submit);
    expect(confirm).not.toHaveBeenCalled();
  });

});
