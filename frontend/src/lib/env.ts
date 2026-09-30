const API_BASE_URL_ENV_KEY = "NEXT_PUBLIC_API_BASE_URL";

export class FrontendConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FrontendConfigurationError";
  }
}

export function getApiBaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();

  if (!value) {
    throw new FrontendConfigurationError(
      `${API_BASE_URL_ENV_KEY} is required before making API requests.`,
    );
  }

  return value.replace(/\/+$/, "");
}
