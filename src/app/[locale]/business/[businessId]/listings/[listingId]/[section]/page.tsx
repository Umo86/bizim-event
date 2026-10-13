import { ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Link } from "@/i18n/navigation";
import { CancellationForm } from "@/components/business/forms/cancellation-form";
import { DetailsForm } from "@/components/business/forms/details-form";
import { EventTypesForm } from "@/components/business/forms/event-types-form";
import { ListingBasicsForm } from "@/components/business/forms/listing-basics-form";
import { PhotosManager } from "@/components/business/forms/photos-manager";
import { PricingForm } from "@/components/business/forms/pricing-form";
import { ListingEditorActions } from "@/components/business/listing-actions";
import { StatusBadge } from "@/components/business/status-badge";
import { Notice } from "@/components/ui/form";
import { storage } from "@/lib/adapters/storage";
import { translationEnabled } from "@/lib/adapters/translate";
import { isListingSection, LISTING_SECTIONS, type ListingSection, type ListingType } from "@/lib/listing-config";
import { cn, pickLocalized } from "@/lib/utils";
import { listingWrite } from "@/server/dal";
import { asLocale, countryOptions, loadOr404, requirePageContext } from "@/server/page-helpers";

export const metadata = { robots: { index: false } };

type Props = PageProps<"/[locale]/business/[businessId]/listings/[listingId]/[section]">;

export default function ListingEditorPage(props: Props) {
  return (
    <Suspense fallback={<div className="mx-auto h-[60vh] max-w-5xl animate-pulse px-4 py-12" />}>
      <Editor {...props} />
    </Suspense>
  );
}

async function Editor({ params }: Props) {
  const { locale: raw, businessId, listingId, section } = await params;
  if (!isListingSection(section)) notFound();
  const locale = asLocale(raw);
  const ctx = await requirePageContext(locale, `/business/${businessId}/listings/${listingId}/${section}`);
  const data = await loadOr404(() => listingWrite.getListingEditorData(ctx, listingId));
  if (data.listing.businessId !== businessId) notFound();
  const type = data.listing.type as ListingType;
  const t = await getTranslations({ locale, namespace: "listingEditor" });
  const tw = await getTranslations({ locale, namespace: "wizard" });
  const translateEnabled = translationEnabled();

  const index = LISTING_SECTIONS.indexOf(section);
  const href = (s: ListingSection | undefined) => (s ? `/business/${businessId}/listings/${listingId}/${s}` : null);
  const backHref = href(LISTING_SECTIONS[index - 1]);
  const nextHref = href(LISTING_SECTIONS[index + 1]);
  const nextLabel = nextHref ? undefined : tw("saveOnly");
  const options = ["listing", "event-types", "details"].includes(section)
    ? await listingWrite.listingFormOptions(ctx, type)
    : null;

  const common = { data, backHref, nextHref, nextLabel };
  const body = {
    listing: options ? <ListingBasicsForm {...common} options={options} translateEnabled={translateEnabled} /> : null,
    photos: <PhotosManager {...common} storageEnabled={storage().enabled} />,
    pricing: <PricingForm {...common} />,
    "event-types": options ? <EventTypesForm {...common} options={options} /> : null,
    details: options ? <DetailsForm {...common} options={options} countryOptions={countryOptions(locale)} /> : null,
    cancellation: (
      <CancellationForm
        {...common}
        policies={await listingWrite.listSystemCancellationPolicies(ctx)}
        translateEnabled={translateEnabled}
      />
    ),
  }[section];

  const title = pickLocalized(locale, data.listing.titleTr, data.listing.titleEn).value || t("untitled");
  const live = data.listing.status === "approved" && data.listing.isPublic;
  const canDelete =
    ["draft", "changes_requested", "rejected"].includes(data.listing.status) && data.business.status === "approved";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Link
        href={`/business/${businessId}`}
        className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-primary-strong hover:underline"
      >
        <ChevronLeft className="size-4" aria-hidden />
        {t("backToBusiness")}
      </Link>
      <header className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 id="step-title" className="text-2xl font-bold text-ink sm:text-3xl">
            {title}
          </h1>
          <div className="mt-2">
            <StatusBadge status={data.listing.status} isPublic={data.listing.isPublic} />
          </div>
        </div>
        <ListingEditorActions
          listingId={listingId}
          businessId={businessId}
          status={data.listing.status}
          businessStatus={data.business.status}
          canSubmit={data.completeness?.canSubmit ?? false}
          canDelete={canDelete}
        />
      </header>

      {data.listing.status === "changes_requested" && data.listing.reviewNote ? (
        <Notice tone="warning" className="mt-6">
          <strong className="block">{t("reviewNote")}</strong>
          <span className="whitespace-pre-wrap">{data.listing.reviewNote}</span>
        </Notice>
      ) : null}
      {live ? <Notice className="mt-6">{t("liveEditNote")}</Notice> : null}

      <nav aria-label={t("title")} className="mt-8 flex gap-1 overflow-x-auto border-b border-line">
        {LISTING_SECTIONS.map((s) => (
          <Link
            key={s}
            href={`/business/${businessId}/listings/${listingId}/${s}`}
            aria-current={s === section ? "page" : undefined}
            className={cn(
              "shrink-0 border-b-2 px-3 py-3 text-sm font-semibold",
              s === section
                ? "border-primary-strong text-primary-deeper"
                : "border-transparent text-muted hover:text-ink",
            )}
          >
            {tw(`steps.${s}`)}
          </Link>
        ))}
      </nav>
      <div className="pt-8">{body}</div>
    </div>
  );
}
