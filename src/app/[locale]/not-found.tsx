import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { onPhotoText, PhotoBackdrop } from "@/components/cities/photo-backdrop";
import { buttonVariants } from "@/components/ui/button";
import { backdrop } from "@/content/cities";

export default async function NotFound() {
  const t = await getTranslations("errors");
  return (
    <PhotoBackdrop backdrop={backdrop("notFound")} overlay="even" priority>
      <div className={`mx-auto max-w-xl px-4 pb-32 pt-28 text-center text-white ${onPhotoText}`}>
        <h1 className="text-4xl font-bold">{t("notFoundTitle")}</h1>
        <p className="mt-3 text-lg">{t("notFoundBody")}</p>
        <Link href="/" className={buttonVariants({ variant: "cta", size: "lg", className: "mt-8" })}>
          {t("goHome")}
        </Link>
      </div>
    </PhotoBackdrop>
  );
}
