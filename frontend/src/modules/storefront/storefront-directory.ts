import type {
  StorefrontLandingOrganization,
  StorefrontOrganizationDTO,
  StorefrontStoreDTO,
} from "./storefront-service";

export const DIRECTORY_PAGE_SIZE = 12;

/**
 * Local QA display-only heuristic. Never delete tenants or apply it on the
 * Backend; legitimate organizations remain discoverable via the toggle.
 * Avoid broad matching of generic names such as "Tenant Org B".
 */
export function isExplicitAutomationFixture(name: string): boolean {
  return (
    /(?:^|[\s_(-])(?:e2e|qa fixture|test fixture|automated test)(?:$|[\s_)-])/i.test(name) ||
    /^(?:QA (?:Admin|Commerce) Org\b|Golden Org golden-)/i.test(name) ||
    /\bharness-phase\d+(?:-|$)/i.test(name)
  );
}

export function separateAutomationFixtures(
  data: StorefrontLandingOrganization[],
): { regular: StorefrontLandingOrganization[]; fixtures: StorefrontLandingOrganization[] } {
  const regular: StorefrontLandingOrganization[] = [];
  const fixtures: StorefrontLandingOrganization[] = [];
  for (const item of data) {
    (isExplicitAutomationFixture(item.organization.name) ? fixtures : regular).push(item);
  }
  return { regular, fixtures };
}


export type DirectoryFilter = "all" | "with-stores" | "without-stores";

export interface DirectoryEntry {
  organization: StorefrontOrganizationDTO;
  store: StorefrontStoreDTO | null;
  totalStores: number;
}

export interface DirectoryGroup {
  organization: StorefrontOrganizationDTO;
  stores: StorefrontStoreDTO[];
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

export function groupDirectoryPage(entries: DirectoryEntry[]): DirectoryGroup[] {
  const groups = new Map<string, DirectoryGroup>();

  for (const { organization, store, totalStores } of entries) {
    let group = groups.get(organization.organizationId);
    if (!group) {
      group = { organization, stores: [], totalStores };
      groups.set(organization.organizationId, group);
    }

    if (store) group.stores.push(store);
  }

  return [...groups.values()];
}
