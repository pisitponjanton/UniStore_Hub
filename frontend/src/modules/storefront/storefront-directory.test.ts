import { describe, expect, it } from "vitest";

import type { StorefrontLandingOrganization } from "./storefront-service";
import {
  buildDirectoryEntries,
  DIRECTORY_PAGE_SIZE,
  filterDirectoryEntries,
  isRecognizedQaOrganization,
  separateAutomationFixtures,
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
  it("recognizes only exact seed IDs or verified test-generator name+description pairs", () => {
    const fixture = (name: string, description: string, organizationId = "normal-id"): StorefrontLandingOrganization => ({
      organization: { organizationId, name, description, status: "ACTIVE" },
      stores: [],
    });
    const recognized = [
      fixture("UniStore Local Demo", "Deterministic local/demo organization", "55555555-5555-4555-8555-555555555555"),
      fixture("E2E Organization harness-phase5-1790760715", "Disposable E2E core-flow organization"),
      fixture("Tenant Org B harness-phase5-rerun-1790760796", "Disposable tenant B"),
      fixture("QA Commerce Org staff-normal-1791136125571-3", "Disposable frontend Customer commerce fixture"),
      fixture("QA Admin Org settings-1791183981422-0 Updated", "Updated by Organization Admin browser journey"),
      fixture("Golden Org golden-1791186729518-0", "Disposable cross-role golden journey Organization"),
    ];
    for (const org of recognized) expect(isRecognizedQaOrganization(org)).toBe(true);
    const lookalikes = [
      fixture("UniStore Local Demo", "A legitimate shop called UniStore Local Demo"),
      fixture("E2E Organization harness-phase5-1790760715", "Real university exchange organization"),
      fixture("QA Commerce Org staff-normal-1791136125571-3", "Ordinary customer"),
      fixture("QA Commerce Org bookstore", "Disposable frontend Customer commerce fixture"),
      fixture("QA Admin Org settings-1791183981422-0 Updated", "Legitimate club"),
      fixture("IT Club", "Disposable frontend Customer commerce fixture"),
      fixture("Tenant Org B", "Disposable tenant B"),
      fixture("Super Demo Store", "Real campus shopping"),
    ];
    for (const org of lookalikes) expect(isRecognizedQaOrganization(org)).toBe(false);
    const partition = separateAutomationFixtures([...organizations, ...recognized, ...lookalikes]);
    expect(partition.regular).toHaveLength(organizations.length + lookalikes.length);
    expect(partition.fixtures).toHaveLength(recognized.length);
  });

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
