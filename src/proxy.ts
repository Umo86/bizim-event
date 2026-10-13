import createIntlMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { COUNTRY_COOKIE, normaliseCountry } from "./lib/country";

const intl = createIntlMiddleware(routing);

export default function proxy(request: NextRequest) {
  const response = intl(request);

  // Default country: Vercel's IP header on first visit; the header country selector
  // overwrites the cookie afterwards, so we never override an existing choice.
  if (!request.cookies.get(COUNTRY_COOKIE)) {
    const fromIp = normaliseCountry(request.headers.get("x-vercel-ip-country"));
    if (fromIp) {
      response.cookies.set(COUNTRY_COOKIE, fromIp, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
      });
    }
  }
  return response;
}

export const config = {
  // Skip API routes, Next internals, Vercel internals and any file with an extension.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
