/**
 * Unsplash CDN helpers. Images are hotlinked from images.unsplash.com, which resizes
 * on the fly (imgix), so srcset works without Vercel Image Optimization.
 * Links back to Unsplash carry the referral UTM parameters Unsplash asks for.
 */

const UTM = "utm_source=bizim_event&utm_medium=referral";

/** A resized copy of an Unsplash image: WebP/AVIF where supported, never upscaled. */
export function unsplashImage(id: string, width: number, quality = 70) {
  return `https://images.unsplash.com/${id}?auto=format&fit=max&w=${width}&q=${quality}`;
}

export function unsplashSrcSet(id: string, widths: readonly number[] = [480, 800, 1200, 1600]) {
  return widths.map((w) => `${unsplashImage(id, w)} ${w}w`).join(", ");
}

export const unsplashProfileUrl = (username: string) => `https://unsplash.com/@${username}?${UTM}`;
export const unsplashPhotoUrl = (page: string) => `https://unsplash.com/photos/${page}?${UTM}`;
export const UNSPLASH_URL = `https://unsplash.com/?${UTM}`;
