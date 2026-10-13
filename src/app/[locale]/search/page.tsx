import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Link } from "@/i18n/navigation";
import { CityGridSkeleton, CityPhotoCredits } from "@/components/cities/city-grid";
import { onPhotoText, PhotoBackdrop } from "@/components/cities/photo-backdrop";
import { VisitorCityGrid } from "@/components/cities/visitor-city-grid";
import { buttonVariants } from "@/components/ui/button";
import { citiesForVisitor, findFeaturedCity, type FeaturedCity } from "@/content/cities";
import { asLocale, visitorCountry } from "@/server/page-helpers";

/**
 * Interim search page. Search itself (PostGIS, filters, map) lands in Phase 4; until
 * then the header tabs, the hero form and the city tiles land here instead of a 404:
 * the chosen city's photo, a "coming soon" note, a call to businesses and more cities.
 */

const TYPES = ["venue", "caterer", "performer"] as const;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export async function generateMetadata(props: PageProps<"/[locale]/search">) {
  const { locale } = await props.params;
  const t = await getTranslations({ locale: asLocale(locale), namespace: "search" });
  // Nothing to index until real results exist.
  return { title: t("metaTitle"), robots: { index: false, follow: true } };
}

export default function SearchPage(props: PageProps<"/[locale]/search">) {
  return (
    <Suspense fallback={<SearchSkeleton />}>
      <SearchComingSoon {...props} />
    </Suspense>
  );
}

async function SearchComingSoon({ params, searchParams }: PageProps<"/[locale]/search">) {
  const locale = asLocale((await params).locale);
  const sp = await searchParams;
  const typeParam = first(sp.type);
  const type = TYPES.find((x) => x === typeParam);
  const city = findFeaturedCity({ key: first(sp.city), country: first(sp.country), text: first(sp.place) });
  const t = await getTranslations({ locale, namespace: "search" });
  const tc = await getTranslations({ locale, namespace: "common" });
  const title = city
    ? t("titleInCity", { type: type ?? "other", city: locale === "tr" ? city.inTr : city.en })
    : t("title", { type: type ?? "other" });

  // No city chosen: picture the visitor's own city (from the country cookie) instead.
  const pictured = city ?? citiesForVisitor(await visitorCountry(), 1)[0];

  return (
    <>
      <CityBanner
        city={pictured}
        title={title}
        tagline={city ? (locale === "tr" ? city.taglineTr : city.taglineEn) : null}
      />

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <section className="rounded-2xl border border-line p-6 sm:p-8">
            <h2 className="text-2xl font-bold text-ink">{t("soonTitle")}</h2>
            <p className="mt-3 max-w-prose text-muted">{t("soonBody")}</p>
          </section>
          <section className="rounded-2xl bg-primary-soft p-6 sm:p-8">
            <h2 className="text-xl font-bold text-ink">{t("businessTitle")}</h2>
            <p className="mt-2 text-ink">{t("businessBody")}</p>
            <Link href="/list-your-business" className={buttonVariants({ variant: "cta", className: "mt-5" })}>
              {tc("listYourBusiness")}
            </Link>
          </section>
        </div>

        <section aria-labelledby="more-cities" className="mt-14">
          <h2 id="more-cities" className="text-2xl font-bold text-ink">
            {city ? t("otherCities") : t("browseCities")}
          </h2>
          <Suspense fallback={<CityGridSkeleton count={8} featureFirst={false} showCta={false} />}>
            <VisitorCityGrid
              locale={locale}
              exclude={city?.key}
              featureFirst={false}
              showCta={false}
              type={type}
              limit={8}
            />
          </Suspense>
          <CityPhotoCredits locale={locale} />
        </section>
      </div>
    </>
  );
}

function CityBanner({ city, title, tagline }: { city: FeaturedCity; title: string; tagline: string | null }) {
  return (
    <PhotoBackdrop backdrop={{ city, photo: city.photo }} overlay="bottom" priority>
      <div
        className={`mx-auto flex min-h-72 max-w-7xl flex-col justify-end px-4 pb-12 pt-24 sm:min-h-96 sm:px-6 ${onPhotoText}`}
      >
        <h1 className="max-w-3xl text-3xl font-extrabold leading-tight text-white sm:text-5xl">{title}</h1>
        {tagline ? <p className="mt-3 max-w-2xl text-lg text-white">{tagline}</p> : null}
      </div>
    </PhotoBackdrop>
  );
}

function SearchSkeleton() {
  return (
    <div aria-hidden>
      <div className="h-72 bg-primary-deeper sm:h-96" />
      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-12 sm:px-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="h-40 rounded-2xl bg-section motion-safe:animate-pulse" />
        <div className="h-40 rounded-2xl bg-section motion-safe:animate-pulse" />
      </div>
    </div>
  );
}
