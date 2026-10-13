import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { redirect } from "@/i18n/navigation";
import { getSessionUser } from "@/server/session";
import { Card } from "@/components/ui/input";
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
  return (
    <Card>
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="mt-3 text-muted">{t("signedInAs", { email: user!.email })}</p>
      <p className="mt-1 text-muted">{t("role", { role: roles(user!.role) })}</p>
      <p className="mt-6 rounded-lg bg-section p-3 text-sm text-muted">{t("phaseNote")}</p>
    </Card>
  );
}

export default function AccountPage() {
  return (
    <section className="mx-auto max-w-2xl px-4 py-16">
      <Suspense fallback={<Card className="h-48 animate-pulse" />}>
        <AccountDetails />
      </Suspense>
    </section>
  );
}
