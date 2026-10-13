import "server-only";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/lib/env";

/**
 * File storage on Cloudflare R2 (S3-compatible, no egress fees).
 * Browsers upload directly with a presigned PUT URL — files never pass through
 * a Vercel function body.
 */
export const UPLOAD_LIMITS = {
  image: { maxBytes: 10 * 1024 * 1024, types: ["image/webp", "image/jpeg", "image/png", "image/avif"] },
  video: { maxBytes: 100 * 1024 * 1024, types: ["video/mp4", "video/webm", "video/quicktime"] },
  audio: { maxBytes: 20 * 1024 * 1024, types: ["audio/mpeg", "audio/mp4", "audio/ogg", "audio/wav"] },
  pdf: { maxBytes: 10 * 1024 * 1024, types: ["application/pdf"] },
} as const;
export type UploadKind = keyof typeof UPLOAD_LIMITS;

export const PRESIGN_TTL_SECONDS = 5 * 60;

export type PresignRequest = { key: string; contentType: string; contentLength: number; kind: UploadKind };
export type PresignResult = { uploadUrl: string; publicUrl: string; key: string; expiresIn: number };

export interface StorageProvider {
  readonly name: string;
  presignUpload(req: PresignRequest): Promise<PresignResult>;
  publicUrl(key: string): string;
  delete(key: string): Promise<void>;
}

export function validateUpload(kind: UploadKind, contentType: string, contentLength: number): string | null {
  const rule = UPLOAD_LIMITS[kind];
  if (!(rule.types as readonly string[]).includes(contentType)) return "unsupported_type";
  if (contentLength <= 0 || contentLength > rule.maxBytes) return "too_large";
  return null;
}

class R2Provider implements StorageProvider {
  readonly name = "r2";
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
    if (err) throw new Error(`upload_rejected:${err}`);
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: req.key,
      ContentType: req.contentType,
      ContentLength: req.contentLength,
      CacheControl: "public, max-age=31536000, immutable",
    });
    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn: PRESIGN_TTL_SECONDS });
    return { uploadUrl, publicUrl: this.publicUrl(req.key), key: req.key, expiresIn: PRESIGN_TTL_SECONDS };
  }
  publicUrl(key: string) {
    return `${this.publicBase.replace(/\/$/, "")}/${key}`;
  }
  async delete(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

class StubStorage implements StorageProvider {
  readonly name = "stub";
  async presignUpload(req: PresignRequest): Promise<PresignResult> {
    const err = validateUpload(req.kind, req.contentType, req.contentLength);
    if (err) throw new Error(`upload_rejected:${err}`);
    return { uploadUrl: "about:blank", publicUrl: this.publicUrl(req.key), key: req.key, expiresIn: PRESIGN_TTL_SECONDS };
  }
  publicUrl(key: string) {
    return `/stub-uploads/${key}`;
  }
  async delete() {}
}

let provider: StorageProvider | undefined;

export function storage(): StorageProvider {
  if (!provider) {
    const e = env();
    provider =
      e.R2_ACCOUNT_ID && e.R2_ACCESS_KEY_ID && e.R2_SECRET_ACCESS_KEY && e.R2_BUCKET && e.R2_PUBLIC_URL
        ? new R2Provider(e.R2_ACCOUNT_ID, e.R2_ACCESS_KEY_ID, e.R2_SECRET_ACCESS_KEY, e.R2_BUCKET, e.R2_PUBLIC_URL)
        : new StubStorage();
  }
  return provider;
}

/** Namespaced, unguessable object keys: listings/<listingId>/<uuid>-<size>.webp */
export function buildObjectKey(scope: string, ownerId: string, ext: string, suffix?: string) {
  const id = crypto.randomUUID();
  return `${scope}/${ownerId}/${id}${suffix ? `-${suffix}` : ""}.${ext.replace(/^\./, "")}`;
}
