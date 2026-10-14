import { onPhotoText, PhotoBackdrop } from "@/components/cities/photo-backdrop";
import { backdrop, type BackdropKey } from "@/content/cities";

/** City-photo banner with the page title, as on the pricing page. */
export function PageHero({ photo, title, intro }: { photo: BackdropKey; title: string; intro?: string }) {
  return (
    <PhotoBackdrop backdrop={backdrop(photo)} overlay="left" priority>
      <div className={`mx-auto max-w-7xl px-4 pb-16 pt-14 sm:px-6 sm:pb-20 sm:pt-20 ${onPhotoText}`}>
        <h1 className="max-w-2xl text-4xl font-extrabold leading-tight text-white sm:text-5xl">{title}</h1>
        {intro ? <p className="mt-4 max-w-xl text-lg text-white">{intro}</p> : null}
      </div>
    </PhotoBackdrop>
  );
}
