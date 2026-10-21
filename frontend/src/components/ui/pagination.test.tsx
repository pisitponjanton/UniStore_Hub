import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PaginationControls, usePagination } from "@/components";

function PaginationHarness() {
  const pagination = usePagination(
    Array.from({ length: 23 }, (_, index) => `รายการ ${index + 1}`),
    10,
  );

  return (
    <>
      <ul>
        {pagination.items.map((item) => <li key={item}>{item}</li>)}
      </ul>
      <PaginationControls {...pagination} label="แบ่งหน้าทดสอบ" />
    </>
  );
}

describe("PaginationControls", () => {
  it("shows ranges and moves between pages", () => {
    render(<PaginationHarness />);

    expect(screen.getByText("รายการ 1")).toBeInTheDocument();
    expect(screen.getByText("รายการ 10")).toBeInTheDocument();
    expect(screen.queryByText("รายการ 11")).not.toBeInTheDocument();
    expect(screen.getByText(/แสดง 1–10 จาก 23 รายการ/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "ถัดไป" }));
    expect(screen.getByText("รายการ 11")).toBeInTheDocument();
    expect(screen.getByText("หน้า 2 / 3")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "ถัดไป" }));
    expect(screen.getByText("รายการ 23")).toBeInTheDocument();
    expect(screen.queryByText("รายการ 20")).not.toBeInTheDocument();
  });

  it("hides controls when all results fit on one page", () => {
    render(
      <PaginationControls
        currentPage={1}
        pageSize={10}
        totalItems={8}
        onPageChange={() => undefined}
      />,
    );

    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });
});
