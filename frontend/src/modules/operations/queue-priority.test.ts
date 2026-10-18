import { prioritizeLoadedQueue, visibleLoadedQueue } from "./queue-priority";
import { describe, expect, it } from "vitest";

describe("Staff queue prioritization", () => {
  const records = [
    { id: "done-latest", status: "APPROVED", updatedAt: "2026-10-11T08:00:00Z" },
    { id: "pending-old", status: "PENDING_REVIEW", updatedAt: "2026-10-08T08:00:00Z" },
    { id: "pending-new", status: "PENDING_REVIEW", updatedAt: "2026-10-10T08:00:00Z" },
  ];
  const actionable = (r: (typeof records)[number]) => r.status === "PENDING_REVIEW";

  it("puts reviewable records first while preserving all records and input order", () => {
    const result = prioritizeLoadedQueue(records, actionable, r => r.updatedAt);
    expect(result.map(r => r.id)).toEqual(["pending-new", "pending-old", "done-latest"]);
    expect(records.map(r => r.id)).toEqual(["done-latest", "pending-old", "pending-new"]);
  });

  it("switches locally between all and pending without backend status mutation", () => {
    const sorted = prioritizeLoadedQueue(records, actionable, r => r.updatedAt);
    expect(visibleLoadedQueue(sorted, "all", actionable)).toHaveLength(3);
    expect(visibleLoadedQueue(sorted, "action", actionable).map(r => r.id)).toEqual(["pending-new", "pending-old"]);
    expect(visibleLoadedQueue(sorted, "action", () => false)).toEqual([]);
  });
});
