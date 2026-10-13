import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/min";
import { z } from "zod";

/** Trimmed optional text; empty string becomes undefined so it clears nothing by accident. */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

export const iso2 = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/);

let currencyCodes: Set<string> | undefined;
let timeZones: Set<string> | undefined;

export function isCurrencyCode(v: string) {
  currencyCodes ??= new Set(Intl.supportedValuesOf("currency"));
  return currencyCodes.has(v);
}
export function isTimeZone(v: string) {
  timeZones ??= new Set(Intl.supportedValuesOf("timeZone"));
  if (timeZones.has(v)) return true;
  try {
    // Aliases such as "Europe/Kiev" are valid even if not in the canonical list.
    new Intl.DateTimeFormat("en", { timeZone: v });
    return true;
  } catch {
    return false;
  }
}

export const currencyCode = z.string().trim().toUpperCase().refine(isCurrencyCode, { message: "invalid_currency" });

export const timeZone = z.string().trim().refine(isTimeZone, { message: "invalid_timezone" });

export const money = z.coerce.number().nonnegative().max(10_000_000);
export const smallInt = (min: number, max: number) => z.coerce.number().int().min(min).max(max);

/** Normalise a phone number to E.164 using the business's country as the default region. */
export function normalisePhone(raw: string, country?: string | null): string | null {
  const parsed = parsePhoneNumberFromString(raw, (country ?? undefined) as CountryCode | undefined);
  return parsed && parsed.isValid() ? parsed.number : null;
}

/** "+442079460321" → "+44 20 7946 0321" for display; unparseable input comes back unchanged. */
export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  return parsePhoneNumberFromString(e164)?.formatInternational() ?? e164;
}

/** "@handle", "handle" or an instagram.com URL → "handle". */
export function normaliseInstagram(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  const fromUrl = /instagram\.com\/([A-Za-z0-9._]{1,30})/i.exec(v)?.[1];
  const handle = (fromUrl ?? v.replace(/^@/, "")).trim();
  return /^[A-Za-z0-9._]{1,30}$/.test(handle) ? handle : null;
}

/** Accepts "example.com" and adds https://; only http(s) URLs pass. */
export function normaliseWebsite(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes(".")) return null;
    return u.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

/**
 * Autosave helper: validate each field independently and keep only the valid
 * ones, so a half-typed phone number never blocks saving the rest of the form.
 */
export function pickValidFields<S extends z.ZodRawShape>(
  shape: S,
  data: Record<string, unknown>,
): { valid: Partial<{ [K in keyof S]: z.output<S[K]> }>; invalid: string[] } {
  const valid: Record<string, unknown> = {};
  const invalid: string[] = [];
  for (const key of Object.keys(shape)) {
    if (!(key in data)) continue;
    const result = (shape[key] as z.ZodType).safeParse(data[key]);
    if (result.success) valid[key] = result.data;
    else invalid.push(key);
  }
  return { valid: valid as Partial<{ [K in keyof S]: z.output<S[K]> }>, invalid };
}
