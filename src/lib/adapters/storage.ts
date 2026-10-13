import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { DeleteObjectsCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/lib/env";

/**
 * File storage on Cloudflare R2 (S3-compatible, no egress fees).
 * Browsers upload directly with a presigned PUT URL — files never pass through
 * a Vercel function body. After upload the server checks each object with HEAD
 * (exists, size, type) before it is recorded.
 *
 * Providers:
 *  - r2        all R2_* variables set
 *  - dev-local local development without R2: signed PUT/GET via /api/dev-upload,
 *              files kept in ./.dev-uploads (never used in production)
 *  - disabled  production without R2 — uploads are refused with a clear error
 */
export const UPLOAD_LIMITS = {
  image: { maxBytes: 10 * 1024 * 1024, types: ["image/webp", "image/jpeg", "image/png", "image/avif"] },
  video: { maxBytes: 100 * 1024 * 1024, types: ["video/mp4", "video/webm", "video/quicktime"] },
  audio: {
    maxBytes: 20 * 1024 * 1024,
    types: ["audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/ogg", "audio/wav", "audio/x-wav"],
  },
  pdf_menu: { maxBytes: 10 * 1024 * 1024, types: ["application/pdf"] },
} as const;
export type UploadKind = keyof typeof UPLOAD_LIMITS;

export const PRESIGN_TTL_SECONDS = 5 * 60;

export type PresignRequest = { key: string; contentType: string; contentLength: number; kind: UploadKind };
export type PresignResult = { uploadUrl: string; publicUrl: string; key: string; expiresIn: number };
export type HeadResult = { bytes: number; contentType: string | null } | null;

export interface StorageProvider {
  readonly name: "r2" | "dev-local" | "disabled";
  readonly enabled: boolean;
  presignUpload(req: PresignRequest): Promise<PresignResult>;
  publicUrl(key: string): string;
  head(key: string): Promise<HeadResult>;
  deleteMany(keys: string[]): Promise<void>;
}

export function validateUpload(kind: UploadKind, contentType: string, contentLength: number): string | null {
  const rule = UPLOAD_LIMITS[kind];
  if (!(rule.types as readonly string[]).includes(contentType)) return "unsupported_type";
  if (contentLength <= 0 || contentLength > rule.maxBytes) return "too_large";
  return null;
}

export class StorageError extends Error {
  constructor(readonly code: "storage_not_configured" | "unsupported_type" | "too_large" | "bad_key") {
    super(code);
  }
}

/** Object keys are generated server-side; anything else is refused. */
export function isSafeKey(key: string) {
  return /^[a-z]+\/[0-9a-f-]{36}\/[0-9a-f-]{36}(-(small|medium|large|original))?\.[a-z0-9]{2,5}$/.test(key);
}

class R2Provider implements StorageProvider {
  readonly name = "r2" as const;
  readonly enabled = true;
  private client: S3Client;
  constructor(
    accountId: string,
    accessKeyId: string,
    secretAccessKey: string,
    private bucket: string,
    private publicBase: string,
  ) {
    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
  }
  async presignUpload(req: PresignRequest): Promise<PresignResult> {
    const err = validateUpload(req.kind, req.contentType, req.contentLength);
    if (err) throw new StorageError(err as "unsupported_type" | "too_large");
    if (!isSafeKey(req.key)) throw new StorageError("bad_key");
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: req.key,
      ContentType: req.contentType,
      ContentLength: req.contentLength,
      CacheControl: "public, max-age=31536000, immutable",
    });
    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: PRESIGN_TTL_SECONDS,
      // Sign these headers so the browser can't swap the type or size.
      signableHeaders: new Set(["content-type", "content-length"]),
    });
    return { uploadUrl, publicUrl: this.publicUrl(req.key), key: req.key, expiresIn: PRESIGN_TTL_SECONDS };
  }
  publicUrl(key: string) {
    return `${this.publicBase.replace(/\/$/, "")}/${key}`;
  }
  async head(key: string): Promise<HeadResult> {
    try {
      const res = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return { bytes: Number(res.ContentLength ?? 0), contentType: res.ContentType ?? null };
    } catch {
      return null;
    }
  }
  async deleteMany(keys: string[]) {
    if (!keys.length) return;
    await this.client.send(
      new DeleteObjectsCommand({ Bucket: this.bucket, Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true } }),
    );
  }
}

