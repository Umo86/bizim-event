import { Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/business/status-badge";
import { pickLocalized } from "@/lib/utils";
import { businessWrite } from "@/server/dal";
import { asLocale, requirePageContext } from "@/server/page-helpers";

export async function generateMetadata(props: PageProps<"/[locale]/business">) {
  const { locale } = await props.params;
  const t = await getTranslations({ locale: asLocale(locale), namespace: "businessList" });
  return { title: t("title"), robots: { index: false } };
}

export default function MyBusinessesPage(props: PageProps<"/[locale]/business">) {
  return (
    <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-section" />}>
        <MyBusinesses {...props} />
      </Suspense>
    </section>
  );
}

async function MyBusinesses({ params }: PageProps<"/[locale]/business">) {
  const locale = asLocale((await params).locale);
  const ctx = await requirePageContext(locale, "/business");
  const rows = await businessWrite.listMyBusinessesWithListings(ctx);
  const t = await getTranslations({ locale, namespace: "businessList" });
  const tl = await getTranslations({ locale, namespace: "listingTypes" });

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold text-ink">{t("title")}</h1>
        <Link href="/business/start" className={buttonVariants({ variant: "cta" })}>
          <Plus className="size-4" aria-hidden />
          {t("add")}
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="mt-10 rounded-2xl bg-section p-8 text-center text-muted">{t("empty")}</p>
      ) : (
        <ul className="mt-8 grid gap-4 md:grid-cols-2">
          {rows.map((b) => {
            const name =
              pickLocalized(locale, b.nameTr, b.nameEn).value ||
              t("untitled", { type: tl(b.type).toLocaleLowerCase(locale) });
            const city = locale === "tr" ? b.cityNameTr : b.cityNameEn;
            return (
              <li key={b.id}>
                <Link
                  href={`/business/${b.id}`}
                  className="block h-full rounded-2xl border border-line bg-white p-5 shadow-card hover:border-primary-strong"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-heading text-lg font-bold text-ink">{name}</p>
                      <p className="text-sm text-muted">
                        {tl(b.type)}
                        {city ? `, ${city}` : ""}
                      </p>
                    </div>
                    <StatusBadge status={b.status} />
                  </div>
                  <p className="mt-4 text-sm text-muted">
                    {t("listings", { count: b.listingCount })}
                    {b.liveCount ? ` — ${t("live", { count: b.liveCount })}` : ""}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
