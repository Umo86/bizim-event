import { getRequestConfig } from "next-intl/server";
import { locale as rootLocale } from "next/root-params";
import { defaultLocale, isLocale } from "./routing";

export default getRequestConfig(async ({ locale: override }) => {
  // An explicit locale (e.g. getTranslations({ locale })) wins; otherwise read the
  // [locale] root segment. Outside the segment (route handlers, emails) fall back.
  let candidate: string | undefined = override;
  if (!candidate) {
    try {
      candidate = await rootLocale();
    } catch {
      candidate = undefined;
    }
  }
  const locale = isLocale(candidate) ? candidate : defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    timeZone: "Europe/London",
    formats: {
      dateTime: {
        short: { day: "2-digit", month: "2-digit", year: "numeric" },
        medium: { day: "numeric", month: "short", year: "numeric" },
      },
    },
  };
});
