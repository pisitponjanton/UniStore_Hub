import type { CurrentUserSessionDTO } from "@/types";
import {
  clearAccessToken,
  clearActiveOrganizationId,
  readAccessToken,
  writeAccessToken,
} from "@/lib";
import { ApiClientError, apiClient } from "@/services";

export type AuthState =
  | { status: "loading" }
  | { status: "anonymous" }
  | ({
      status: "authenticated";
    } & CurrentUserSessionDTO);

export interface SessionApi {
  get<T>(
    path: string,
    options?: {
      authenticated?: boolean;
    },
  ): Promise<T>;
}

export interface SessionTokenStorage {
  read: () => string | null;
  write: (token: string) => void;
  clear: () => void;
  clearOrganization: () => void;
}

const browserTokenStorage: SessionTokenStorage = {
  read: readAccessToken,
  write: writeAccessToken,
  clear: clearAccessToken,
  clearOrganization: clearActiveOrganizationId,
};

const LOADING_STATE: AuthState = { status: "loading" };
const ANONYMOUS_STATE: AuthState = { status: "anonymous" };

function isDefinitiveInvalidTokenError(error: unknown): boolean {
  return (
    error instanceof ApiClientError &&
    (error.code === "TOKEN_INVALID" || error.code === "TOKEN_EXPIRED")
  );
}

export class AuthSessionStore {
  private state: AuthState = LOADING_STATE;
  private readonly listeners = new Set<() => void>();
  private restorePromise: Promise<AuthState> | null = null;
  private restoreVersion = -1;
  private sessionVersion = 0;

  constructor(
    private readonly api: SessionApi = apiClient,
    private readonly storage: SessionTokenStorage = browserTokenStorage,
  ) {}

  getSnapshot = (): AuthState => this.state;

  getServerSnapshot = (): AuthState => LOADING_STATE;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  };

  private setState(nextState: AuthState): void {
    this.state = nextState;
    this.listeners.forEach((listener) => listener());
  }

  async restore(): Promise<AuthState> {
    const version = this.sessionVersion;
    if (this.restorePromise && this.restoreVersion === version) {
      return this.restorePromise;
    }

    // A new sign-in must not reuse a previous token's in-flight /me.
    const restore = this.performRestore(version);
    this.restorePromise = restore;
    this.restoreVersion = version;

    try {
      return await restore;
    } finally {
      if (this.restorePromise === restore) {
        this.restorePromise = null;
        this.restoreVersion = -1;
      }
    }
  }

  private async performRestore(version: number): Promise<AuthState> {
    const token = this.storage.read();
    if (version !== this.sessionVersion) return this.state;

    if (!token) {
      this.setState(ANONYMOUS_STATE);
      return this.state;
    }

    this.setState(LOADING_STATE);

    try {
      const session = await this.api.get<CurrentUserSessionDTO>("/me", {
        authenticated: true,
      });

      // Ignore a late result from a previous login or logout, including
      // an expired old token that would otherwise clear the new token.
      if (version !== this.sessionVersion) return this.state;

      this.setState({
        status: "authenticated",
        user: session.user,
        memberships: session.memberships,
      });
    } catch (error) {
      if (version !== this.sessionVersion) return this.state;

      if (isDefinitiveInvalidTokenError(error)) {
        this.storage.clear();
        this.storage.clearOrganization();
      }

      this.setState(ANONYMOUS_STATE);
    }

    return this.state;
  }

  async establish(token: string): Promise<AuthState> {
    this.sessionVersion += 1;
    this.storage.write(token);
    return this.restore();
  }

  logout(): void {
    this.sessionVersion += 1;
    this.storage.clear();
    this.storage.clearOrganization();
    this.setState(ANONYMOUS_STATE);
  }
}

export const authSession = new AuthSessionStore();
