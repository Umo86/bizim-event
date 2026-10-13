import "@fontsource-variable/inter";
import "@fontsource-variable/plus-jakarta-sans";
import "../globals.css";
import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { isLocale, locales } from "@/i18n/routing";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await rootLocale();
  const t = await getTranslations({ locale: isLocale(locale) ? locale : "tr", namespace: "meta" });
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return {
    metadataBase: new URL(base),
    title: { default: t("title"), template: "%s · Bizim Event" },
    description: t("description"),
    alternates: { languages: { tr: "/tr", en: "/en", "x-default": "/tr" } },
    openGraph: { siteName: "Bizim Event", type: "website", locale: locale === "en" ? "en_GB" : "tr_TR" },
  };
}

export const viewport: Viewport = {
  themeColor: "#0E9AA7",
  width: "device-width",
  initialScale: 1,
};

export default async function LocaleLayout({ children }: LayoutProps<"/[locale]">) {
  const locale = await rootLocale();
  if (!isLocale(locale)) notFound();

  return (
    <html lang={locale}>
      <body className="min-h-dvh">
        <NextIntlClientProvider>
          <SiteHeader />
          <main id="main">{children}</main>
          <SiteFooter />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
