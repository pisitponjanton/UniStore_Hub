const DEFAULT_AUTH_RETURN_PATH = "/";

export interface AuthNavigationContext {
  returnPath: string;
  hasReturnContext: boolean;
  loginHref: string;
  registerHref: string;
}

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

export function buildAuthPagePath(
  targetPath: "/login/" | "/register/",
  returnPath: string | null | undefined,
): string {
  const safeReturnPath = sanitizeAuthReturnPath(returnPath);

  if (safeReturnPath === DEFAULT_AUTH_RETURN_PATH) {
    return targetPath;
  }

  const params = new URLSearchParams({ returnTo: safeReturnPath });
  return `${targetPath}?${params.toString()}`;
}

export function getAuthNavigationContext(search: string): AuthNavigationContext {
  const returnPath = getAuthReturnPath(search);
  const hasReturnContext = returnPath !== DEFAULT_AUTH_RETURN_PATH;

  return {
    returnPath,
    hasReturnContext,
    loginHref: buildAuthPagePath("/login/", returnPath),
    registerHref: buildAuthPagePath("/register/", returnPath),
  };
}
