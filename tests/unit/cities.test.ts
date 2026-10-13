import { describe, expect, it } from "vitest";
import { citiesForVisitor, FEATURED_CITIES, findFeaturedCity } from "@/content/cities";
import { slugify } from "@/lib/slug";
import { unsplashImage, unsplashSrcSet } from "@/lib/unsplash";

describe("featured cities", () => {
  it("has a free Unsplash photo and a Turkish locative for every city", () => {
    for (const c of FEATURED_CITIES) {
      expect(c.photo.id).toMatch(/^photo-\d{10,13}-[0-9a-f]{12}$/);
      expect(c.photo.page).toMatch(/^[\w-]{11}$/);
      expect(c.photo.by.length).toBeGreaterThan(1);
      expect(c.inTr.startsWith(`${c.tr}'`)).toBe(true);
    }
  });

  it("keys match the slugs the seed gives the cities table, so links resolve", () => {
    for (const c of FEATURED_CITIES) expect(c.key).toBe(slugify(c.en));
    expect(new Set(FEATURED_CITIES.map((c) => c.key)).size).toBe(FEATURED_CITIES.length);
  });

  it("puts the visitor's own country first, featured cities leading", () => {
    expect(
      citiesForVisitor("GB")
        .map((c) => c.key)
        .slice(0, 4),
    ).toEqual(["london", "birmingham", "manchester", "istanbul"]);
    expect(
      citiesForVisitor("tr")
        .map((c) => c.key)
        .slice(0, 3),
    ).toEqual(["istanbul", "izmir", "london"]);
    expect(citiesForVisitor("DE")[0].key).toBe("berlin");
  });

  it("falls back to the editorial order for countries without a featured city", () => {
    const keys = citiesForVisitor("JP").map((c) => c.key);
    expect(keys[0]).toBe("london");
    // Non-featured cities (UK regionals) go last for everyone else.
    expect(keys.slice(-2)).toEqual(["birmingham", "manchester"]);
    expect(keys).toHaveLength(12);
  });

  it("finds a city from a tile link or from what someone typed", () => {
    expect(findFeaturedCity({ key: "london", country: "gb" })?.en).toBe("London");
    expect(findFeaturedCity({ key: "london", country: "CA" })).toBeUndefined();
    expect(findFeaturedCity({ text: "Londra" })?.key).toBe("london");
    expect(findFeaturedCity({ text: "  İSTANBUL " })?.key).toBe("istanbul");
    expect(findFeaturedCity({ text: "Istanbul" })?.key).toBe("istanbul");
    expect(findFeaturedCity({ text: "new york" })?.key).toBe("new-york");
    expect(findFeaturedCity({ text: "Sidney" })?.key).toBe("sydney");
    expect(findFeaturedCity({ text: "Narnia" })).toBeUndefined();
    expect(findFeaturedCity({})).toBeUndefined();
  });

  it("builds resized Unsplash URLs for srcset", () => {
    expect(unsplashImage("photo-1-a", 800)).toBe(
      "https://images.unsplash.com/photo-1-a?auto=format&fit=max&w=800&q=70",
    );
    expect(unsplashSrcSet("photo-1-a", [400, 800])).toBe(
      "https://images.unsplash.com/photo-1-a?auto=format&fit=max&w=400&q=70 400w, https://images.unsplash.com/photo-1-a?auto=format&fit=max&w=800&q=70 800w",
    );
  });
});
