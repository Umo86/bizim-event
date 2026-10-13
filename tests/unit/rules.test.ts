import { describe, expect, it } from "vitest";
import {
  addBusinessDays,
  computeListingIsPublic,
  effectiveBookingStatus,
  effectiveSubscriptionStatus,
  isSubscriptionInGoodStanding,
  mrrMinor,
  trialDay,
  tzOffsetMinutes,
  type SubscriptionLike,
} from "@/server/rules";
import { isQuietHours } from "@/lib/adapters/sms";
import { parseWkbPoint } from "@/db/schema/_shared";

const now = new Date("2026-10-13T12:00:00Z");
const day = 864e5;
const sub = (s: Partial<SubscriptionLike>): SubscriptionLike => ({
  status: "trialing",
  trialEndsAt: null,
  currentPeriodEnd: null,
  graceUntil: null,
  ...s,
});

describe("subscription visibility rule", () => {
  it("trialing is public until the trial ends", () => {
    expect(isSubscriptionInGoodStanding(sub({ trialEndsAt: new Date(now.getTime() + day) }), now)).toBe(true);
    expect(isSubscriptionInGoodStanding(sub({ trialEndsAt: new Date(now.getTime() - 1) }), now)).toBe(false);
  });
  it("active and comped are public", () => {
    expect(isSubscriptionInGoodStanding(sub({ status: "active" }), now)).toBe(true);
    expect(isSubscriptionInGoodStanding(sub({ status: "comped" }), now)).toBe(true);
  });
  it("past_due is public only inside the 7-day grace period", () => {
    expect(
      isSubscriptionInGoodStanding(sub({ status: "past_due", graceUntil: new Date(now.getTime() + day) }), now),
    ).toBe(true);
    expect(
      isSubscriptionInGoodStanding(sub({ status: "past_due", graceUntil: new Date(now.getTime() - day) }), now),
    ).toBe(false);
  });
  it("cancelled stays public until the period ends; expired never", () => {
    expect(
      isSubscriptionInGoodStanding(sub({ status: "canceled", currentPeriodEnd: new Date(now.getTime() + day) }), now),
    ).toBe(true);
    expect(
      isSubscriptionInGoodStanding(sub({ status: "canceled", currentPeriodEnd: new Date(now.getTime() - day) }), now),
    ).toBe(false);
    expect(isSubscriptionInGoodStanding(sub({ status: "expired" }), now)).toBe(false);
    expect(isSubscriptionInGoodStanding(null, now)).toBe(false);
  });
  it("daily job settles lapsed states to expired", () => {
    expect(effectiveSubscriptionStatus(sub({ trialEndsAt: new Date(now.getTime() - 1) }), now)).toBe("expired");
    expect(effectiveSubscriptionStatus(sub({ status: "past_due", graceUntil: new Date(now.getTime() - 1) }), now)).toBe(
      "expired",
    );
    expect(effectiveSubscriptionStatus(sub({ status: "active" }), now)).toBe("active");
  });
  it("a listing needs business + listing approved, not deleted, and good standing", () => {
    const base = {
      businessStatus: "approved",
      listingStatus: "approved",
      businessDeleted: false,
      listingDeleted: false,
      subscription: sub({ status: "active" }),
      now,
    };
    expect(computeListingIsPublic(base)).toBe(true);
    expect(computeListingIsPublic({ ...base, businessStatus: "suspended" })).toBe(false);
    expect(computeListingIsPublic({ ...base, listingStatus: "paused" })).toBe(false);
    expect(computeListingIsPublic({ ...base, listingDeleted: true })).toBe(false);
    expect(computeListingIsPublic({ ...base, subscription: sub({ status: "expired" }) })).toBe(false);
  });
});

describe("lazy booking expiry", () => {
  it("treats an overdue request as expired on read", () => {
    expect(effectiveBookingStatus({ status: "requested", requestExpiresAt: new Date(now.getTime() - 1) }, now)).toBe(
      "expired",
    );
    expect(effectiveBookingStatus({ status: "requested", requestExpiresAt: new Date(now.getTime() + 1) }, now)).toBe(
      "requested",
    );
    expect(effectiveBookingStatus({ status: "confirmed", requestExpiresAt: new Date(now.getTime() - 1) }, now)).toBe(
      "confirmed",
    );
  });
});

describe("business days and time zones", () => {
  it("skips the weekend (Friday + 2 business days = Tuesday, end of day local)", () => {
    const friday = new Date("2026-10-16T10:00:00Z");
    const due = addBusinessDays(friday, 2, "Europe/London");
    expect(due.toISOString()).toBe("2026-10-20T22:59:59.000Z"); // 23:59:59 BST
  });
  it("uses the business's own time zone", () => {
    const due = addBusinessDays(new Date("2026-10-13T10:00:00Z"), 2, "Europe/Istanbul");
    expect(due.toISOString()).toBe("2026-10-15T20:59:59.000Z"); // 23:59:59 TRT (UTC+3)
  });
  it("computes offsets", () => {
    expect(tzOffsetMinutes(new Date("2026-07-01T12:00:00Z"), "Europe/London")).toBe(60);
    expect(tzOffsetMinutes(new Date("2026-12-01T12:00:00Z"), "Europe/London")).toBe(0);
  });
  it("detects SMS quiet hours (22:00–08:00 local)", () => {
    expect(isQuietHours("Europe/Istanbul", new Date("2026-10-13T20:30:00Z"))).toBe(true); // 23:30 TRT
    expect(isQuietHours("Europe/London", new Date("2026-10-13T12:00:00Z"))).toBe(false);
  });
});

describe("misc", () => {
  it("counts trial days from approval", () => {
    expect(trialDay(new Date(now.getTime() - 59 * day), now)).toBe(60);
  });
  it("counts yearly £60 as £5/month MRR", () => {
    expect(mrrMinor("year", 6000)).toBe(500);
    expect(mrrMinor("month", 600)).toBe(600);
  });
  it("decodes PostGIS EWKB points", () => {
    // SRID=4326;POINT(-0.1276 51.5072) as hex EWKB (little endian)
    expect(parseWkbPoint("0101000020E6100000DA1B7C613255C0BFFE43FAEDEBC04940")).toEqual({ lng: -0.1276, lat: 51.5072 });
  });
});
