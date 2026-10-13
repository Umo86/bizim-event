import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { BusinessInfoForm } from "@/components/business/forms/business-info-form";
import { CancellationForm } from "@/components/business/forms/cancellation-form";
import { DetailsForm } from "@/components/business/forms/details-form";
import { EventTypesForm } from "@/components/business/forms/event-types-form";
import { ListingBasicsForm } from "@/components/business/forms/listing-basics-form";
import { LocationForm } from "@/components/business/forms/location-form";
import { PhotosManager } from "@/components/business/forms/photos-manager";
import { PricingForm } from "@/components/business/forms/pricing-form";
import { SettingsForm } from "@/components/business/forms/settings-form";
import { ReviewStep } from "@/components/business/review-step";
import { StepHeading, WizardShell } from "@/components/business/wizard-shell";
import { ListingPreviewCard } from "@/components/listing/preview-card";
import { Notice } from "@/components/ui/form";
import { storage } from "@/lib/adapters/storage";
import { translationEnabled } from "@/lib/adapters/translate";
import { completedSteps } from "@/lib/completeness";
import { isWizardStep, MIN_PHOTOS, WIZARD_STEPS, type ListingType, type WizardStep } from "@/lib/listing-config";
import { pickLocalized } from "@/lib/utils";
import { formatPhone } from "@/lib/validation/common";
import { businessWrite, listingWrite } from "@/server/dal";
import {
  asLocale,
  countryOptions,
  currencyOptions,
  loadOr404,
  requirePageContext,
  timeZoneOptions,
  visitorCountry,
} from "@/server/page-helpers";

export async function generateMetadata(props: PageProps<"/[locale]/business/[businessId]/setup/[step]">) {
  const { step, locale } = await props.params;
  const t = await getTranslations({ locale: asLocale(locale), namespace: "wizard" });
  return { title: isWizardStep(step) ? t(`steps.${step}`) : undefined, robots: { index: false } };
}

export default function WizardStepPage(props: PageProps<"/[locale]/business/[businessId]/setup/[step]">) {
  return (
    <Suspense fallback={<div className="mx-auto h-[60vh] max-w-6xl animate-pulse px-4 py-12" />}>
      <WizardStepContent {...props} />
    </Suspense>
  );
}

