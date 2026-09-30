import type { IsoDateTime } from "@/types";

export interface DateTimeDisplayOptions {
  locale?: string;
  timeZone?: string;
  includeSeconds?: boolean;
}

export function isIsoUtcTimestamp(value: string): value is IsoDateTime {
  if (!value.endsWith("Z")) {
    return false;
  }

  const parsed = Date.parse(value);

  return Number.isFinite(parsed);
}

export function formatIsoDateTime(
  value: IsoDateTime | null | undefined,
  options: DateTimeDisplayOptions = {},
): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  const {
    locale = "th-TH",
    timeZone,
    includeSeconds = false,
  } = options;

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: includeSeconds ? "medium" : "short",
    ...(timeZone ? { timeZone } : {}),
  }).format(date);
}
