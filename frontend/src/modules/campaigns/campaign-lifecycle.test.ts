import { describe, expect, it } from "vitest";

import { lifecycleActionsForStatus } from "./campaign-lifecycle";

describe("campaign lifecycle actions", () => {
  it("exposes only source-defined actions for each status", () => {
    expect(
      lifecycleActionsForStatus("DRAFT").map((item) => item.action),
    ).toEqual(["open", "cancel"]);
    expect(
      lifecycleActionsForStatus("OPEN").map((item) => item.action),
    ).toEqual(["close", "cancel"]);
    expect(
      lifecycleActionsForStatus("CLOSED").map((item) => item.action),
    ).toEqual(["start-production", "cancel"]);
    expect(
      lifecycleActionsForStatus("PRODUCING").map(
        (item) => item.action,
      ),
    ).toEqual(["ready-for-pickup"]);
    expect(
      lifecycleActionsForStatus("READY_FOR_PICKUP").map(
        (item) => item.action,
      ),
    ).toEqual(["complete"]);
    expect(lifecycleActionsForStatus("COMPLETED")).toEqual([]);
    expect(lifecycleActionsForStatus("CANCELLED")).toEqual([]);
  });

  it("never exposes the forbidden OPEN to PRODUCING shortcut", () => {
    expect(
      lifecycleActionsForStatus("OPEN").some(
        (item) => item.action === "start-production",
      ),
    ).toBe(false);
  });
});
