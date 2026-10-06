import type {
  APIRequestContext,
  BrowserContext,
} from "@playwright/test";

export type SeedRole =
  | "customer"
  | "staff"
  | "organizationAdmin"
  | "platformAdmin";

interface LoginEnvelope {
  success: true;
  data: {
    token: string;
  };
}

const ACCESS_TOKEN_STORAGE_KEY = "unistoreHub.accessToken";
const ACTIVE_ORGANIZATION_STORAGE_KEY =
  "unistoreHub.activeOrganizationId";

export const LOCAL_SEED_USERS: Record<SeedRole, string> = {
  customer: "customer@local.unistore.test",
  staff: "staff@local.unistore.test",
  organizationAdmin: "org-admin@local.unistore.test",
  platformAdmin: "platform-admin@local.unistore.test",
};

export const LOCAL_SEED_ENTITY_IDS = Object.freeze({
  organizationId: "55555555-5555-4555-8555-555555555555",
  storeId: "66666666-6666-4666-8666-666666666666",
  productId: "77777777-7777-4777-8777-777777777777",
  variantId: "88888888-8888-4888-8888-888888888888",
  campaignId: "99999999-9999-4999-8999-999999999999",
});

function apiBaseUrl(): string {
  return (
    process.env.E2E_API_BASE_URL ??
    "http://localhost:4000/api/v1"
  ).replace(/\/$/, "");
}

function frontendBaseUrl(): string {
  return (
    process.env.E2E_FRONTEND_BASE_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

function isLocalHost(url: string): boolean {
  const hostname = new URL(url).hostname;
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1"
  );
}

function seedPassword(): string {
  const configured = process.env.E2E_LOCAL_SEED_PASSWORD;

  if (configured) {
    return configured;
  }

  if (!isLocalHost(apiBaseUrl())) {
    throw new Error(
      "E2E_LOCAL_SEED_PASSWORD is required for non-local E2E targets.",
    );
  }

  return "unistore-local-demo-only";
}

export function getSeedOrganizationId(): string {
  const configured = process.env.E2E_ORGANIZATION_ID;

  if (configured) {
    return configured;
  }

  if (!isLocalHost(apiBaseUrl())) {
    throw new Error(
      "E2E_ORGANIZATION_ID is required for non-local E2E targets.",
    );
  }

  return LOCAL_SEED_ENTITY_IDS.organizationId;
}

export function getSeedRoleCredentials(role: SeedRole): {
  email: string;
  password: string;
} {
  return {
    email: LOCAL_SEED_USERS[role],
    password: seedPassword(),
  };
}

export async function getSeedRoleToken(
  request: APIRequestContext,
  role: SeedRole,
): Promise<string> {
  const credentials = getSeedRoleCredentials(role);
  const response = await request.post(
    `${apiBaseUrl()}/auth/login`,
    {
      data: credentials,
    },
  );

  if (!response.ok()) {
    throw new Error(
      `Seed login failed for ${role}: ${response.status()} ${await response.text()}`,
    );
  }

  const payload = (await response.json()) as LoginEnvelope;

  if (!payload.success || !payload.data?.token) {
    throw new Error(
      `Seed login returned an invalid payload for ${role}.`,
    );
  }

  return payload.data.token;
}

export async function establishSeedRoleSession(
  context: BrowserContext,
  request: APIRequestContext,
  role: SeedRole,
): Promise<void> {
  if (
    !isLocalHost(frontendBaseUrl()) &&
    !process.env.E2E_LOCAL_SEED_PASSWORD
  ) {
    throw new Error(
      "Seed-role session helpers are local-first. Supply explicit E2E credentials for another environment.",
    );
  }

  const token = await getSeedRoleToken(request, role);
  const organizationId =
    role === "staff" || role === "organizationAdmin"
      ? getSeedOrganizationId()
      : null;

  await context.addInitScript(
    ({
      accessTokenStorageKey,
      activeOrganizationStorageKey,
      token: accessToken,
      organizationId: activeOrganizationId,
    }) => {
      window.sessionStorage.setItem(
        accessTokenStorageKey,
        accessToken,
      );

      if (activeOrganizationId) {
        window.sessionStorage.setItem(
          activeOrganizationStorageKey,
          activeOrganizationId,
        );
      } else {
        window.sessionStorage.removeItem(
          activeOrganizationStorageKey,
        );
      }
    },
    {
      accessTokenStorageKey: ACCESS_TOKEN_STORAGE_KEY,
      activeOrganizationStorageKey:
        ACTIVE_ORGANIZATION_STORAGE_KEY,
      token,
      organizationId,
    },
  );
}
