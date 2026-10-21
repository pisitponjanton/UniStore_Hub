import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./button";

describe("Shared button interaction states", () => {
  it("blocks pointer submission and announces pending state without losing button text", () => {
    const onClick = vi.fn();
    render(<Button pending pendingLabel="กำลังดำเนินการ" onClick={onClick}>ยืนยัน</Button>);
    const button = screen.getByRole("button", { name: "กำลังดำเนินการ" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveTextContent("กำลังดำเนินการ");
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("keeps the disabled action's semantic label while preventing click", () => {
    const onClick = vi.fn();
    render(<Button variant="secondary" disabled onClick={onClick}>ยังไม่พร้อม</Button>);
    const button = screen.getByRole("button", { name: "ยังไม่พร้อม" });
    expect(button).toBeDisabled();
    expect(button).not.toHaveAttribute("aria-busy", "true");
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("retains type=button by default and executes only enabled actions", () => {
    const onClick = vi.fn();
    render(<Button variant="quiet" onClick={onClick}>ดูรายละเอียด</Button>);
    const button = screen.getByRole("button", { name: "ดูรายละเอียด" });
    expect(button).toHaveAttribute("type", "button");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });
});
