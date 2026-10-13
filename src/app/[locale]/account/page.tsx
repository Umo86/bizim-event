import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Link, redirect } from "@/i18n/navigation";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { PhotoBackdrop } from "@/components/cities/photo-backdrop";
import { buttonVariants } from "@/components/ui/button";
import { getSessionUser } from "@/server/session";
import { Card } from "@/components/ui/input";
import { backdrop } from "@/content/cities";
import { locale as rootLocale } from "next/root-params";

export async function generateMetadata() {
  const t = await getTranslations("account");
  return { title: t("title"), robots: { index: false } };
}

async function AccountDetails() {
  const user = await getSessionUser();
  const locale = (await rootLocale()) as "tr" | "en";
  if (!user) redirect({ href: "/sign-in", locale });
  const t = await getTranslations("account");
  const roles = await getTranslations("roles");
  const tc = await getTranslations("common");
  return (
    <Card>
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="mt-3 text-muted">{t("signedInAs", { email: user!.email })}</p>
      <p className="mt-1 text-muted">{t("role", { role: roles(user!.role) })}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        {user!.role === "customer" ? (
          <Link href="/list-your-business" className={buttonVariants({ variant: "outline", size: "sm" })}>
            {t("listBusiness")}
          </Link>
        ) : (
          <Link href="/business" className={buttonVariants({ variant: "primary", size: "sm" })}>
            {t("myBusinesses")}
          </Link>
        )}
        {user!.role === "admin" ? (
          <Link href="/admin/approvals" className={buttonVariants({ variant: "outline", size: "sm" })}>
            {tc("admin")}
          </Link>
        ) : null}
        <SignOutButton label={tc("logOut")} />
      </div>
      <p className="mt-6 rounded-lg bg-section p-3 text-sm text-muted">{t("phaseNote")}</p>
    </Card>
  );
}

export default function AccountPage() {
  return (
    <>
      <PhotoBackdrop backdrop={backdrop("account")} overlay="none" priority creditAt="top" className="h-48 sm:h-64" />
      <section className="relative mx-auto -mt-20 max-w-2xl px-4 pb-16 sm:-mt-28">
        <Suspense fallback={<Card className="h-48 animate-pulse" />}>
          <AccountDetails />
        </Suspense>
      </section>
    </>
  );
}
