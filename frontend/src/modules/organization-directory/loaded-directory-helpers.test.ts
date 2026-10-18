import { describe, expect, it } from "vitest";
import { searchLoadedItems, visibleLoadedItems } from "./loaded-directory-helpers";

type Row = { id: string; name: string; email?: string };

describe("Local loaded directory search", () => {
  const rows: Row[] = Array.from({ length: 145 }, (_, i) => ({
    id: "org-" + i,
    name: i === 144 ? "Final Campus Club" : "Campus Club " + i,
    email: i === 144 ? "final@kmitl.ac.th" : "member" + i + "@kmitl.ac.th",
  }));
  it("finds the last member beyond the first visible page without trimming API data", () => {
    const results = searchLoadedItems(rows, " FINAL campus ", row => [row.name, row.id, row.email]);
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe("org-144");
    expect(visibleLoadedItems(rows, 24)).toHaveLength(24);
    expect(rows).toHaveLength(145);
  });
  it("matches multiple words in any tokens; matching is case insensitive", () => {
    expect(searchLoadedItems(rows, "FINAL kmitl", row => [row.name, row.id, row.email])).toHaveLength(1);
    expect(searchLoadedItems(rows, "never-present", row => [row.name, row.id])).toEqual([]);
  });
  it("keeps original API ordering and does not mutate input", () => {
    const found = searchLoadedItems(rows, "", row => [row.name]);
    expect(found.map(row => row.id)).toEqual(rows.map(row => row.id));
    expect(found).not.toBe(rows);
    expect(visibleLoadedItems(rows, -1)).toEqual([]);
  });
});
