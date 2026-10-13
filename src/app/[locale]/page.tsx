import { getLocale, getTranslations } from "next-intl/server";
import { Search } from "lucide-react";
import { Suspense } from "react";
import { Link } from "@/i18n/navigation";
import { CityGridSkeleton, CityPhotoCredits } from "@/components/cities/city-grid";
import { onPhotoText, PhotoBackdrop } from "@/components/cities/photo-backdrop";
import { VisitorCityGrid } from "@/components/cities/visitor-city-grid";
import { buttonVariants } from "@/components/ui/button";
import { backdrop } from "@/content/cities";

/**
 * Homepage: hero search, city photo tiles (ordered for the visitor's country) and the
 * business trial banner. The rest of the Tagvenue-style homepage (live counts,
 * category rows) arrives with search in Phase 4.
 */
export default async function HomePage() {
  const locale = (await getLocale()) as "tr" | "en";
  const t = await getTranslations("home");
  const tc = await getTranslations("common");
  const tci = await getTranslations("cities");

  return (
    <>
      <PhotoBackdrop backdrop={backdrop("homeHero")} overlay="left" priority>
        <div className="mx-auto max-w-7xl px-4 pb-24 pt-20 sm:px-6 sm:pb-32 sm:pt-28">
          <h1 className={`max-w-3xl text-4xl font-extrabold leading-tight text-white sm:text-5xl ${onPhotoText}`}>
            {t("heroTitle")}
          </h1>
          <p className={`mt-4 max-w-2xl text-lg text-white ${onPhotoText}`}>{t("heroSubtitle")}</p>

          <form
            action={`/${locale}/search`}
            method="get"
            className="mt-10 grid gap-2 rounded-2xl bg-white p-2 shadow-card sm:grid-cols-2 lg:grid-cols-[1fr_1fr_0.7fr_1.4fr_auto]"
          >
            <label className="flex flex-col rounded-xl px-3 py-2 hover:bg-section">
              <span className="text-xs font-semibold text-muted">{t("whatYouNeed")}</span>
              <select name="type" className="bg-transparent text-ink outline-none" defaultValue="venue">
                <option value="venue">{tc("venues")}</option>
                <option value="caterer">{tc("caterers")}</option>
                <option value="performer">{tc("performers")}</option>
              </select>
            </label>
            <label className="flex flex-col rounded-xl px-3 py-2 hover:bg-section">
              <span className="text-xs font-semibold text-muted">{t("eventType")}</span>
              <input
                name="event"
                className="bg-transparent text-ink outline-none"
                placeholder={t("eventTypePlaceholder")}
              />
            </label>
            <label className="flex flex-col rounded-xl px-3 py-2 hover:bg-section">
              <span className="text-xs font-semibold text-muted">{t("guests")}</span>
              <input
                name="guests"
                type="number"
                min={1}
                inputMode="numeric"
                className="bg-transparent text-ink outline-none"
                placeholder={t("guestsPlaceholder")}
              />
            </label>
            <label className="flex flex-col rounded-xl px-3 py-2 hover:bg-section">
              <span className="text-xs font-semibold text-muted">{t("location")}</span>
              <input
                name="place"
                className="bg-transparent text-ink outline-none"
                placeholder={t("locationPlaceholder")}
              />
            </label>
            <button type="submit" className={buttonVariants({ variant: "cta", size: "lg" })}>
              <Search className="size-5" aria-hidden />
              {t("searchButton")}
            </button>
          </form>
          <p className={`mt-3 text-sm text-white ${onPhotoText}`}>{t("phaseNote")}</p>
        </div>
      </PhotoBackdrop>

      <section aria-labelledby="cities-title" className="mx-auto max-w-7xl px-4 pt-16 sm:px-6">
        <div className="max-w-2xl">
          <h2 id="cities-title" className="text-3xl font-bold text-ink sm:text-4xl">
            {tci("title")}
          </h2>
          <p className="mt-3 text-lg text-muted">{tci("intro")}</p>
        </div>
        <Suspense fallback={<CityGridSkeleton />}>
          <VisitorCityGrid locale={locale} />
        </Suspense>
        <CityPhotoCredits locale={locale} />
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <PhotoBackdrop
          as="div"
          backdrop={backdrop("homeBusiness")}
          overlay="left"
          sizes="(min-width: 1280px) 1232px, 100vw"
          className="rounded-2xl"
        >
          <div className="flex flex-col items-start justify-between gap-6 px-8 pb-12 pt-10 sm:flex-row sm:items-center sm:py-14">
            <h2 className={`max-w-xl text-2xl font-bold text-white sm:text-3xl ${onPhotoText}`}>{t("trialBanner")}</h2>
            <Link href="/list-your-business" className={buttonVariants({ variant: "cta", size: "lg" })}>
              {t("trialBannerCta")}
            </Link>
          </div>
        </PhotoBackdrop>
      </section>
    </>
  );
}
