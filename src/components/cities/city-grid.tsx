import { getTranslations } from "next-intl/server";
import { preconnect } from "react-dom";
import { Link } from "@/i18n/navigation";
import { FEATURED_CITIES, type FeaturedCity } from "@/content/cities";
import { allCountries } from "@/lib/countries-data";
import { unsplashImage, unsplashProfileUrl, unsplashSrcSet, UNSPLASH_URL } from "@/lib/unsplash";
import { cn } from "@/lib/utils";

type Locale = "tr" | "en";

const focusRing =
  "focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary-strong";

/*
 * One list, two layouts: a swipeable row on phones; from `sm` a grid where the first
 * city can take a 2×2 block. Rows have fixed heights so spans line up without
 * aspect-ratio maths; photos fill each cell with object-cover.
 */
const listClass = cn(
  "-mx-4 mt-8 grid snap-x snap-mandatory scroll-px-4 grid-flow-col auto-cols-[78%] grid-rows-[13rem] gap-3 overflow-x-auto overscroll-x-contain px-4 pb-3",
  "sm:mx-0 sm:auto-cols-auto sm:grid-flow-row sm:grid-cols-2 sm:grid-rows-none sm:auto-rows-[12rem] sm:overflow-visible sm:px-0 sm:pb-0",
  "lg:grid-cols-4 lg:auto-rows-[13rem] lg:gap-4",
);

export function cityHref(city: FeaturedCity, type?: string) {
  return {
    pathname: "/search",
    query: { country: city.country.toLowerCase(), city: city.key, ...(type ? { type } : {}) },
  };
}

export async function CityGrid({
  cities,
  locale,
  featureFirst = true,
  showCta = true,
  type,
}: {
  cities: FeaturedCity[];
  locale: Locale;
  /** The first city gets a 2×2 tile with its tagline. */
  featureFirst?: boolean;
  /** Closing tile inviting businesses from cities we don't feature yet. */
  showCta?: boolean;
  /** Keeps a chosen category (venue / caterer / performer) in the city links. */
  type?: string;
}) {
  preconnect("https://images.unsplash.com");
  const t = await getTranslations({ locale, namespace: "cities" });
  const countryName = new Map(allCountries().map((c) => [c.iso2, locale === "tr" ? c.nameTr : c.nameEn]));

  return (
    <ul className={listClass}>
      {cities.map((city, i) => {
        const feature = featureFirst && i === 0;
        return (
          <li key={city.key} className={cn("snap-start", feature && "sm:col-span-2 sm:row-span-2")}>
            <Link
              href={cityHref(city, type)}
              className={cn("group relative block h-full overflow-hidden rounded-2xl bg-primary-deeper", focusRing)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- Unsplash's CDN resizes; srcset below */}
              <img
                src={unsplashImage(city.photo.id, feature ? 1200 : 800)}
                srcSet={unsplashSrcSet(city.photo.id)}
                sizes={
                  feature
                    ? "(min-width: 1280px) 616px, (min-width: 640px) 50vw, 78vw"
                    : "(min-width: 1280px) 300px, (min-width: 1024px) 25vw, (min-width: 640px) 50vw, 78vw"
                }
                alt=""
                loading="lazy"
                decoding="async"
                style={city.photo.focus ? { objectPosition: city.photo.focus } : undefined}
                className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
              />
              <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/0" />
              <span
                className={cn("absolute inset-x-0 bottom-0 flex flex-col text-white", feature ? "p-6 sm:p-8" : "p-4")}
              >
                <span
                  className={cn(
                    "font-heading font-bold leading-tight decoration-2 underline-offset-4 group-hover:underline",
                    feature ? "text-3xl sm:text-5xl" : "text-2xl",
                  )}
                >
                  {locale === "tr" ? city.tr : city.en}
                </span>
                <span className={cn("text-white/90", feature ? "mt-1 text-base" : "text-sm")}>
                  {countryName.get(city.country) ?? city.country}
                </span>
                {feature ? (
                  <span className="mt-3 hidden max-w-md text-lg leading-snug sm:block">
                    {locale === "tr" ? city.taglineTr : city.taglineEn}
                  </span>
                ) : null}
              </span>
            </Link>
          </li>
        );
      })}
      {showCta ? (
        <li className="snap-start">
          <Link
            href="/list-your-business"
            className={cn(
              "flex h-full flex-col justify-between gap-4 rounded-2xl bg-primary-strong p-5 text-white transition-colors hover:bg-primary-deeper",
              focusRing,
            )}
          >
            <span className="font-heading text-2xl font-bold leading-tight">{t("ctaTitle")}</span>
            <span className="text-sm font-medium">{t("ctaBody")}</span>
          </Link>
        </li>
      ) : null}
    </ul>
  );
}

/** Same footprint as the grid, so nothing jumps when the visitor's cities stream in. */
export function CityGridSkeleton({
  count = 12,
  featureFirst = true,
  showCta = true,
}: {
  count?: number;
  featureFirst?: boolean;
  showCta?: boolean;
}) {
  return (
    <ul className={listClass} aria-hidden>
      {Array.from({ length: count + (showCta ? 1 : 0) }, (_, i) => (
        <li
          key={i}
          className={cn(
            "snap-start rounded-2xl bg-section motion-safe:animate-pulse",
            featureFirst && i === 0 && "sm:col-span-2 sm:row-span-2",
          )}
        />
      ))}
    </ul>
  );
}

/** Credits every photographer whose photo appears in the city tiles. */
export async function CityPhotoCredits({
  locale,
  cities = FEATURED_CITIES,
}: {
  locale: Locale;
  cities?: readonly FeaturedCity[];
}) {
  const t = await getTranslations({ locale, namespace: "cities" });
  const people = [...new Map(cities.map((c) => [c.photo.username, c.photo])).values()];
  return (
    <p className="mt-4 text-xs leading-relaxed text-muted">
      {t("photoCredits")}{" "}
      {people.map((p, i) => (
        <span key={p.username}>
          <a
            href={unsplashProfileUrl(p.username)}
            className="underline-offset-2 hover:underline"
            rel="noreferrer"
            target="_blank"
          >
            {p.by}
          </a>
          {i < people.length - 1 ? ", " : " "}
        </span>
      ))}
      (
      <a href={UNSPLASH_URL} className="underline-offset-2 hover:underline" rel="noreferrer" target="_blank">
        Unsplash
      </a>
      )
    </p>
  );
}
