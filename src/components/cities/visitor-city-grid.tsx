import { citiesForVisitor } from "@/content/cities";
import { visitorCountry } from "@/server/page-helpers";
import { CityGrid } from "./city-grid";

/**
 * City tiles ordered for this visitor: their country's cities first (from the
 * country cookie set by proxy.ts or the header picker). Reads a cookie, so render
 * it inside <Suspense> with <CityGridSkeleton>.
 */
export async function VisitorCityGrid({
  locale,
  exclude,
  featureFirst = true,
  showCta = true,
  type,
  limit = 12,
}: {
  locale: "tr" | "en";
  /** Leave out the city the page is already about. */
  exclude?: string;
  featureFirst?: boolean;
  showCta?: boolean;
  type?: string;
  limit?: number;
}) {
  const country = await visitorCountry();
  const cities = citiesForVisitor(country, limit + 1)
    .filter((c) => c.key !== exclude)
    .slice(0, limit);
  return <CityGrid cities={cities} locale={locale} featureFirst={featureFirst} showCta={showCta} type={type} />;
}
