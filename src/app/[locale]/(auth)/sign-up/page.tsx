import { getTranslations } from "next-intl/server";
import { AuthForm } from "@/components/auth/auth-form";
import { Card } from "@/components/ui/input";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  return { title: t("signUpTitle"), robots: { index: false } };
}

export default async function SignUpPage() {
  const t = await getTranslations("auth");
  const googleEnabled = !!process.env.GOOGLE_CLIENT_ID;
  return (
    <section className="mx-auto max-w-md px-4 py-16">
      <Card>
        <h1 className="mb-6 text-2xl font-bold">{t("signUpTitle")}</h1>
        <AuthForm mode="sign-up" googleEnabled={googleEnabled} />
      </Card>
    </section>
  );
}
