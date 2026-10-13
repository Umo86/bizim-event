import { notFound } from "next/navigation";

/**
 * Any URL that matches no page lands here, so it gets the localised not-found page
 * (with the header, footer and city photo) instead of Next.js's bare default 404.
 */
export default function CatchAll() {
  notFound();
}
