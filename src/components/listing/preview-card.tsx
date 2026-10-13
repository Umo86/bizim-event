import { MapPin, Users } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { flagEmoji } from "@/lib/country";
import { formatMoney, pickLocalized } from "@/lib/utils";

export type PreviewCardData = {
  titleTr: string | null;
  titleEn: string | null;
  businessNameTr: string | null;
  businessNameEn: string | null;
  coverUrl: string | null;
  blurDataUrl?: string | null;
  cityNameTr: string | null;
  cityNameEn: string | null;
  countryIso2: string | null;
  maxGuests: number | null;
  pricingModel: string | null;
  priceFrom: number | null;
  currency: string;
  type: "venue" | "caterer" | "performer";
};

/**
 * The listing card customers will see in search (Tagvenue-style: big 3:2 photo,
 * title, place, capacity, price line). Used for previews in the wizard and admin.
 */
export function ListingPreviewCard({ data }: { data: PreviewCardData }) {
  const locale = useLocale() as "tr" | "en";
  const to = useTranslations("options");
  const tl = useTranslations("listingTypes");
  const tr = useTranslations("review");
  const fields = useTranslations("fields");
  const title = pickLocalized(locale, data.titleTr, data.titleEn).value;
  const business = pickLocalized(locale, data.businessNameTr, data.businessNameEn).value;
  const city = locale === "tr" ? data.cityNameTr : data.cityNameEn;
  const price =
    data.pricingModel && data.pricingModel !== "custom_quote" && data.priceFrom
      ? `${formatMoney(data.priceFrom, data.currency, locale)} ${to(`priceSuffix.${data.pricingModel}`)}`
      : data.pricingModel
        ? to("priceSuffix.custom_quote")
        : null;

  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
      <div
        className="relative aspect-[3/2] bg-gradient-to-br from-primary-soft to-section bg-cover bg-center"
        style={data.blurDataUrl ? { backgroundImage: `url(${data.blurDataUrl})` } : undefined}
      >
        {data.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.coverUrl} alt={title} className="size-full object-cover" loading="lazy" />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-sm text-muted">{tr("noPhoto")}</span>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-ink">
          {tl(data.type)}
        </span>
      </div>
      <div className="space-y-1.5 p-4">
        <h3 className="line-clamp-2 font-heading text-lg font-bold leading-snug text-ink">{title || "—"}</h3>
        {business && business !== title ? <p className="text-sm text-muted">{business}</p> : null}
        {city ? (
          <p className="flex items-center gap-1.5 text-sm text-muted">
            <MapPin className="size-4" aria-hidden />
            {city}
            {data.countryIso2 ? <span aria-hidden>{flagEmoji(data.countryIso2)}</span> : null}
          </p>
        ) : null}
        {data.maxGuests ? (
          <p className="flex items-center gap-1.5 text-sm text-muted">
            <Users className="size-4" aria-hidden />
            {data.maxGuests} {fields("guests")}
          </p>
        ) : null}
        {price ? <p className="pt-1 font-semibold text-ink">{price}</p> : null}
      </div>
    </article>
  );
}
