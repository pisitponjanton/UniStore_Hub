import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  BrandIllustration,
  MediaFallback,
  MediaShell,
  Skeleton,
} from "./media";

describe("shared media primitives", () => {
  it("keeps informative media visible to assistive technology by default", () => {
    render(
      <MediaShell tone="warm" fit="contain" aspectRatio="4 / 3">
        <span role="img" aria-label="ตัวอย่างสินค้า" />
      </MediaShell>,
    );

    const image = screen.getByRole("img", { name: "ตัวอย่างสินค้า" });
    expect(image).toBeInTheDocument();
    expect(image.parentElement).not.toHaveAttribute("aria-hidden");
    expect(image.parentElement).toHaveAttribute("data-fit", "contain");
    expect(image.parentElement).toHaveStyle({ aspectRatio: "4 / 3" });
  });

  it("can explicitly mark decorative media as hidden", () => {
    const { container } = render(
      <MediaShell decorative>
        <span>ของตกแต่ง</span>
      </MediaShell>,
    );

    expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
  });

  it("keeps brand illustrations decorative by default", () => {
    const { container } = render(
      <BrandIllustration variant="parcel" />,
    );

    expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
    expect(container.firstChild).toHaveAttribute(
      "data-illustration",
      "parcel",
    );
  });

  it("supports an informative illustration only when a label is provided", () => {
    render(
      <BrandIllustration
        variant="pickup"
        decorative={false}
        label="ภาพประกอบจุดรับสินค้า"
      />,
    );

    expect(
      screen.getByRole("img", { name: "ภาพประกอบจุดรับสินค้า" }),
    ).toHaveAttribute("data-illustration", "pickup");
  });

  it("pairs generic fallback art with visible no-image copy", () => {
    render(
      <MediaFallback
        variant="product"
        label="ยังไม่มีรูปสินค้า"
      />,
    );

    expect(screen.getByText("ยังไม่มีรูปสินค้า")).toBeInTheDocument();
    expect(
      screen.getByText("ยังไม่มีรูปสินค้า").previousElementSibling,
    ).toHaveAttribute("aria-hidden", "true");
  });

  it("keeps skeleton visuals out of the accessibility tree", () => {
    const { container } = render(<Skeleton shape="block" />);

    expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
  });
});
