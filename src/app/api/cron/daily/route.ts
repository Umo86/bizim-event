import { timingSafeEqual } from "node:crypto";
import { connection } from "next/server";
import { getDb } from "@/db";
import { runDailyJob } from "@/server/internal/daily-job";

export const maxDuration = 60;

function authorised(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Vercel Cron calls this once a day with `Authorization: Bearer $CRON_SECRET`. */
export async function GET(req: Request) {
  await connection();
  if (!authorised(req)) return Response.json({ error: "unauthorised" }, { status: 401 });
  const results = await runDailyJob(getDb());
  return Response.json({ ok: true, results });
}
