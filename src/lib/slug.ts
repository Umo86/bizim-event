/**
 * Turkish-aware slugify.
 * Handles ç ğ ı İ ö ş ü (and their capitals) before generic accent stripping,
 * because "ı" and "İ" do not decompose to a plain i under NFD.
 */
const TURKISH_MAP: Record<string, string> = {
  ç: "c", Ç: "c",
  ğ: "g", Ğ: "g",
  ı: "i", I: "i", İ: "i",
  ö: "o", Ö: "o",
  ş: "s", Ş: "s",
  ü: "u", Ü: "u",
  â: "a", Â: "a",
  î: "i", Î: "i",
  û: "u", Û: "u",
};

export function slugify(input: string, maxLength = 80): string {
  const mapped = [...input].map((ch) => TURKISH_MAP[ch] ?? ch).join("");
  return mapped
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
}

/** Turkish locale-aware lower-casing (İ → i, I → ı) for display/search normalisation. */
export function trLower(input: string): string {
  return input.toLocaleLowerCase("tr-TR");
}

/** Compare strings using Turkish collation so ç, ğ, ı, ö, ş, ü sort correctly. */
export const trCollator = new Intl.Collator("tr-TR", { sensitivity: "base" });
export const enCollator = new Intl.Collator("en-GB", { sensitivity: "base" });
