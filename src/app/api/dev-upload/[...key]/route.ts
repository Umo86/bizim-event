import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { connection } from "next/server";
import { DEV_UPLOAD_DIR, isDevLocalStorage, isSafeKey, verifyDevUpload } from "@/lib/adapters/storage";

/**
 * Local-development stand-in for R2 so the photo uploader works without
 * Cloudflare keys. Disabled whenever R2 is configured or NODE_ENV=production.
 * PUTs must carry a short-lived HMAC signature issued by the server.
 */

function resolveKey(parts: string[]) {
  const key = parts.join("/");
  if (!isSafeKey(key)) return null;
  // turbopackIgnore: dev-only files must not make the build trace the whole project.
  return { key, file: path.join(/*turbopackIgnore: true*/ process.cwd(), DEV_UPLOAD_DIR, key) };
}

export async function PUT(req: Request, ctx: RouteContext<"/api/dev-upload/[...key]">) {
  await connection();
  if (!isDevLocalStorage()) return new Response("Not found", { status: 404 });
  const resolved = resolveKey((await ctx.params).key);
  if (!resolved) return new Response("Bad key", { status: 400 });

  const url = new URL(req.url);
  const exp = Number(url.searchParams.get("exp"));
  const sig = url.searchParams.get("sig") ?? "";
  const len = Number(url.searchParams.get("len"));
  const type = url.searchParams.get("type") ?? "";
  if (req.headers.get("content-type") !== type) return new Response("Content-Type mismatch", { status: 403 });
  if (!verifyDevUpload(resolved.key, type, len, exp, sig)) return new Response("Bad signature", { status: 403 });

  const body = Buffer.from(await req.arrayBuffer());
  if (body.length !== len) return new Response("Length mismatch", { status: 403 });
  await mkdir(/*turbopackIgnore: true*/ path.dirname(resolved.file), { recursive: true });
  await writeFile(/*turbopackIgnore: true*/ resolved.file, body);
  await writeFile(/*turbopackIgnore: true*/ `${resolved.file}.meta.json`, JSON.stringify({ contentType: type }));
  return new Response(null, { status: 200 });
}

export async function GET(_req: Request, ctx: RouteContext<"/api/dev-upload/[...key]">) {
  await connection();
  if (!isDevLocalStorage()) return new Response("Not found", { status: 404 });
  const resolved = resolveKey((await ctx.params).key);
  if (!resolved) return new Response("Bad key", { status: 400 });
  try {
    const [data, meta] = await Promise.all([
      readFile(/*turbopackIgnore: true*/ resolved.file),
      readFile(/*turbopackIgnore: true*/ `${resolved.file}.meta.json`, "utf8").then(
        (m) => JSON.parse(m) as { contentType?: string },
      ),
    ]);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": meta.contentType ?? "application/octet-stream",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