async function WizardStepContent({ params }: PageProps<"/[locale]/business/[businessId]/setup/[step]">) {
  const { locale: rawLocale, businessId, step } = await params;
  if (!isWizardStep(step)) notFound();
  const locale = asLocale(rawLocale);
  const ctx = await requirePageContext(locale, `/business/${businessId}/setup/${step}`);
  const view = await loadOr404(() => businessWrite.getOwnerBusiness(ctx, businessId));
  const { business } = view;
  const t = await getTranslations({ locale, namespace: "wizard" });
  const tl = await getTranslations({ locale, namespace: "listingTypes" });
  const tbo = await getTranslations({ locale, namespace: "businessOverview" });
  const type = business.type as ListingType;

  const index = WIZARD_STEPS.indexOf(step);
  const href = (s: WizardStep | undefined) => (s ? `/business/${businessId}/setup/${s}` : null);
  const backHref = href(WIZARD_STEPS[index - 1]) ?? `/business/${businessId}`;
  const nextHref = href(WIZARD_STEPS[index + 1]);
  const translateEnabled = translationEnabled();
  const listingId = view.firstListingId;

  const needsListing = ["listing", "photos", "pricing", "event-types", "details", "cancellation", "review"].includes(
    step,
  );
  const data =
    needsListing && listingId ? await loadOr404(() => listingWrite.getListingEditorData(ctx, listingId)) : null;
  const options =
    data && ["listing", "event-types", "details"].includes(step)
      ? await listingWrite.listingFormOptions(ctx, type)
      : null;

  let body: React.ReactNode = null;
  switch (step) {
    case "info":
      body = (
        <BusinessInfoForm
          businessId={businessId}
          translateEnabled={translateEnabled}
          nextHref={nextHref!}
          logoUrl={business.logoUrl}
          phoneCountry={business.countryIso2 ?? (await visitorCountry())}
          initial={{
            nameTr: business.nameTr ?? "",
            nameEn: business.nameEn ?? "",
            descriptionTr: business.descriptionTr ?? "",
            descriptionEn: business.descriptionEn ?? "",
            phone: formatPhone(business.phoneE164),
            email: business.email ?? "",
            website: business.website ?? "",
            instagram: business.instagram ? `@${business.instagram}` : "",
          }}
        />
      );
      break;
    case "location":
      body = (
        <LocationForm
          businessId={businessId}
          savedAddress={business.addressLine}
          countryOptions={countryOptions(locale)}
          defaultCountry={business.countryIso2 ?? (await visitorCountry())}
          backHref={backHref}
          nextHref={nextHref!}
        />
      );
      break;
    case "currency":
      body = business.currency ? (
        <SettingsForm
          businessId={businessId}
          initial={{ currency: business.currency, timezone: business.timezone ?? "Europe/London" }}
          currencies={currencyOptions(locale)}
          timeZones={timeZoneOptions(business.timezone)}
          backHref={backHref}
          nextHref={nextHref!}
        />
      ) : (
        <Notice tone="warning">{tbo("noAddress")}</Notice>
      );
      break;
    case "listing":
      body =
        data && options ? (
          <ListingBasicsForm
            data={data}
            options={options}
            translateEnabled={translateEnabled}
            backHref={backHref}
            nextHref={nextHref}
          />
        ) : null;
      break;
    case "photos":
      body = data ? (
        <PhotosManager data={data} storageEnabled={storage().enabled} backHref={backHref} nextHref={nextHref} />
      ) : null;
      break;
    case "pricing":
      body = data ? <PricingForm data={data} backHref={backHref} nextHref={nextHref} /> : null;
      break;
    case "event-types":
      body =
        data && options ? (
          <EventTypesForm data={data} options={options} backHref={backHref} nextHref={nextHref} />
        ) : null;
      break;
    case "details":
      body =
        data && options ? (
          <DetailsForm
            data={data}
            options={options}
            countryOptions={countryOptions(locale)}
            backHref={backHref}
            nextHref={nextHref}
          />
        ) : null;
      break;
    case "cancellation":
      body = data ? (
        <CancellationForm
          data={data}
          policies={await listingWrite.listSystemCancellationPolicies(ctx)}
          translateEnabled={translateEnabled}
          backHref={backHref}
          nextHref={nextHref}
        />
      ) : null;
      break;
    case "review": {
      const cover = data?.media.find((m) => m.kind === "image");
      body = (
        <ReviewStep
          businessId={businessId}
          checks={view.completeness.checks}
          canSubmit={view.completeness.canSubmit}
          status={business.status}
          backHref={backHref}
          preview={
            data ? (
              <ListingPreviewCard
                data={{
                  titleTr: data.listing.titleTr,
                  titleEn: data.listing.titleEn,
                  businessNameTr: business.nameTr,
                  businessNameEn: business.nameEn,
                  coverUrl: cover?.urlMedium ?? cover?.urlSmall ?? null,
                  blurDataUrl: cover?.blurDataUrl,
                  cityNameTr: view.city?.nameTr ?? null,
                  cityNameEn: view.city?.nameEn ?? null,
                  countryIso2: business.countryIso2,
                  maxGuests: data.listing.maxGuests,
                  pricingModel: data.listing.pricingModel,
                  priceFrom: data.listing.priceFrom,
                  currency: data.listing.currency,
                  type,
                }}
              />
            ) : null
          }
        />
      );
      break;
    }
  }

  const intro =
    step === "listing"
      ? t(`intros.listing_${type}`)
      : step === "photos"
        ? t("intros.photos", { min: MIN_PHOTOS[type] })
        : t(`intros.${step}`);
  const name =
    pickLocalized(locale, business.nameTr, business.nameEn).value ||
    t("newBusiness", { type: tl(type).toLocaleLowerCase(locale) });

  return (
    <WizardShell
      businessId={businessId}
      businessName={name}
      current={step}
      done={[...completedSteps(view.completeness)]}
      score={view.completeness.score}
    >
      <StepHeading title={t(`steps.${step}`)} intro={intro} />
      {business.status === "changes_requested" && business.reviewNote ? (
        <Notice tone="warning" className="mb-8">
          <strong className="block">{tbo("changesBanner")}</strong>
          <span className="whitespace-pre-wrap">{business.reviewNote}</span>
        </Notice>
      ) : null}
      {body}
    </WizardShell>
  );
}
