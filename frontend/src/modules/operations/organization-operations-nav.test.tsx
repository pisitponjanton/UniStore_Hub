import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OrganizationOperationsNav } from "./organization-operations-nav";

describe("OrganizationOperationsNav", () => {
  it("preserves organization context and marks the active production view", () => {
    render(<OrganizationOperationsNav organizationId="org /?#1" current="production" />);
    const nav = screen.getByRole("navigation", { name: "ข้อมูลการดำเนินงานหน่วยงาน" });
    expect(nav.querySelector('[aria-current="page"]')).toHaveTextContent("สรุปงานผลิต");
    expect(screen.queryByRole("link", { name: "สรุปงานผลิต" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ประวัติรายการ" }))
      .toHaveAttribute("href", "/org/audit?organizationId=org+%2F%3F%231");
    expect(screen.getByRole("link", { name: "กลับไปรอบขาย" }))
      .toHaveAttribute("href", "/org/campaigns?organizationId=org+%2F%3F%231");
  });

  it("returns from history to an authorized production summary without guessing a campaign", () => {
    render(<OrganizationOperationsNav organizationId="my-org" current="audit" />);
    expect(screen.getByRole("link", { name: "สรุปงานผลิต" }))
      .toHaveAttribute("href", "/org/production?organizationId=my-org");
    expect(screen.queryByRole("link", { name: "ประวัติรายการ" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "ส่งออก" })).not.toBeInTheDocument();
  });
});
