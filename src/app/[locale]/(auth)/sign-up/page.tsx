import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  return { title: t("signUpTitle"), robots: { index: false } };
}

export default async function SignUpPage() {
  const t = await getTranslations("auth");
  const googleEnabled = !!process.env.GOOGLE_CLIENT_ID;
  return (
    <AuthShell photo="signUp" title={t("signUpTitle")}>
      <Suspense fallback={<div className="h-80 animate-pulse rounded-xl bg-section" />}>
        <AuthForm mode="sign-up" googleEnabled={googleEnabled} />
      </Suspense>
    </AuthShell>
  );
}
