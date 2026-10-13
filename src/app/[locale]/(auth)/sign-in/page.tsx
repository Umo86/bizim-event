import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-form";
import { Card } from "@/components/ui/input";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  return { title: t("signInTitle"), robots: { index: false } };
}

export default async function SignInPage() {
  const t = await getTranslations("auth");
  const googleEnabled = !!process.env.GOOGLE_CLIENT_ID;
  return (
    <section className="mx-auto max-w-md px-4 py-16">
      <Card>
        <h1 className="mb-6 text-2xl font-bold">{t("signInTitle")}</h1>
        <Suspense fallback={<div className="h-72 animate-pulse rounded-xl bg-section" />}>
          <AuthForm mode="sign-in" googleEnabled={googleEnabled} />
        </Suspense>
      </Card>
    </section>
  );
}
