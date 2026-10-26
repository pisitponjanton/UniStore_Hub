import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ResilientImage } from "./resilient-image";

describe("ResilientImage", () => {
  it("renders a no-photo fallback without an img when the API has no URL", () => {
    render(<ResilientImage src={null} alt="shirt" fallback={<span>ยังไม่มีรูปสินค้า</span>} />);
    expect(screen.getByText("ยังไม่มีรูปสินค้า")).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("replaces a broken signed URL with fallback without affecting surrounding content", () => {
    render(<section><h2>รายละเอียดสินค้า</h2>
      <ResilientImage src="http://localhost:4566/missing.png" alt="shirt"
        fallback={<span>ไม่สามารถแสดงรูปสินค้าได้</span>} />
      <p>ราคา ฿200</p></section>);
    fireEvent.error(screen.getByRole("img", { name: "shirt" }));
    expect(screen.queryByRole("img", { name: "shirt" })).toBeNull();
    expect(screen.getByText("ไม่สามารถแสดงรูปสินค้าได้")).toBeInTheDocument();
    expect(screen.getByText("ราคา ฿200")).toBeInTheDocument();
  });

  it("allows a new signed URL to replace a failed URL", () => {
    const fallback = <span>รูปไม่พร้อม</span>;
    const { rerender } = render(<ResilientImage src="/old.png" alt="picture" fallback={fallback} />);
    fireEvent.error(screen.getByRole("img", { name: "picture" }));
    expect(screen.getByText("รูปไม่พร้อม")).toBeInTheDocument();
    rerender(<ResilientImage src="/new.png" alt="picture" fallback={fallback} />);
    expect(screen.getByRole("img", { name: "picture" })).toHaveAttribute("src", "/new.png");
    expect(screen.queryByText("รูปไม่พร้อม")).toBeNull();
  });
});
