import { apiClient, type ApiClient } from "@/services";
import type { AuthSessionDTO } from "@/types";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest extends LoginRequest {
  name: string;
}

export interface AuthService {
  login: (request: LoginRequest) => Promise<AuthSessionDTO>;
  register: (request: RegisterRequest) => Promise<AuthSessionDTO>;
}

export function createAuthService(client: ApiClient = apiClient): AuthService {
  return {
    login(request) {
      return client.post<AuthSessionDTO>("/auth/login", request);
    },
    register(request) {
      return client.post<AuthSessionDTO>("/auth/register", request);
    },
  };
}

export const authService = createAuthService();