// Dev-local ------------------------------------------------------------------------------

export const DEV_UPLOAD_DIR = ".dev-uploads";

function devSecret() {
  return env().BETTER_AUTH_SECRET ?? "dev-only-secret";
}

export function signDevUpload(key: string, contentType: string, contentLength: number, exp: number) {
  return createHmac("sha256", devSecret()).update(`${key}|${contentType}|${contentLength}|${exp}`).digest("hex");
}

export function verifyDevUpload(key: string, contentType: string, contentLength: number, exp: number, sig: string) {
  if (!Number.isFinite(exp) || exp < Date.now() / 1000) return false;
  const expected = Buffer.from(signDevUpload(key, contentType, contentLength, exp));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

class DevLocalProvider implements StorageProvider {
  readonly name = "dev-local" as const;
  readonly enabled = true;
  async presignUpload(req: PresignRequest): Promise<PresignResult> {
    const err = validateUpload(req.kind, req.contentType, req.contentLength);
    if (err) throw new StorageError(err as "unsupported_type" | "too_large");
    if (!isSafeKey(req.key)) throw new StorageError("bad_key");
    const exp = Math.floor(Date.now() / 1000) + PRESIGN_TTL_SECONDS;
    const sig = signDevUpload(req.key, req.contentType, req.contentLength, exp);
    const qs = new URLSearchParams({ exp: String(exp), sig, len: String(req.contentLength), type: req.contentType });
    return {
      uploadUrl: `/api/dev-upload/${req.key}?${qs}`,
      publicUrl: this.publicUrl(req.key),
      key: req.key,
      expiresIn: PRESIGN_TTL_SECONDS,
    };
  }
  publicUrl(key: string) {
    return `/api/dev-upload/${key}`;
  }
  async head(key: string): Promise<HeadResult> {
    const { stat, readFile } = await import("node:fs/promises");
    const path = await import("node:path");
    try {
      const file = path.join(process.cwd(), DEV_UPLOAD_DIR, key);
      const s = await stat(file);
      const meta = JSON.parse(await readFile(`${file}.meta.json`, "utf8").catch(() => "{}")) as {
        contentType?: string;
      };
      return { bytes: s.size, contentType: meta.contentType ?? null };
    } catch {
      return null;
    }
  }
  async deleteMany(keys: string[]) {
    const { rm } = await import("node:fs/promises");
    const path = await import("node:path");
    await Promise.all(
      keys.flatMap((k) => [
        rm(path.join(process.cwd(), DEV_UPLOAD_DIR, k), { force: true }),
        rm(path.join(process.cwd(), DEV_UPLOAD_DIR, `${k}.meta.json`), { force: true }),
      ]),
    );
  }
}

class DisabledStorage implements StorageProvider {
  readonly name = "disabled" as const;
  readonly enabled = false;
  async presignUpload(): Promise<PresignResult> {
    throw new StorageError("storage_not_configured");
  }
  publicUrl(key: string) {
    return `/${key}`;
  }
  async head() {
    return null;
  }
  async deleteMany() {}
}

let provider: StorageProvider | undefined;

export function storage(): StorageProvider {
  if (!provider) {
    const e = env();
    if (e.R2_ACCOUNT_ID && e.R2_ACCESS_KEY_ID && e.R2_SECRET_ACCESS_KEY && e.R2_BUCKET && e.R2_PUBLIC_URL) {
      provider = new R2Provider(
        e.R2_ACCOUNT_ID,
        e.R2_ACCESS_KEY_ID,
        e.R2_SECRET_ACCESS_KEY,
        e.R2_BUCKET,
        e.R2_PUBLIC_URL,
      );
    } else if (e.NODE_ENV !== "production") {
      provider = new DevLocalProvider();
    } else {
      provider = new DisabledStorage();
    }
  }
  return provider;
}

export function isDevLocalStorage() {
  return storage().name === "dev-local";
}

/** listings/<ownerId>/<uuid>  → callers append "-<variant>.<ext>". */
export function newKeyBase(scope: "listings" | "businesses", ownerId: string) {
  return `${scope}/${ownerId}/${crypto.randomUUID()}`;
}

export function variantKey(keyBase: string, variant: string, ext: string) {
  return `${keyBase}-${variant}.${ext}`;
}
