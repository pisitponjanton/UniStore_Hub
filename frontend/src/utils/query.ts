export type QueryValue = string | null | undefined;

export type RequiredQueryResult =
  | { ok: true; value: string }
  | { ok: false; reason: "MISSING" | "INVALID" };

export function parseRequiredQueryId(value: QueryValue): RequiredQueryResult {
  if (value == null) {
    return { ok: false, reason: "MISSING" };
  }

  const trimmed = value.trim();

  if (!trimmed || /[\u0000-\u001F\u007F]/.test(trimmed)) {
    return { ok: false, reason: "INVALID" };
  }

  return { ok: true, value: trimmed };
}

export function getRequiredQueryId(
  searchParams: URLSearchParams,
  key: string,
): RequiredQueryResult {
  return parseRequiredQueryId(searchParams.get(key));
}
