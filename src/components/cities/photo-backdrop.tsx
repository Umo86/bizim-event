import { getLocale, getTranslations } from "next-intl/server";
import { preconnect } from "react-dom";
import type { Backdrop } from "@/content/cities";
import { unsplashImage, unsplashPhotoUrl } from "@/lib/unsplash";
import { cn } from "@/lib/utils";

/*
 * Tints keep white text at 4.5:1 or better over any photo (85% turquoise or more
 * behind body text); the photo shows through where there's no text.
 */
const OVERLAYS = {
  /**
   * Text on the left, photo visible on the right (desktop). On phones the text runs
   * full width, so the tint is strongest at the top and eases off towards the bottom.
   */
  left: "bg-gradient-to-b from-primary-deeper/90 via-primary-deeper/80 to-primary-deeper/60 sm:bg-gradient-to-r sm:from-primary-deeper/95 sm:via-primary-deeper/85 sm:via-60% sm:to-primary-deeper/25",
  /** Text centred or spread across the banner. */
  even: "bg-primary-deeper/85",
  /** Text sitting at the bottom edge. */
  bottom: "bg-gradient-to-t from-black/85 via-black/45 to-black/10",
  /** Nothing on top of the photo. */
  none: "bg-black/10",
} as const;

const WIDTHS = [640, 960, 1280, 1600, 2000, 2400];

/**
 * A banner or panel with a city photo behind its content, plus a small credit.
 * The photo is decorative (empty alt); the credit names the city and photographer.
 */
export async function PhotoBackdrop({
  backdrop,
  overlay = "even",
  priority = false,
  sizes = "100vw",
  className,
  children,
  as: Tag = "section",
  creditAt = "bottom",
  ...rest
}: {
  backdrop: Backdrop;
  overlay?: keyof typeof OVERLAYS;
  /** The page's main image: load it first. */
  priority?: boolean;
  sizes?: string;
  className?: string;
  children?: React.ReactNode;
  as?: "section" | "div" | "aside" | "header";
  /** Move the credit to the top when content overlaps the banner's bottom edge. */
  creditAt?: "bottom" | "top";
} & Omit<React.HTMLAttributes<HTMLElement>, "className" | "children">) {
  preconnect("https://images.unsplash.com");
  const locale = (await getLocale()) as "tr" | "en";
  const t = await getTranslations("cities");
  const { city, photo } = backdrop;

  return (
    <Tag className={cn("relative isolate overflow-hidden bg-primary-deeper", className)} {...rest}>
      {/* eslint-disable-next-line @next/next/no-img-element -- Unsplash's CDN resizes; srcset below */}
      <img
        src={unsplashImage(photo.id, 1600)}
        srcSet={WIDTHS.map((w) => `${unsplashImage(photo.id, w)} ${w}w`).join(", ")}
        sizes={sizes}
        alt=""
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        decoding="async"
        style={photo.focus ? { objectPosition: photo.focus } : undefined}
        className="absolute inset-0 -z-20 size-full object-cover"
      />
      <span aria-hidden className={cn("absolute inset-0 -z-10", OVERLAYS[overlay])} />
      {children}
      <a
        href={unsplashPhotoUrl(photo.page)}
        target="_blank"
        rel="noreferrer"
        className={cn(
          "absolute right-3 z-10 max-w-[70%] truncate rounded bg-black/50 px-1.5 py-0.5 text-[11px] leading-4 text-white hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-white",
          creditAt === "top" ? "top-2" : "bottom-2",
        )}
      >
        {t("photoCaption", { city: locale === "tr" ? city.tr : city.en, name: photo.by })}
      </a>
    </Tag>
  );
}

/** Text shadow that keeps white headings crisp over busy photos. */
export const onPhotoText = "[text-shadow:0_1px_3px_rgb(0_0_0/0.35)]";
