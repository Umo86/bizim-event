import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { ReviewActions } from "@/components/admin/review-actions";
import { flagEmoji } from "@/lib/country";
import { pickLocalized } from "@/lib/utils";
import { adminDal } from "@/server/dal";
import { asLocale, requireAdminContext } from "@/server/page-helpers";

export default async function ApprovalsPage(props: PageProps<"/[locale]/admin/approvals">) {
  const t = await getTranslations("admin");
  return (
    <div className="space-y-12">
      <h1 className="text-3xl font-bold text-ink">{t("queueTitle")}</h1>
      <Suspense fallback={<QueueSkeleton />}>
        <Queue params={props.params} />
      </Suspense>
    </div>
  );
}

function QueueSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="h-7 w-56 animate-pulse rounded-lg bg-section" />
      <div className="h-24 animate-pulse rounded-2xl bg-section" />
      <div className="h-24 animate-pulse rounded-2xl bg-section" />
    </div>
  );
}

async function Queue({ params }: { params: PageProps<"/[locale]/admin/approvals">["params"] }) {
  const locale = asLocale((await params).locale);
  const ctx = await requireAdminContext();
  const { pendingBusinesses, pendingListings } = await adminDal.reviewQueue(ctx);
  const t = await getTranslations({ locale, namespace: "admin" });
  const tl = await getTranslations({ locale, namespace: "listingTypes" });
  const format = await getFormatter({ locale });
  const when = (d: Date | null) =>
    d
      ? format.dateTime(d, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
      : "—";

  return (
    <>
      <section>
        <h2 className="text-xl font-bold text-ink">
          {t("newBusinesses")} <span className="text-muted">({pendingBusinesses.length})</span>
        </h2>
        {pendingBusinesses.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-section p-6 text-muted">{t("emptyQueue")}</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {pendingBusinesses.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-line p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">
                    {pickLocalized(locale, b.nameTr, b.nameEn).value}{" "}
                    <span className="font-normal text-muted">({tl(b.type)})</span>
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {b.countryIso2 ? `${flagEmoji(b.countryIso2)} ` : ""}
                    {(locale === "tr" ? b.cityNameTr : b.cityNameEn) ?? "—"}
                    {", "}
                    {t("listingsCount", { count: b.listingCount })}
                    {", "}
                    {t("submitted", { date: when(b.submittedAt) })}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {t("owner")}: {b.ownerName} ({b.ownerEmail})
                  </p>
                </div>
                <Link href={`/admin/approvals/${b.id}`} className={buttonVariants({ variant: "primary", size: "sm" })}>
                  {t("review")}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-xl font-bold text-ink">
          {t("newListings")} <span className="text-muted">({pendingListings.length})</span>
        </h2>
        {pendingListings.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-section p-6 text-muted">{t("emptyQueue")}</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {pendingListings.map((l) => (
              <li key={l.id} className="grid gap-4 rounded-2xl border border-line p-4 md:grid-cols-[1fr_18rem]">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{pickLocalized(locale, l.titleTr, l.titleEn).value}</p>
                  <p className="mt-1 text-sm text-muted">
                    {pickLocalized(locale, l.businessNameTr, l.businessNameEn).value}
                    {", "}
                    {(locale === "tr" ? l.cityNameTr : l.cityNameEn) ?? "—"}
                    {", "}
                    {t("submitted", { date: when(l.submittedAt) })}
                  </p>
                  <Link
                    href={`/admin/approvals/${l.businessId}`}
                    className="mt-2 inline-block text-sm font-semibold text-primary-strong hover:underline"
                  >
                    {t("openBusiness")}
                  </Link>
                </div>
                <ReviewActions target="listing" businessId={l.businessId} listingId={l.id} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
