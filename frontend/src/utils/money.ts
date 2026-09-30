import type { Satang } from "@/types";

export type MoneyParseResult =
  | { ok: true; satang: Satang }
  | {
      ok: false;
      reason: "REQUIRED" | "INVALID_FORMAT" | "TOO_MANY_DECIMALS" | "OUT_OF_RANGE";
    };

const THB_INPUT_PATTERN = /^\d+(?:\.(\d+))?$/;

export function parseThbToSatang(input: string): MoneyParseResult {
  const normalized = input.trim();

  if (!normalized) {
    return { ok: false, reason: "REQUIRED" };
  }

  const match = normalized.match(THB_INPUT_PATTERN);

  if (!match) {
    return { ok: false, reason: "INVALID_FORMAT" };
  }

  const fraction = match[1] ?? "";

  if (fraction.length > 2) {
    return { ok: false, reason: "TOO_MANY_DECIMALS" };
  }

  const [wholePart, fractionPart = ""] = normalized.split(".");
  const normalizedWhole = wholePart.replace(/^0+(?=\d)/, "");
  const satangDigits = `${normalizedWhole}${fractionPart.padEnd(2, "0")}`;
  const satang = Number(satangDigits);

  if (!Number.isSafeInteger(satang) || satang < 0) {
    return { ok: false, reason: "OUT_OF_RANGE" };
  }

  return { ok: true, satang };
}

const thbFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "THB",
  currencyDisplay: "narrowSymbol",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatSatang(satang: Satang): string {
  if (!Number.isSafeInteger(satang)) {
    throw new RangeError("Satang amount must be a safe integer.");
  }

  return thbFormatter.format(satang / 100);
}

export function satangToThbInput(satang: Satang): string {
  if (!Number.isSafeInteger(satang) || satang < 0) {
    throw new RangeError("Satang amount must be a non-negative safe integer.");
  }

  const whole = Math.floor(satang / 100);
  const fraction = String(satang % 100).padStart(2, "0");

  return `${whole}.${fraction}`;
}
