import { describe, expect, it } from "vitest";

import type { StorefrontLandingOrganization } from "./storefront-service";
import {
  buildDirectoryEntries,
  DIRECTORY_PAGE_SIZE,
  filterDirectoryEntries,
  groupDirectoryPage,
} from "./storefront-directory";

const organizations: StorefrontLandingOrganization[] = [
  {
    organization: { organizationId: "org1", name: "คณะวิศวกรรม", description: "", status: "ACTIVE" },
    stores: [
      { storeId: "a", organizationId: "org1", name: "เสื้อกิจกรรม", description: "", status: "ACTIVE" },
      { storeId: "b", organizationId: "org1", name: "ร้านหนังสือ", description: "", status: "ACTIVE" },
    ],
  },
  {
    organization: { organizationId: "org2", name: "IT Club", description: "", status: "ACTIVE" },
    stores: [
      { storeId: "c", organizationId: "org2", name: "Campus Shop", description: "", status: "ACTIVE" },
    ],
  },
  {
    organization: { organizationId: "org3", name: "ชมรมถ่ายภาพ", description: "", status: "ACTIVE" },
    stores: [],
  },
];

describe("public storefront directory", () => {
  it("preserves all active stores and keeps empty organizations reachable", () => {
    const entries = buildDirectoryEntries(organizations);
    expect(entries).toHaveLength(4);
    expect(entries.map((entry) => entry.store?.storeId ?? null)).toEqual(["a", "b", "c", null]);
    expect(filterDirectoryEntries(entries, "", "all")).toHaveLength(4);
    expect(filterDirectoryEntries(entries, "", "with-stores")).toHaveLength(3);
    expect(filterDirectoryEntries(entries, "", "without-stores")).toHaveLength(1);
  });

  it("searches Thai or English names across the entire data set", () => {
    const entries = buildDirectoryEntries(organizations);
    expect(filterDirectoryEntries(entries, "  วิศว  ", "all").map((entry) => entry.store?.storeId))
      .toEqual(["a", "b"]);
    expect(filterDirectoryEntries(entries, "SHOP", "all").map((entry) => entry.store?.storeId))
      .toEqual(["c"]);
    expect(filterDirectoryEntries(entries, "ชมรมถ่ายภาพ", "all")).toHaveLength(1);
    expect(filterDirectoryEntries(entries, "ไม่มีอยู่จริง", "all")).toEqual([]);
    expect(filterDirectoryEntries(entries, "เสื้อ", "without-stores")).toEqual([]);
  });

  it("groups a page without misreporting an organization's total number of stores", () => {
    const page = groupDirectoryPage(buildDirectoryEntries(organizations).slice(0, 1));
    expect(page).toHaveLength(1);
    expect(page[0].stores.map((store) => store.storeId)).toEqual(["a"]);
    expect(page[0].totalStores).toBe(2);
  });

  it("uses a bounded page size for long catalogs", () => {
    const bigData: StorefrontLandingOrganization[] = [{
      organization: organizations[0].organization,
      stores: Array.from({ length: 203 }, (_, index) => ({
        storeId: `store-${index}`, organizationId: "org1",
        name: `ร้านที่ ${index + 1}`, description: "", status: "ACTIVE" as const,
      })),
    }];
    const entries = buildDirectoryEntries(bigData);
    expect(entries).toHaveLength(203);
    expect(entries.slice(0, DIRECTORY_PAGE_SIZE)).toHaveLength(12);
    expect(new Set(entries.map((item) => item.store?.storeId)).size).toBe(203);
    expect(entries.slice(DIRECTORY_PAGE_SIZE * 16)).toHaveLength(11);
    expect(filterDirectoryEntries(entries, "ร้านที่ 203", "with-stores").map((item) => item.store?.storeId))
      .toEqual(["store-202"]);
  });
});
