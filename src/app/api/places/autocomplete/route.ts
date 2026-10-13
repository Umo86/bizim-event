import { connection } from "next/server";
import { geocode } from "@/lib/adapters/geocode";
import { rateLimit } from "@/lib/adapters/redis";
import { getSessionUser } from "@/server/session";

/**
 * Address autocomplete for business onboarding (signed-in users only, so the
 * Places quota can't be drained anonymously). Proxied through the server so
 * the provider (Google / Photon) can be swapped without client changes.
 */
export async function GET(req: Request) {
  await connection();
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 120);
  const language = url.searchParams.get("lang") === "en" ? "en" : "tr";
  const sessionToken = (url.searchParams.get("session") ?? "").slice(0, 100) || undefined;
  if (q.length < 3) return Response.json({ suggestions: [] });

  const { success } = await rateLimit("message", `places:${user.id}`);
  if (!success) return Response.json({ error: "rate_limited" }, { status: 429 });

  const suggestions = await geocode().autocomplete(q, { language, sessionToken });
  return Response.json(
    { suggestions, provider: geocode().name },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
