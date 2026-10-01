import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "./button";
import { TextField } from "./fields";
import {
  ActionBar,
  FilterToolbar,
  Notice,
  TaskStatus,
} from "./operational";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "./table";

describe("shared operational UI patterns", () => {
  it("keeps pending actions disabled and exposes busy state", () => {
    render(
      <Button pending pendingLabel="กำลังบันทึก">
        บันทึก
      </Button>,
    );

    const button = screen.getByRole("button", { name: "กำลังบันทึก" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });

  it("links field hint and error messaging to the control", () => {
    render(
      <TextField
        id="name"
        label="ชื่อ"
        hint="ใช้ชื่อที่มองเห็นได้"
        error="กรุณาระบุชื่อ"
      />,
    );

    const input = screen.getByLabelText("ชื่อ");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute(
      "aria-describedby",
      "name-hint name-error",
    );
  });

  it("renders a compact filter area without making actions part of the filter fields", () => {
    render(
      <FilterToolbar
        title="กรองคำสั่งซื้อ"
        summary="2 ตัวกรอง"
        actions={<Button variant="secondary">ล้างตัวกรอง</Button>}
      >
        <TextField id="search" label="ค้นหา" />
      </FilterToolbar>,
    );

    expect(
      screen.getByRole("region", { name: "ตัวกรองรายการ" }),
    ).toHaveTextContent("กรองคำสั่งซื้อ");
    expect(screen.getByRole("button", { name: "ล้างตัวกรอง" })).toBeInTheDocument();
  });

  it("renders notice and task status with text that does not rely on color", () => {
    render(
      <>
        <Notice tone="warning" title="ต้องตรวจสอบ">
          กรุณาตรวจสอบข้อมูลก่อนดำเนินการ
        </Notice>
        <TaskStatus
          tone="success"
          label="สถานะปัจจุบัน"
          title="พร้อมรับสินค้า"
          description="ลูกค้าสามารถมารับสินค้าได้"
          actions={<Button>ยืนยันการรับสินค้า</Button>}
        />
      </>,
    );

    expect(screen.getByText("ต้องตรวจสอบ")).toBeInTheDocument();
    expect(screen.getByText("พร้อมรับสินค้า")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "ยืนยันการรับสินค้า" }),
    ).toBeInTheDocument();
  });

  it("marks selected operational table rows semantically", () => {
    render(
      <Table>
        <TableBody>
          <TableRow selected>
            <TableCell>ORDER-001</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(screen.getByRole("row")).toHaveAttribute("aria-selected", "true");
  });

  it("keeps ActionBar as layout without inventing toolbar keyboard semantics", () => {
    render(
      <ActionBar>
        <Button>ดำเนินการ</Button>
      </ActionBar>,
    );

    expect(screen.queryByRole("toolbar")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ดำเนินการ" })).toBeInTheDocument();
  });
});
