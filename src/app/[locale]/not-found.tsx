import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";

export default async function NotFound() {
  const t = await getTranslations("errors");
  return (
    <section className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="text-3xl font-bold">{t("notFoundTitle")}</h1>
      <p className="mt-3 text-muted">{t("notFoundBody")}</p>
      <Link href="/" className={buttonVariants({ variant: "primary" }) + " mt-8"}>
        {t("goHome")}
      </Link>
    </section>
  );
}
