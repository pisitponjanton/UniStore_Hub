import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiClientError } from "@/services";
import type { CurrentUserSessionDTO } from "@/types";

import {
  AuthSessionStore,
  type SessionApi,
  type SessionTokenStorage,
} from "./session";

const currentUser: CurrentUserSessionDTO = {
  user: {
    userId: "user-1",
    email: "student@example.com",
    name: "Student",
    status: "ACTIVE",
    platformRole: null,
  },
  memberships: [
    {
      organizationId: "org-1",
      role: "ORGANIZATION_ADMIN",
      status: "ACTIVE",
    },
  ],
};

function createStorage(token: string | null = null) {
  let accessToken = token;
  let organizationCleared = false;

  const storage: SessionTokenStorage = {
    read: vi.fn(() => accessToken),
    write: vi.fn((nextToken: string) => {
      accessToken = nextToken;
    }),
    clear: vi.fn(() => {
      accessToken = null;
    }),
    clearOrganization: vi.fn(() => {
      organizationCleared = true;
    }),
  };

  return {
    storage,
    get token() {
      return accessToken;
    },
    get organizationCleared() {
      return organizationCleared;
    },
  };
}

describe("AuthSessionStore", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("restores user and memberships from GET /me when a token exists", async () => {
    const storage = createStorage("jwt-token");
    const api: SessionApi = {
      get: vi.fn().mockResolvedValue(currentUser),
    };
    const session = new AuthSessionStore(api, storage.storage);

    await session.restore();

    expect(api.get).toHaveBeenCalledWith("/me", {
      authenticated: true,
    });
    expect(session.getSnapshot()).toEqual({
      status: "authenticated",
      ...currentUser,
    });
    expect(storage.token).toBe("jwt-token");
  });

  it("becomes anonymous without making an API request when no token exists", async () => {
    const storage = createStorage();
    const api: SessionApi = {
      get: vi.fn(),
    };
    const session = new AuthSessionStore(api, storage.storage);

    await session.restore();

    expect(api.get).not.toHaveBeenCalled();
    expect(session.getSnapshot()).toEqual({ status: "anonymous" });
  });

  it.each(["TOKEN_INVALID", "TOKEN_EXPIRED"] as const)(
    "clears a definitive invalid session for %s",
    async (code) => {
      const storage = createStorage("bad-token");
      const api: SessionApi = {
        get: vi.fn().mockRejectedValue(
          new ApiClientError({
            status: 401,
            code,
            kind: "unauthorized",
          }),
        ),
      };
      const session = new AuthSessionStore(api, storage.storage);

      await session.restore();

      expect(storage.token).toBeNull();
      expect(storage.organizationCleared).toBe(true);
      expect(session.getSnapshot()).toEqual({ status: "anonymous" });
    },
  );

  it("retains the token when GET /me is forbidden rather than treating 403 as logout", async () => {
    const storage = createStorage("still-valid-token");
    const api: SessionApi = {
      get: vi.fn().mockRejectedValue(
        new ApiClientError({
          status: 403,
          code: "FORBIDDEN",
          kind: "forbidden",
        }),
      ),
    };
    const session = new AuthSessionStore(api, storage.storage);

    await session.restore();

    expect(storage.token).toBe("still-valid-token");
    expect(storage.storage.clear).not.toHaveBeenCalled();
    expect(session.getSnapshot()).toEqual({ status: "anonymous" });
  });

  it("stores a new token then restores authoritative memberships", async () => {
    const storage = createStorage();
    const api: SessionApi = {
      get: vi.fn().mockResolvedValue(currentUser),
    };
    const session = new AuthSessionStore(api, storage.storage);

    await session.establish("new-token");

    expect(storage.storage.write).toHaveBeenCalledWith("new-token");
    expect(session.getSnapshot()).toEqual({
      status: "authenticated",
      ...currentUser,
    });
  });

  it("logout clears session and active organization context", async () => {
    const storage = createStorage("jwt-token");
    const api: SessionApi = {
      get: vi.fn().mockResolvedValue(currentUser),
    };
    const session = new AuthSessionStore(api, storage.storage);

    await session.restore();
    session.logout();

    expect(storage.token).toBeNull();
    expect(storage.organizationCleared).toBe(true);
    expect(session.getSnapshot()).toEqual({ status: "anonymous" });
  });

  it("deduplicates simultaneous session restoration calls", async () => {
    const storage = createStorage("jwt-token");
    let resolveRequest: ((value: CurrentUserSessionDTO) => void) | undefined;
    const pendingRequest = new Promise<CurrentUserSessionDTO>((resolve) => {
      resolveRequest = resolve;
    });
    const api: SessionApi = {
      get: vi.fn().mockReturnValue(pendingRequest),
    };
    const session = new AuthSessionStore(api, storage.storage);

    const first = session.restore();
    const second = session.restore();

    expect(api.get).toHaveBeenCalledTimes(1);

    resolveRequest?.(currentUser);
    await Promise.all([first, second]);

    expect(session.getSnapshot().status).toBe("authenticated");
  });
});
