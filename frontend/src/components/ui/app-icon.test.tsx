import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppIcon } from "./app-icon";
import { BrandIllustration, MediaFallback } from "./media";

describe("Campus Commerce A functional icon system", () => {
  it("renders Lucide arrows as unified decorative vectors, never glyph text", () => {
    const { container } = render(
      <span>
        เปิดหน้าร้าน <AppIcon name="arrow-up-right" size={17} />
      </span>,
    );
    const icon = container.querySelector("svg");
    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(icon).toHaveAttribute("focusable", "false");
    expect(Number(icon?.getAttribute("stroke-width")) * 17 / 24).toBeCloseTo(3, 4);
    expect(icon).toHaveAttribute("width", "17");
    expect(container.textContent).toBe("เปิดหน้าร้าน ");
    expect(container.querySelectorAll("svg")).toHaveLength(1);
  });

  it.each(["market", "parcel", "product", "payment", "pickup", "notification"] as const)(
    "removes former letter or symbol brand art from %s placeholder",
    (variant) => {
      const { container } = render(<BrandIllustration variant={variant} />);
      const illustration = container.querySelector("[data-illustration]");
      expect(illustration).toHaveAttribute("aria-hidden", "true");
      expect(illustration?.querySelector("svg")).toHaveClass("lucide");
      expect(illustration?.textContent).toBe("");
    },
  );

  it("uses a neutral missing-image icon alongside accessible explanatory text", () => {
    const { container } = render(<MediaFallback label="ยังไม่มีภาพสินค้า" />);
    expect(screen.getByText("ยังไม่มีภาพสินค้า")).toBeInTheDocument();
    const image = container.querySelector(".lucide-image-off");
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute("aria-hidden", "true");
  });
});
