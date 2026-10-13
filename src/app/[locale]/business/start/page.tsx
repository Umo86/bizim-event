import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { ChooseType } from "@/components/business/choose-type";
import { onPhotoText, PhotoBackdrop } from "@/components/cities/photo-backdrop";
import { backdrop } from "@/content/cities";
import { getSessionUser } from "@/server/session";
import { asLocale } from "@/server/page-helpers";

export async function generateMetadata(props: PageProps<"/[locale]/business/start">) {
  const { locale } = await props.params;
  const t = await getTranslations({ locale: asLocale(locale), namespace: "businessStart" });
  return { title: t("title"), robots: { index: false } };
}

export default async function BusinessStartPage(props: PageProps<"/[locale]/business/start">) {
  const { locale } = await props.params;
  const t = await getTranslations({ locale: asLocale(locale), namespace: "businessStart" });
  return (
    <>
      <PhotoBackdrop backdrop={backdrop("businessStart")} overlay="left" priority>
        <div className={`mx-auto max-w-5xl px-4 pb-16 pt-14 sm:px-6 sm:pb-20 sm:pt-20 ${onPhotoText}`}>
          <h1 className="text-3xl font-bold text-white sm:text-4xl">{t("title")}</h1>
          <p className="mt-3 max-w-2xl text-lg text-white">{t("intro")}</p>
        </div>
      </PhotoBackdrop>
      <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
        <Suspense fallback={<div className="h-56 animate-pulse rounded-2xl bg-section" />}>
          <StartGate locale={asLocale(locale)} />
        </Suspense>
      </section>
    </>
  );
}

async function StartGate({ locale }: { locale: "tr" | "en" }) {
  const user = await getSessionUser();
  if (user) return <ChooseType />;
  const t = await getTranslations({ locale, namespace: "businessStart" });
  const tc = await getTranslations({ locale, namespace: "common" });
  const next = encodeURIComponent(`/${locale}/business/start`);
  return (
    <div className="rounded-2xl bg-section p-6">
      <p className="text-ink">{t("signInFirst")}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link href={`/sign-up?next=${next}`} className={buttonVariants({ variant: "cta" })}>
          {tc("signUp")}
        </Link>
        <Link href={`/sign-in?next=${next}`} className={buttonVariants({ variant: "outline" })}>
          {tc("logIn")}
        </Link>
      </div>
    </div>
  );
}
