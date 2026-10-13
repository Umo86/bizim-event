import { ChevronLeft, Mail, Phone } from "lucide-react";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Link } from "@/i18n/navigation";
import { ReviewActions } from "@/components/admin/review-actions";
import { StatusBadge } from "@/components/business/status-badge";
import { ListingPreviewCard } from "@/components/listing/preview-card";
import { flagEmoji } from "@/lib/country";
import { formatMoney, pickLocalized } from "@/lib/utils";
import { formatPhone } from "@/lib/validation/common";
import { allCountries } from "@/lib/countries-data";
import type { ListingType } from "@/lib/listing-config";
import { adminDal, isDalError, listingWrite } from "@/server/dal";
import { asLocale, requireAdminContext } from "@/server/page-helpers";

export default async function ReviewBusinessPage(props: PageProps<"/[locale]/admin/approvals/[businessId]">) {
  const t = await getTranslations("admin");
  return (
    <div className="space-y-10">
      <Link
        href="/admin/approvals"
        className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-primary-strong hover:underline"
      >
        <ChevronLeft className="size-4" aria-hidden />
        {t("back")}
      </Link>
      <Suspense fallback={<ReviewSkeleton />}>
        <Review params={props.params} />
      </Suspense>
    </div>
  );
}

function ReviewSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]" aria-hidden>
      <div className="space-y-4">
        <div className="h-10 w-2/3 animate-pulse rounded-lg bg-section" />
        <div className="h-32 animate-pulse rounded-2xl bg-section" />
        <div className="h-64 animate-pulse rounded-2xl bg-section" />
      </div>
      <div className="h-40 animate-pulse rounded-2xl bg-section" />
    </div>
  );
}

