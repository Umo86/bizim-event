import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { allCountries } from "@/lib/countries-data";
import { trCollator, enCollator } from "@/lib/slug";
import { AccountMenu } from "./account-menu";
import { CountrySelect } from "./country-select";
import { LanguageSwitcher } from "./language-switcher";
import { Logo } from "./logo";

export async function SiteHeader() {
  const t = await getTranslations("common");
  const locale = (await getLocale()) as "tr" | "en";
  const collator = locale === "tr" ? trCollator : enCollator;
  const countryOptions = allCountries()
    .map((c) => ({ iso2: c.iso2, name: locale === "tr" ? c.nameTr : c.nameEn }))
    .sort((a, b) => collator.compare(a.name, b.name));

  const tabs = [
    { href: "/search?type=venue", label: t("venues") },
    { href: "/search?type=caterer", label: t("caterers") },
    { href: "/search?type=performer", label: t("performers") },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2"
      >
        {t("skipToContent")}
      </a>
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="shrink-0" aria-label={t("brand")}>
          <Logo />
        </Link>
        <nav aria-label="Primary" className="hidden flex-1 items-center gap-1 lg:flex">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-ink hover:bg-section"
            >
              {tab.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <div className="hidden md:block">
            <CountrySelect options={countryOptions} label={t("country")} />
          </div>
          <Suspense fallback={<div className="h-9 w-20" />}>
            <LanguageSwitcher label={t("language")} />
          </Suspense>
          <Link
            href="/list-your-business"
            className={buttonVariants({ variant: "cta", size: "sm", className: "hidden sm:inline-flex" })}
          >
            {t("listYourBusiness")}
          </Link>
          <AccountMenu
            labels={{ logIn: t("logIn"), signUp: t("signUp"), account: t("account"), logOut: t("logOut") }}
          />
        </div>
      </div>
      <nav aria-label="Categories" className="flex gap-1 overflow-x-auto border-t border-line px-4 py-2 lg:hidden">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className="shrink-0 rounded-full border border-line px-3 py-1.5 text-sm font-medium"
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
