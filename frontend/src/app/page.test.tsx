import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/modules/storefront", () => ({
  StorefrontLanding: () => <h1>UniStore Hub</h1>,
}));

import HomePage from "./page";

describe("HomePage", () => {
  it("composes the public storefront landing", () => {
    render(<HomePage />);

    expect(
      screen.getByRole("heading", { name: "UniStore Hub" }),
    ).toBeInTheDocument();
  });
});
