import { describe, expect, it } from "vitest";
import {
  normaliseInstagram,
  normalisePhone,
  normaliseWebsite,
  pickValidFields,
  isTimeZone,
  isCurrencyCode,
} from "@/lib/validation/common";
import { businessInfoFields, businessInfoStrict, locationInput } from "@/lib/validation/business";
import {
  listingBasicsStrict,
  listingCancellationStrict,
  listingPricingStrict,
  registerMediaInput,
} from "@/lib/validation/listing";
import { youtubeId } from "@/lib/listing-config";
import {
  completedSteps,
  listingChecks,
  onboardingCompleteness,
  type BusinessSnapshot,
  type ListingSnapshot,
} from "@/lib/completeness";

describe("normalisers", () => {
  it("formats phones to E.164 using the business country", () => {
    expect(normalisePhone("020 7946 0958", "GB")).toBe("+442079460958");
    expect(normalisePhone("0212 555 12 34", "TR")).toBe("+902125551234");
    expect(normalisePhone("+49 30 901820", null)).toBe("+4930901820");
    expect(normalisePhone("12", "GB")).toBeNull();
  });
  it("accepts instagram handles and URLs", () => {
    expect(normaliseInstagram("@saray.salonu")).toBe("saray.salonu");
    expect(normaliseInstagram("https://www.instagram.com/lale_garden/")).toBe("lale_garden");
    expect(normaliseInstagram("not a handle!")).toBeNull();
  });
  it("adds https:// to bare domains and rejects other schemes", () => {
    expect(normaliseWebsite("example.com")).toBe("https://example.com");
    expect(normaliseWebsite("http://example.com/path/")).toBe("http://example.com/path");
    expect(normaliseWebsite("javascript:alert(1)")).toBeNull();
    expect(normaliseWebsite("localhost")).toBeNull();
  });
  it("knows IANA zones and ISO currencies", () => {
    expect(isTimeZone("Europe/Istanbul")).toBe(true);
    expect(isTimeZone("Mars/Base")).toBe(false);
    expect(isCurrencyCode("TRY")).toBe(true);
    expect(isCurrencyCode("ABC")).toBe(false);
  });
  it("extracts YouTube ids", () => {
    expect(youtubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://vimeo.com/123")).toBeNull();
  });
});

describe("autosave keeps valid fields and skips invalid ones", () => {
  it("saves the name even while the email is half-typed", () => {
    const { valid, invalid } = pickValidFields(businessInfoFields, {
      nameTr: "  Saray Düğün Salonu ",
      email: "info@",
      website: "saray.co.uk",
    });
    expect(valid.nameTr).toBe("Saray Düğün Salonu");
    expect(valid.website).toBe("https://saray.co.uk");
    expect(invalid).toEqual(["email"]);
  });
  it("turns empty strings into null (clears the field)", () => {
    expect(pickValidFields(businessInfoFields, { nameEn: "" }).valid.nameEn).toBeNull();
  });
});

describe("strict step rules", () => {
  it("business info needs a name, a 50+ char description, phone and email", () => {
    const r = businessInfoStrict.safeParse({ nameTr: "Saray", descriptionTr: "kısa", phone: "", email: "" });
    expect(r.success).toBe(false);
    const messages = r.error!.issues.map((i) => i.message);
    expect(messages).toEqual(expect.arrayContaining(["description_too_short", "phone_required", "email_required"]));
    expect(
      businessInfoStrict.safeParse({
        nameEn: "Saray",
        descriptionEn: "x".repeat(60),
        phone: "+442079460958",
        email: "a@b.co",
      }).success,
    ).toBe(true);
  });
  it("location accepts a picked place or a manual address", () => {
    expect(locationInput.safeParse({ mode: "place", placeId: "ChIJdd4hrwug2EcRmSrV3Vo6llI" }).success).toBe(true);
    expect(
      locationInput.safeParse({ mode: "manual", countryIso2: "gb", city: "London", addressLine: "1 High St" }).success,
    ).toBe(true);
    expect(locationInput.safeParse({ mode: "manual", countryIso2: "GBR", city: "", addressLine: "" }).success).toBe(
      false,
    );
  });
  it("venues need an area type and at least one capacity", () => {
    const base = { titleEn: "Main Hall", descriptionEn: "x".repeat(60) };
    expect(listingBasicsStrict("venue").safeParse(base).success).toBe(false);
    expect(
      listingBasicsStrict("venue").safeParse({ ...base, areaType: "whole_venue", capacities: { seated_dinner: 300 } })
        .success,
    ).toBe(true);
    expect(
      listingBasicsStrict("caterer").safeParse({ ...base, cuisines: ["turkish"], serviceStyles: [] }).success,
    ).toBe(false);
    expect(listingBasicsStrict("performer").safeParse({ ...base, actTypes: ["dj"], languages: ["tr"] }).success).toBe(
      true,
    );
  });
  it("pricing needs a price unless it's quote-only, and the model must fit the type", () => {
    expect(listingPricingStrict("venue").safeParse({ pricingModel: "custom_quote" }).success).toBe(true);
    expect(listingPricingStrict("venue").safeParse({ pricingModel: "hire_fee_session", priceFrom: "" }).success).toBe(
      false,
    );
    expect(listingPricingStrict("caterer").safeParse({ pricingModel: "hire_fee_session", priceFrom: 10 }).success).toBe(
      false,
    );
    expect(listingPricingStrict("caterer").safeParse({ pricingModel: "per_person", priceFrom: "35" }).success).toBe(
      true,
    );
  });
  it("custom cancellation terms need text", () => {
    expect(listingCancellationStrict.safeParse({ policyKey: "custom" }).success).toBe(false);
    expect(listingCancellationStrict.safeParse({ policyKey: "custom", customTermsEn: "No refunds." }).success).toBe(
      true,
    );
  });
  it("blur placeholders must be tiny data URLs", () => {
    const ok = registerMediaInput.safeParse({
      kind: "image",
      keyBase: "listings/x/y",
      variants: ["small"],
      extension: "webp",
      blurDataUrl: "data:image/webp;base64,UklGRg==",
    });
    expect(ok.success).toBe(true);
    const bad = registerMediaInput.safeParse({
      kind: "image",
      keyBase: "listings/x/y",
      variants: ["small"],
      extension: "webp",
      blurDataUrl: "javascript:alert(1)",
    });
    expect(bad.success).toBe(false);
  });
});

describe("completeness", () => {
  const business: BusinessSnapshot = {
    nameTr: "Saray",
    nameEn: null,
    descriptionTr: "x".repeat(80),
    descriptionEn: null,
    phoneE164: "+442079460958",
    email: "a@b.co",
    website: null,
    instagram: null,
    logoUrl: null,
    cityId: "c1",
    addressLine: "1 High St",
    currency: "GBP",
    timezone: "Europe/London",
  };
  const listing: ListingSnapshot = {
    type: "venue",
    titleTr: "Ana Salon",
    titleEn: null,
    descriptionTr: "x".repeat(80),
    descriptionEn: null,
    imageCount: 4,
    pricingModel: "hire_fee_session",
    priceFrom: 2500,
    eventTypeCount: 2,
    capacityCount: 2,
    areaType: "whole_venue",
    cuisineCount: 0,
    serviceStyleCount: 0,
    actTypeCount: 0,
    languageCount: 0,
    cancellationPolicyId: "p1",
    amenityCount: 0,
  };

  it("blocks submission until venues have 5 photos", () => {
    const c = onboardingCompleteness(business, listing);
    expect(c.canSubmit).toBe(false);
    expect(c.missingRequired.map((m) => m.key)).toEqual(["listing_photos"]);
    expect(onboardingCompleteness(business, { ...listing, imageCount: 5 }).canSubmit).toBe(true);
  });
  it("caterers and performers need 3 photos", () => {
    const caterer = { ...listing, type: "caterer" as const, imageCount: 3, cuisineCount: 1, serviceStyleCount: 1 };
    expect(listingChecks(caterer).find((c) => c.key === "listing_photos")!.done).toBe(true);
  });
  it("scores recommended extras but doesn't require them", () => {
    const c = onboardingCompleteness(business, { ...listing, imageCount: 5 });
    expect(c.score).toBeGreaterThan(70);
    expect(c.score).toBeLessThan(100);
    const full = onboardingCompleteness(
      { ...business, nameEn: "Palace", descriptionEn: "y".repeat(80), website: "https://x.co", logoUrl: "/l.webp" },
      { ...listing, imageCount: 9, titleEn: "Main hall", descriptionEn: "y".repeat(80), amenityCount: 4 },
    );
    expect(full.score).toBe(100);
  });
  it("reports which wizard steps are done", () => {
    const steps = completedSteps(onboardingCompleteness(business, listing));
    expect(steps.has("info")).toBe(true);
    expect(steps.has("photos")).toBe(false);
    // "details" has only recommended checks: done once one of them passes.
    expect(steps.has("details")).toBe(false);
    expect(completedSteps(onboardingCompleteness(business, { ...listing, amenityCount: 3 })).has("details")).toBe(true);
    // A passing recommended check never completes a step whose required checks fail.
    expect(completedSteps(onboardingCompleteness(business, { ...listing, imageCount: 9 })).has("photos")).toBe(true);
    expect(completedSteps(onboardingCompleteness(business, { ...listing, imageCount: 2 })).has("photos")).toBe(false);
  });
});