async function Review({ params }: { params: PageProps<"/[locale]/admin/approvals/[businessId]">["params"] }) {
  const { locale: raw, businessId } = await params;
  const locale = asLocale(raw);
  const ctx = await requireAdminContext();
  let review: adminDal.BusinessReview;
  try {
    review = await adminDal.getBusinessForReview(ctx, businessId);
  } catch (err) {
    if (isDalError(err)) notFound();
    throw err;
  }
  const { business, owner, city, listings } = review;
  const t = await getTranslations({ locale, namespace: "admin" });
  const tf = await getTranslations({ locale, namespace: "fields" });
  const to = await getTranslations({ locale, namespace: "options" });
  const tl = await getTranslations({ locale, namespace: "listingTypes" });
  const format = await getFormatter({ locale });
  const label = (o: { labelTr: string; labelEn: string }) => (locale === "tr" ? o.labelTr : o.labelEn);
  const options = await listingWrite.listingFormOptions(ctx, business.type as ListingType);
  const labels = (list: { key: string; labelTr: string; labelEn: string }[], keys: string[]) =>
    keys
      .map((k) => {
        const o = list.find((x) => x.key === k);
        return o ? label(o) : k;
      })
      .join(", ");
  const countryName = (iso2: string) => {
    const c = allCountries().find((x) => x.iso2 === iso2);
    return c ? (locale === "tr" ? c.nameTr : c.nameEn) : iso2;
  };
  const flags = (pairs: [boolean, string][]) =>
    pairs
      .filter(([on]) => on)
      .map(([, text]) => text)
      .join(", ");
  /** Everything type-specific the owner entered, so nothing goes live unseen. */
  const detailsOf = (l: (typeof listings)[number]) => {
    const out: { label: string; value: string }[] = [];
    if (l.venue) {
      const v = l.venue.details;
      const venueType = locale === "tr" ? l.venue.venueTypeTr : l.venue.venueTypeEn;
      if (venueType) out.push({ label: tf("venueType"), value: venueType });
      out.push({ label: tf("alcohol"), value: v.alcohol ? to(`alcohol.${v.alcohol}`) : "—" });
      const on = flags([
        [v.inHouseCatering, tf("inHouseCatering")],
        [v.externalCateringAllowed, tf("externalCatering")],
        [v.halalKitchen, tf("halalKitchen")],
        [v.alcoholFreeOption, tf("alcoholFree")],
        [v.liveMusicAllowed, tf("liveMusic")],
        [v.davulZurnaAllowed, tf("davulZurna")],
        [v.ownDjAllowed, tf("ownDj")],
        [v.prayerRoom, tf("prayerRoom")],
        [v.separateWomensArea, tf("separateWomensArea")],
      ]);
      if (on) out.push({ label: t("listingData"), value: on });
      if (v.parkingSpaces) out.push({ label: tf("parkingSpaces"), value: String(v.parkingSpaces) });
      if (v.lateLicenceUntil) out.push({ label: tf("lateLicence"), value: v.lateLicenceUntil.slice(0, 5) });
    }
    if (l.caterer) {
      const c = l.caterer;
      out.push({ label: tf("cuisines"), value: labels(options.cuisines, c.cuisines) || "—" });
      out.push({ label: tf("serviceStyles"), value: labels(options.serviceStyles, c.serviceStyles) || "—" });
      if (l.minGuests) out.push({ label: tf("minGuests"), value: String(l.minGuests) });
      if (l.maxGuests) out.push({ label: tf("maxGuests"), value: String(l.maxGuests) });
      const on = flags([
        [c.halalCertified, c.halalCertBody ? `${tf("halalCertified")} (${c.halalCertBody})` : tf("halalCertified")],
        [c.staffIncluded, tf("staffIncluded")],
        [c.equipmentIncluded, tf("equipmentIncluded")],
      ]);
      if (on) out.push({ label: t("listingData"), value: on });
      if (c.travelRadiusKm) out.push({ label: tf("travelRadius"), value: String(c.travelRadiusKm) });
    }
    if (l.performer) {
      const p = l.performer;
      out.push({ label: tf("actTypes"), value: labels(options.actTypes, p.actTypes) || "—" });
      out.push({ label: tf("languages"), value: labels(options.languages, p.languages) || "—" });
      if (p.setLengthMinutes) out.push({ label: tf("setLength"), value: String(p.setLengthMinutes) });
      if (p.setsPerEvent) out.push({ label: tf("setsPerEvent"), value: String(p.setsPerEvent) });
      if (p.membersCount) out.push({ label: tf("members"), value: String(p.membersCount) });
      if (p.travelFee) out.push({ label: tf("travelFee"), value: formatMoney(p.travelFee, l.currency, locale) });
      const on = flags([
        [p.ownPaIncluded, tf("ownPa")],
        [p.travelsInternationally, tf("travelsInternationally")],
      ]);
      if (on) out.push({ label: t("listingData"), value: on });
      if (p.countriesCovered.length)
        out.push({ label: tf("countriesCovered"), value: p.countriesCovered.map(countryName).join(", ") });
    }
    return out;
  };
  const both = (tr: string | null, en: string | null) => (
    <div className="grid gap-3 md:grid-cols-2">
      <div lang="tr" className="whitespace-pre-wrap rounded-xl bg-section p-3 text-sm text-ink">
        <span className="mb-1 block text-xs font-semibold text-muted">TR</span>
        {tr || "—"}
      </div>
      <div lang="en" className="whitespace-pre-wrap rounded-xl bg-section p-3 text-sm text-ink">
        <span className="mb-1 block text-xs font-semibold text-muted">EN</span>
        {en || "—"}
      </div>
    </div>
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <div className="min-w-0 space-y-8">
        <header>
          <p className="text-sm text-muted">{tl(business.type)}</p>
          <h1 className="text-3xl font-bold text-ink">
            {pickLocalized(locale, business.nameTr, business.nameEn).value}
          </h1>
          <div className="mt-2">
            <StatusBadge status={business.status} />
          </div>
        </header>
        {both(business.nameTr, business.nameEn)}
        {both(business.descriptionTr, business.descriptionEn)}

        <section className="grid gap-4 rounded-2xl border border-line p-5 text-sm sm:grid-cols-2">
          <div>
            <h2 className="font-semibold text-ink">{t("contact")}</h2>
            <p className="mt-2 flex items-center gap-2 text-ink">
              <Phone className="size-4 text-muted" aria-hidden />
              {formatPhone(business.phoneE164) || "—"}
            </p>
            <p className="mt-1 flex items-center gap-2 text-ink">
              <Mail className="size-4 text-muted" aria-hidden />
              {business.email ?? "—"}
            </p>
            {business.website ? <p className="mt-1 break-all text-primary-strong">{business.website}</p> : null}
            {business.instagram ? <p className="mt-1 text-ink">@{business.instagram}</p> : null}
          </div>
          <div>
            <h2 className="font-semibold text-ink">{t("location")}</h2>
            <p className="mt-2 text-ink">{business.addressLine ?? "—"}</p>
            <p className="mt-1 text-muted">
              {business.countryIso2 ? `${flagEmoji(business.countryIso2)} ` : ""}
              {city ? `${city.nameEn} / ${city.nameTr}` : "—"}, {business.currency}, {business.timezone}
            </p>
          </div>
          {owner ? (
            <div className="sm:col-span-2">
              <h2 className="font-semibold text-ink">{t("owner")}</h2>
              <p className="mt-2 text-ink">
                {owner.name} ({owner.email})
              </p>
              <p className="text-muted">
                {t("accountCreated", {
                  date: format.dateTime(owner.createdAt, { day: "numeric", month: "short", year: "numeric" }),
                })}
              </p>
            </div>
          ) : null}
        </section>

        {listings.map((l) => {
          const cover = l.media.find((m) => m.kind === "image");
          const price =
            l.pricingModel && l.pricingModel !== "custom_quote" && l.priceFrom
              ? `${formatMoney(l.priceFrom, l.currency, locale)} ${to(`priceSuffix.${l.pricingModel}`)}`
              : l.pricingModel
                ? to(`pricingModel.${l.pricingModel}`)
                : "—";
          return (
            <section key={l.id} className="space-y-4 rounded-2xl border border-line p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h2 className="font-heading text-xl font-bold text-ink">
                  {pickLocalized(locale, l.titleTr, l.titleEn).value || "—"}
                </h2>
                <StatusBadge status={l.status} isPublic={l.isPublic} />
              </div>
              {both(l.titleTr, l.titleEn)}
              {both(l.descriptionTr, l.descriptionEn)}
              {l.media.length ? (
                <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {l.media
                    .filter((m) => m.kind === "image")
                    .map((m) => (
                      <li key={m.id} className="aspect-[3/2] overflow-hidden rounded-lg bg-section">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={m.urlSmall ?? m.urlLarge ?? ""}
                          alt=""
                          className="size-full object-cover"
                          loading="lazy"
                        />
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">{t("noMedia")}</p>
              )}
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted">{t("price")}</dt>
                  <dd className="text-ink">
                    {price}
                    {l.depositPercent
                      ? `, ${tf("deposit")} ${format.number(l.depositPercent / 100, { style: "percent" })}`
                      : ""}
                  </dd>
                </div>
                {l.capacities.length ? (
                  <div>
                    <dt className="text-muted">{t("capacity")}</dt>
                    <dd className="text-ink">
                      {l.capacities.map((c) => `${to(`layout.${c.layout}`)} ${c.capacity}`).join(", ")}
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-muted">{t("events")}</dt>
                  <dd className="text-ink">{l.eventTypes.map(label).join(", ") || "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted">{t("amenities")}</dt>
                  <dd className="text-ink">{l.amenities.map(label).join(", ") || "—"}</dd>
                </div>
                {detailsOf(l).map((d) => (
                  <div key={d.label}>
                    <dt className="text-muted">{d.label}</dt>
                    <dd className="text-ink">{d.value}</dd>
                  </div>
                ))}
                <div className="sm:col-span-2">
                  <dt className="text-muted">{t("policy")}</dt>
                  <dd className="whitespace-pre-wrap text-ink">
                    {l.policy ? (locale === "tr" ? l.policy.termsTr : l.policy.termsEn) : "—"}
                  </dd>
                </div>
              </dl>
              <div className="max-w-sm">
                <p className="mb-2 text-sm font-semibold text-muted">{t("customerPreview")}</p>
                <ListingPreviewCard
                  data={{
                    titleTr: l.titleTr,
                    titleEn: l.titleEn,
                    businessNameTr: business.nameTr,
                    businessNameEn: business.nameEn,
                    coverUrl: cover?.urlMedium ?? cover?.urlSmall ?? null,
                    blurDataUrl: cover?.blurDataUrl,
                    cityNameTr: city?.nameTr ?? null,
                    cityNameEn: city?.nameEn ?? null,
                    countryIso2: business.countryIso2,
                    maxGuests: l.maxGuests,
                    pricingModel: l.pricingModel,
                    priceFrom: l.priceFrom,
                    currency: l.currency,
                    type: l.type,
                  }}
                />
              </div>
              {business.status === "approved" && l.status === "pending_review" ? (
                <div className="max-w-sm">
                  <ReviewActions target="listing" businessId={business.id} listingId={l.id} />
                </div>
              ) : null}
            </section>
          );
        })}
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        {business.status === "pending_review" ? (
          <div className="rounded-2xl border border-line p-5 shadow-card">
            <ReviewActions target="business" businessId={business.id} />
          </div>
        ) : (
          <div role="status" className="space-y-2 rounded-2xl border border-line p-5 text-sm">
            <StatusBadge status={business.status} />
            <p className="text-ink">{t("noActionNeeded")}</p>
            {business.rejectionReason || business.reviewNote ? (
              <p className="whitespace-pre-wrap text-muted">{business.rejectionReason ?? business.reviewNote}</p>
            ) : null}
          </div>
        )}
      </aside>
    </div>
  );
}
