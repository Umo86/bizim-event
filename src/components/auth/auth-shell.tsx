import { getTranslations } from "next-intl/server";
import { onPhotoText, PhotoBackdrop } from "@/components/cities/photo-backdrop";
import { Card } from "@/components/ui/input";
import { backdrop, type BackdropKey } from "@/content/cities";

/** Sign-in / sign-up frame: a city photo beside the form (a short band above it on phones). */
export async function AuthShell({
  photo,
  title,
  children,
}: {
  photo: BackdropKey;
  title: string;
  children: React.ReactNode;
}) {
  const t = await getTranslations("auth");
  return (
    <section className="lg:grid lg:min-h-[calc(100vh-4rem)] lg:grid-cols-2">
      <PhotoBackdrop
        as="div"
        backdrop={backdrop(photo)}
        overlay="bottom"
        priority
        sizes="(min-width: 1024px) 50vw, 100vw"
        className="h-40 sm:h-56 lg:h-auto"
      >
        <div className={`hidden h-full flex-col justify-end p-10 pb-14 lg:flex ${onPhotoText}`}>
          <p className="max-w-md font-heading text-3xl font-bold leading-tight text-white">{t("panelTitle")}</p>
          <p className="mt-3 max-w-md text-lg text-white">{t("panelBody")}</p>
        </div>
      </PhotoBackdrop>
      <div className="mx-auto w-full max-w-md px-4 py-12 lg:self-center">
        <Card>
          <h1 className="mb-6 text-2xl font-bold">{title}</h1>
          {children}
        </Card>
      </div>
    </section>
  );
}
