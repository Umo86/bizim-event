import { getTranslations } from "next-intl/server";
import { Search } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";

/**
 * Phase 0 homepage: brand, hero search shell and the business trial banner.
 * The full Tagvenue-style homepage (photo slideshow, city tiles, live counts,
 * category rows) is built in Phase 4 on top of the seeded data.
 */
export default async function HomePage() {
  const t = await getTranslations("home");
  const tc = await getTranslations("common");

  return (
    <>
      <section className="relative isolate overflow-hidden bg-gradient-to-br from-primary-deeper via-primary-strong to-primary">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
          <h1 className="max-w-3xl text-4xl font-extrabold leading-tight text-white sm:text-5xl">{t("heroTitle")}</h1>
          <p className="mt-4 max-w-2xl text-lg text-white/90">{t("heroSubtitle")}</p>

          <form
            action="search"
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
          <p className="mt-3 text-sm text-white/80">{t("phaseNote")}</p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="flex flex-col items-start justify-between gap-6 rounded-2xl bg-primary-soft p-8 sm:flex-row sm:items-center">
          <h2 className="text-2xl font-bold text-ink">{t("trialBanner")}</h2>
          <Link href="/list-your-business" className={buttonVariants({ variant: "cta", size: "lg" })}>
            {t("trialBannerCta")}
          </Link>
        </div>
      </section>
    </>
  );
}
