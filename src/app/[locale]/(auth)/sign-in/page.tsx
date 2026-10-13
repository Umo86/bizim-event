import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  return { title: t("signInTitle"), robots: { index: false } };
}

export default async function SignInPage() {
  const t = await getTranslations("auth");
  const googleEnabled = !!process.env.GOOGLE_CLIENT_ID;
  return (
    <AuthShell photo="signIn" title={t("signInTitle")}>
      <Suspense fallback={<div className="h-72 animate-pulse rounded-xl bg-section" />}>
        <AuthForm mode="sign-in" googleEnabled={googleEnabled} />
      </Suspense>
    </AuthShell>
  );
}
