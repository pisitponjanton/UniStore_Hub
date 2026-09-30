export const ACCESS_TOKEN_STORAGE_KEY = "unistoreHub.accessToken";
export const ACTIVE_ORGANIZATION_STORAGE_KEY =
  "unistoreHub.activeOrganizationId";

function getSessionStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.sessionStorage;
}

export function readAccessToken(): string | null {
  return getSessionStorage()?.getItem(ACCESS_TOKEN_STORAGE_KEY) ?? null;
}

export function writeAccessToken(token: string): void {
  getSessionStorage()?.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
}

export function clearAccessToken(): void {
  getSessionStorage()?.removeItem(ACCESS_TOKEN_STORAGE_KEY);
}

export function readActiveOrganizationId(): string | null {
  return (
    getSessionStorage()?.getItem(ACTIVE_ORGANIZATION_STORAGE_KEY) ?? null
  );
}

export function writeActiveOrganizationId(organizationId: string): void {
  getSessionStorage()?.setItem(
    ACTIVE_ORGANIZATION_STORAGE_KEY,
    organizationId,
  );
}

export function clearActiveOrganizationId(): void {
  getSessionStorage()?.removeItem(ACTIVE_ORGANIZATION_STORAGE_KEY);
}
