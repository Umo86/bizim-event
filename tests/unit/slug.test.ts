import { describe, expect, it } from "vitest";
import { slugify, trCollator, trLower } from "@/lib/slug";
import { flagEmoji, normaliseCountry } from "@/lib/country";

describe("slugify (Turkish-aware)", () => {
  it.each([
    ["Düğün Salonları", "dugun-salonlari"],
    ["Kına Gecesi Mekanları", "kina-gecesi-mekanlari"],
    ["İstanbul", "istanbul"],
    ["IŞIK Çiçekçilik", "isik-cicekcilik"],
    ["Şükrü & Gönül", "sukru-and-gonul"],
    ["Münih", "munih"],
    ["  --Hello,   World!--  ", "hello-world"],
    ["Café São Paulo", "cafe-sao-paulo"],
  ])("%s → %s", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it("caps length without a trailing dash", () => {
    const s = slugify("a ".repeat(100), 9);
    expect(s.length).toBeLessThanOrEqual(9);
    expect(s.endsWith("-")).toBe(false);
  });
});

describe("Turkish collation and casing", () => {
  it("sorts ç, ğ, ı, ö, ş, ü in Turkish alphabetical order", () => {
    const words = ["Zeytin", "Şeker", "Çay", "Cami", "Ilık", "İnci", "Ördek", "Okul", "Üzüm", "Uçak", "Ğ"];
    const sorted = [...words].sort(trCollator.compare);
    expect(sorted.indexOf("Cami")).toBeLessThan(sorted.indexOf("Çay"));
    expect(sorted.indexOf("Ilık")).toBeLessThan(sorted.indexOf("İnci"));
    expect(sorted.indexOf("Okul")).toBeLessThan(sorted.indexOf("Ördek"));
    expect(sorted.indexOf("Uçak")).toBeLessThan(sorted.indexOf("Üzüm"));
    expect(sorted.at(-1)).toBe("Zeytin");
  });

  it("lower-cases dotted and dotless I correctly", () => {
    expect(trLower("İSTANBUL")).toBe("istanbul");
    expect(trLower("ILIK")).toBe("ılık");
  });
});

describe("country helpers", () => {
  it("normalises ISO2 codes", () => {
    expect(normaliseCountry("gb")).toBe("GB");
    expect(normaliseCountry("GBR")).toBeNull();
    expect(normaliseCountry(null)).toBeNull();
  });
  it("builds flag emoji", () => {
    expect(flagEmoji("TR")).toBe("🇹🇷");
  });
});
