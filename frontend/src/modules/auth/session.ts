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
    if (this.restorePromise) {
      return this.restorePromise;
    }

    this.restorePromise = this.performRestore();

    try {
      return await this.restorePromise;
    } finally {
      this.restorePromise = null;
    }
  }

  private async performRestore(): Promise<AuthState> {
    const token = this.storage.read();

    if (!token) {
      this.setState(ANONYMOUS_STATE);
      return this.state;
    }

    this.setState(LOADING_STATE);

    try {
      const session = await this.api.get<CurrentUserSessionDTO>("/me", {
        authenticated: true,
      });

      this.setState({
        status: "authenticated",
        user: session.user,
        memberships: session.memberships,
      });
    } catch (error) {
      if (isDefinitiveInvalidTokenError(error)) {
        this.storage.clear();
        this.storage.clearOrganization();
      }

      this.setState(ANONYMOUS_STATE);
    }

    return this.state;
  }

  async establish(token: string): Promise<AuthState> {
    this.storage.write(token);
    return this.restore();
  }

  logout(): void {
    this.storage.clear();
    this.storage.clearOrganization();
    this.setState(ANONYMOUS_STATE);
  }
}

export const authSession = new AuthSessionStore();
