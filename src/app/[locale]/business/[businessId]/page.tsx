import { MapPin, Pencil } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { Notice, ProgressBar } from "@/components/ui/form";
import { BillingBanner } from "@/components/billing/billing-status";
import { AddListingButton } from "@/components/business/listing-actions";
import { StatusBadge } from "@/components/business/status-badge";
import { onPhotoText, PhotoBackdrop } from "@/components/cities/photo-backdrop";
import { featuredCityFor } from "@/content/cities";
import { WIZARD_STEPS, type ListingType } from "@/lib/listing-config";
import { pickLocalized } from "@/lib/utils";
import { billingDal, businessWrite } from "@/server/dal";
import { asLocale, loadOr404, requirePageContext } from "@/server/page-helpers";

export const metadata = { robots: { index: false } };

export default function BusinessOverviewPage(props: PageProps<"/[locale]/business/[businessId]">) {
  return (
    <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Suspense fallback={<div className="h-80 animate-pulse rounded-2xl bg-section" />}>
        <Overview {...props} />
      </Suspense>
    </section>
  );
}

async function Overview({ params, searchParams }: PageProps<"/[locale]/business/[businessId]">) {
  const { locale: raw, businessId } = await params;
  const sp = await searchParams;
  const locale = asLocale(raw);
  const ctx = await requirePageContext(locale, `/business/${businessId}`);
  const view = await loadOr404(() => businessWrite.getOwnerBusiness(ctx, businessId));
  const { business } = view;
  // Billing is the owner's: managers see the plain approval banner.
  const billing =
    view.role === "owner" && business.status === "approved" ? await billingDal.getBilling(ctx, businessId) : null;
  const t = await getTranslations({ locale, namespace: "businessOverview" });
  const tl = await getTranslations({ locale, namespace: "listingTypes" });
  const tw = await getTranslations({ locale, namespace: "wizard" });
  const le = await getTranslations({ locale, namespace: "listingEditor" });
  const format = await getFormatter({ locale });
  const name =
    pickLocalized(locale, business.nameTr, business.nameEn).value ||
    tw("newBusiness", { type: tl(business.type).toLocaleLowerCase(locale) });
  // Resume at the first step with something required still missing; optional steps are skipped.
  const firstOpenStep =
    WIZARD_STEPS.find((s) => view.completeness.missingRequired.some((m) => m.step === s)) ?? "review";
  const city = locale === "tr" ? view.city?.nameTr : view.city?.nameEn;
  const canAddListing = business.status !== "suspended" && business.status !== "rejected";
  // The business's city photo (or its country's best-known city) once an address is set.
  const pictured = featuredCityFor(view.city?.countryIso2 ?? business.countryIso2, view.city?.nameEn);
  const heading = (onPhoto: boolean) => (
    <>
      <div className={onPhoto ? `min-w-0 text-white ${onPhotoText}` : "min-w-0"}>
        <p className={onPhoto ? "text-sm" : "text-sm text-muted"}>{tl(business.type as ListingType)}</p>
        <h1 className={onPhoto ? "text-3xl font-bold sm:text-4xl" : "text-3xl font-bold text-ink"}>{name}</h1>
        {city ? (
          <p className={onPhoto ? "mt-1 flex items-center gap-1.5" : "mt-1 flex items-center gap-1.5 text-muted"}>
            <MapPin className="size-4" aria-hidden />
            {city}
          </p>
        ) : null}
      </div>
      <StatusBadge status={business.status} />
    </>
  );

  return (
    <div className="space-y-10">
      {pictured ? (
        <PhotoBackdrop
          as="header"
          backdrop={{ city: pictured, photo: pictured.photo }}
          overlay="left"
          priority
          creditAt="top"
          sizes="(min-width: 1024px) 976px, 100vw"
          className="rounded-2xl"
        >
          <div className="flex min-h-48 flex-wrap items-end justify-between gap-4 p-6 pt-12 sm:p-8 sm:pt-16">
            {heading(true)}
          </div>
        </PhotoBackdrop>
      ) : (
        <header className="flex flex-wrap items-start justify-between gap-4">{heading(false)}</header>
      )}

      {sp.submitted === "1" && business.status === "pending_review" ? (
        <Notice tone="success">{t("submittedBanner")}</Notice>
      ) : null}
      {business.status === "draft" ? (
        <div className="space-y-4 rounded-2xl border border-line p-5">
          <p className="text-ink">{t("draftBanner")}</p>
          <ProgressBar value={view.completeness.score} label={t("complete", { score: view.completeness.score })} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">{t("complete", { score: view.completeness.score })}</p>
            <Link
              href={`/business/${businessId}/setup/${firstOpenStep}`}
              className={buttonVariants({ variant: "cta" })}
            >
              {t("continueSetup")}
            </Link>
          </div>
        </div>
      ) : null}
      {business.status === "pending_review" && sp.submitted !== "1" ? <Notice>{t("pendingBanner")}</Notice> : null}
      {business.status === "changes_requested" ? (
        <Notice tone="warning">
          <strong className="block">{t("changesBanner")}</strong>
          <span className="mt-1 block whitespace-pre-wrap">{business.reviewNote}</span>
          <Link
            href={`/business/${businessId}/setup/review`}
            className={buttonVariants({ variant: "cta", size: "sm", className: "mt-3" })}
          >
            {t("makeChanges")}
          </Link>
        </Notice>
      ) : null}
      {business.status === "approved" && billing?.state ? (
        <BillingBanner
          state={billing.state}
          businessId={businessId}
          locale={locale}
          timeZone={business.timezone}
          approvedLabel={t("approvedBanner")}
        />
      ) : business.status === "approved" ? (
        <Notice tone="success">
          {view.subscription?.status === "trialing" && view.subscription.trialEndsAt
            ? t("approvedTrialBanner", {
                date: format.dateTime(view.subscription.trialEndsAt, {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  timeZone: business.timezone ?? undefined,
                }),
              })
            : t("approvedBanner")}
        </Notice>
      ) : null}
      {business.status === "rejected" ? (
        <Notice tone="danger">
          <strong className="block">{t("rejectedBanner")}</strong>
          <span className="mt-1 block whitespace-pre-wrap">{business.rejectionReason}</span>
        </Notice>
      ) : null}
      {business.status === "suspended" ? <Notice tone="danger">{t("suspendedBanner")}</Notice> : null}

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-ink">{t("listingsTitle")}</h2>
          {canAddListing ? <AddListingButton businessId={businessId} /> : null}
        </div>
        <ul className="mt-4 space-y-3">
          {view.listings.map((l) => {
            const title = pickLocalized(locale, l.titleTr, l.titleEn).value || le("untitled");
            return (
              <li key={l.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-line p-3 pr-4">
                <div className="h-16 w-24 shrink-0 overflow-hidden rounded-xl bg-section">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {l.coverUrl ? <img src={l.coverUrl} alt="" className="size-full object-cover" /> : null}
                </div>
                {/* min width so on phones the Edit button wraps below instead of squeezing the title */}
                <div className="min-w-40 flex-1">
                  <p className="truncate font-semibold text-ink">{title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <StatusBadge status={l.status} isPublic={l.isPublic} />
                    {l.completeness ? (
                      <span className="text-sm text-muted">{t("complete", { score: l.completeness.score })}</span>
                    ) : null}
                  </div>
                </div>
                <Link
                  href={`/business/${businessId}/listings/${l.id}/listing`}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  <Pencil className="size-4" aria-hidden />
                  {t("edit")}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-2xl border border-line p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-ink">{t("profileTitle")}</h2>
          <Link
            href={`/business/${businessId}/setup/info`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            {t("editProfile")}
          </Link>
        </div>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted">{t("address")}</dt>
            <dd className="mt-1 text-ink">{business.addressLine ?? t("noAddress")}</dd>
          </div>
          <div>
            <dt className="text-muted">{t("currency")}</dt>
            <dd className="mt-1 text-ink">{business.currency ?? "—"}</dd>
          </div>
        </dl>
      </section>

      <p className="text-sm text-muted">{t("comingNext")}</p>
    </div>
  );
}
