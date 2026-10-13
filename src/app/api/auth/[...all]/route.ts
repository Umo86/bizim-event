import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth";
import { rateLimit } from "@/lib/adapters/redis";

function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function GET(req: Request) {
  return toNextJsHandler(getAuth()).GET(req);
}

export async function POST(req: Request) {
  const { success } = await rateLimit("auth", clientIp(req));
  if (!success) return Response.json({ error: "rate_limited" }, { status: 429 });
  return toNextJsHandler(getAuth()).POST(req);
}
