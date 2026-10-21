import type {
  StorefrontLandingOrganization,
  StorefrontOrganizationDTO,
  StorefrontStoreDTO,
} from "./storefront-service";

export const DIRECTORY_PAGE_SIZE = 12;

/** Development seed organization ID and store ID are fixed by backend/scripts/dev-seed.js.
 * This exact ID is safer than using "Local Demo" in a fuzzy name filter.
 */
const DEV_SEED_ORGANIZATION_ID = "55555555-5555-4555-8555-555555555555";

const HARNESS_DESCRIPTIONS = new Map([
  ["Reject E2E Organization", "Disposable payment rejection E2E organization"],
  ["E2E Organization", "Disposable E2E core-flow organization"],
  ["Tenant Org A", "Disposable tenant A"],
  ["Tenant Org B", "Disposable tenant B"],
  ["Notify Org", "Disposable notification E2E organization"],
]);

/**
 * Strong local fixture fingerprint. No generic /qa|demo|e2e/ name matching:
 * organization name AND exact test-created description must agree, or the
 * record must have the deterministic development seed ID.
 *
 * The directory API does not expose immutable fixture provenance. This
 * presentation-only fingerprint therefore errs toward SHOWING ambiguous
 * records and must not be used to remove tenants or enforce API access.
 */
export function isRecognizedQaOrganization(item: StorefrontLandingOrganization): boolean {
  const { organization } = item;
  if (organization.organizationId === DEV_SEED_ORGANIZATION_ID) return true;
  const name = organization.name.trim();
  const description = organization.description.trim();

  const harness = /^(Reject E2E Organization|E2E Organization|Tenant Org [AB]|Notify Org) harness-phase\d+(?:-rerun)?-\d{9,}$/.exec(name);
  if (harness) return HARNESS_DESCRIPTIONS.get(harness[1]) === description;

  if (/^QA Commerce Org [a-z][a-z0-9-]*-\d{10,}-\d+$/.test(name)) {
    return description === "Disposable frontend Customer commerce fixture";
  }
  if (/^QA Admin Org [a-z][a-z0-9-]*-\d{10,}-\d+(?: Updated)?$/.test(name)) {
    return description === "Disposable Organization Admin audit fixture" ||
      description === "Updated by Organization Admin browser journey";
  }
  if (/^Golden Org golden-\d{10,}-\d+$/.test(name)) {
    return description === "Disposable cross-role golden journey Organization";
  }
  return false;
}

/** Partition without deleting, rewriting, or mutating the public API payload. */
export function separateAutomationFixtures(
  data: StorefrontLandingOrganization[],
): { regular: StorefrontLandingOrganization[]; fixtures: StorefrontLandingOrganization[] } {
  const regular: StorefrontLandingOrganization[] = [];
  const fixtures: StorefrontLandingOrganization[] = [];
  for (const item of data) {
    (isRecognizedQaOrganization(item) ? fixtures : regular).push(item);
  }
  return { regular, fixtures };
}

export type DirectoryFilter = "all" | "with-stores" | "without-stores";

export interface DirectoryEntry {
  organization: StorefrontOrganizationDTO;
  store: StorefrontStoreDTO | null;
  totalStores: number;
}

/**
 * The public API currently returns only ACTIVE organizations/stores.
 * Keep organizations with no stores discoverable, after the live stores.
 * Search always runs against ALL retrieved entries, never only the visible page.
 */
export function buildDirectoryEntries(
  data: StorefrontLandingOrganization[],
): DirectoryEntry[] {
  const activeStores: DirectoryEntry[] = [];
  const emptyOrganizations: DirectoryEntry[] = [];

  for (const { organization, stores } of data) {
    if (stores.length === 0) {
      emptyOrganizations.push({ organization, store: null, totalStores: 0 });
      continue;
    }

    for (const store of stores) {
      activeStores.push({
        organization,
        store,
        totalStores: stores.length,
      });
    }
  }

  return [...activeStores, ...emptyOrganizations];
}

function normalizeSearch(value: string): string {
  return value.trim().normalize("NFKC").toLocaleLowerCase();
}

export function filterDirectoryEntries(
  entries: DirectoryEntry[],
  query: string,
  filter: DirectoryFilter,
): DirectoryEntry[] {
  const needle = normalizeSearch(query);

  return entries.filter(({ organization, store }) => {
    if (filter === "with-stores" && store === null) return false;
    if (filter === "without-stores" && store !== null) return false;
    if (!needle) return true;

    return (
      normalizeSearch(organization.name).includes(needle) ||
      (store !== null && normalizeSearch(store.name).includes(needle))
    );
  });
}
