const DEFAULT_AUTH_RETURN_PATH = "/";

export function sanitizeAuthReturnPath(
  value: string | null | undefined,
): string {
  if (!value) {
    return DEFAULT_AUTH_RETURN_PATH;
  }

  const candidate = value.trim();

  if (
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\") ||
    /[\u0000-\u001F\u007F]/.test(candidate)
  ) {
    return DEFAULT_AUTH_RETURN_PATH;
  }

  return candidate;
}

export function getAuthReturnPath(search: string): string {
  const params = new URLSearchParams(search);
  return sanitizeAuthReturnPath(params.get("returnTo"));
}
