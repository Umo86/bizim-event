"use server";

import { revalidateTag } from "next/cache";
import { rateLimit } from "@/lib/adapters/redis";
import { isSafeKey, newKeyBase, storage, UPLOAD_LIMITS, variantKey, type UploadKind } from "@/lib/adapters/storage";
import { youtubeId } from "@/lib/listing-config";
import { mediaUploadRequest, registerMediaInput, youtubeInput } from "@/lib/validation/listing";
import { businessWrite, DalError, mediaDal, requireBusinessMember, requireUser } from "@/server/dal";
import { requireListingEditor } from "@/server/dal/listing-write";
import { runAction } from "./run";

const EXT_BY_TYPE: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "application/pdf": "pdf",
};

type Target = { scope: "listing"; listingId: string } | { scope: "logo"; businessId: string };

/**
 * Step 1 of an upload: authorise, check limits, and hand back presigned PUT
 * URLs (one per image size). Images must already be WebP — the browser resizes
 * and strips EXIF before asking.
 */
export async function requestUploadAction(target: Target, raw: unknown) {
  return runAction(async (ctx) => {
    const u = requireUser(ctx);
    const req = mediaUploadRequest.parse(raw);
    const { success } = await rateLimit("upload", u.id);
    if (!success) throw new DalError("CONFLICT", "rate_limited");

    let keyBase: string;
    if (target.scope === "listing") {
      await mediaDal.assertMediaCapacity(ctx, target.listingId, req.kind);
      keyBase = newKeyBase("listings", target.listingId);
    } else {
      if (req.kind !== "image") throw new DalError("INVALID");
      await requireBusinessMember(ctx, target.businessId);
      keyBase = newKeyBase("businesses", target.businessId);
    }
    const kind: UploadKind = req.kind;
    const ext = EXT_BY_TYPE[req.files[0].contentType];
    if (!ext) throw new DalError("INVALID", "unsupported_type");
    // Images arrive pre-resized: all sizes share one format (WebP, or JPEG on older Safari).
    if (
      req.kind === "image" &&
      (req.files.some((f) => f.contentType !== req.files[0].contentType) || !["webp", "jpg"].includes(ext))
    )
      throw new DalError("INVALID", "unsupported_type");

    const uploads = await Promise.all(
      req.files.map(async (f) => {
        const key = req.kind === "image" ? variantKey(keyBase, f.variant, ext) : `${keyBase}.${ext}`;
        const signed = await storage().presignUpload({ key, contentType: f.contentType, contentLength: f.bytes, kind });
        return { variant: f.variant, url: signed.uploadUrl, key, contentType: f.contentType };
      }),
    );
    return { keyBase, extension: ext, uploads };
  });
}

/** Verifies every uploaded object (exists, size, type) before attaching it to the listing. */
async function verifyObjects(keys: string[], kind: UploadKind) {
  const rule = UPLOAD_LIMITS[kind];
  let total = 0;
  let contentType: string | null = null;
  for (const key of keys) {
    if (!isSafeKey(key)) throw new DalError("INVALID", "bad_key");
    const head = await storage().head(key);
    if (!head) throw new DalError("INVALID", "upload_missing");
    if (head.bytes > rule.maxBytes) throw new DalError("INVALID", "too_large");
    if (head.contentType && !(rule.types as readonly string[]).includes(head.contentType))
      throw new DalError("INVALID", "unsupported_type");
    total += head.bytes;
    contentType = head.contentType ?? contentType;
  }
  return { bytes: total, contentType };
}

/** Step 2 of an upload: record the verified files as listing media. */
export async function registerMediaAction(listingId: string, raw: unknown) {
  return runAction(async (ctx) => {
    const input = registerMediaInput.parse(raw);
    await requireListingEditor(ctx, listingId);
    if (!input.keyBase.startsWith(`listings/${listingId}/`)) throw new DalError("FORBIDDEN");
    const s = storage();
    if (input.kind === "image") {
      if (input.extension !== "webp" && input.extension !== "jpg") throw new DalError("INVALID", "unsupported_type");
      const keys = (["small", "medium", "large"] as const).map((v) => variantKey(input.keyBase, v, input.extension));
      const { bytes, contentType } = await verifyObjects(keys, "image");
      const media = await mediaDal.addListingMedia(ctx, listingId, {
        kind: "image",
        r2Key: input.keyBase,
        urlSmall: s.publicUrl(keys[0]),
        urlMedium: s.publicUrl(keys[1]),
        urlLarge: s.publicUrl(keys[2]),
        blurDataUrl: input.blurDataUrl ?? null,
        width: input.width ?? null,
        height: input.height ?? null,
        contentType,
        bytes,
      });
      revalidateTag(`listing:${listingId}`, "max");
      return media;
    }
    const key = `${input.keyBase}.${input.extension}`;
    const { bytes, contentType } = await verifyObjects([key], input.kind);
    const media = await mediaDal.addListingMedia(ctx, listingId, {
      kind: input.kind,
      r2Key: key,
      urlLarge: s.publicUrl(key),
      contentType,
      bytes,
    });
    revalidateTag(`listing:${listingId}`, "max");
    return media;
  });
}

/** Business logo: a single 400px image. Replaces (and deletes) the previous one. */
export async function registerLogoAction(businessId: string, keyBase: string, extension: "webp" | "jpg") {
  return runAction(async (ctx) => {
    await requireBusinessMember(ctx, businessId);
    if (typeof keyBase !== "string" || !keyBase.startsWith(`businesses/${businessId}/`))
      throw new DalError("FORBIDDEN");
    if (extension !== "webp" && extension !== "jpg") throw new DalError("INVALID", "unsupported_type");
    const key = variantKey(keyBase, "small", extension);
    await verifyObjects([key], "image");
    const url = storage().publicUrl(key);
    const { previousLogoUrl } = await businessWrite.setBusinessLogo(ctx, businessId, url);
    await deleteByUrl(previousLogoUrl);
    return { logoUrl: url };
  });
}

export async function removeLogoAction(businessId: string) {
  return runAction(async (ctx) => {
    const { previousLogoUrl } = await businessWrite.setBusinessLogo(ctx, businessId, null);
    await deleteByUrl(previousLogoUrl);
    return null;
  });
}

async function deleteByUrl(url: string | null) {
  if (!url) return;
  const key =
    /((?:businesses|listings)\/[0-9a-f-]{36}\/[0-9a-f-]{36}(?:-(?:small|medium|large|original))?\.[a-z0-9]{2,5})$/.exec(
      url,
    )?.[1];
  if (key && isSafeKey(key))
    await storage()
      .deleteMany([key])
      .catch(() => undefined);
}

export async function addYoutubeAction(listingId: string, raw: unknown) {
  return runAction(async (ctx) => {
    const { url } = youtubeInput.parse(raw);
    const id = youtubeId(url);
    if (!id) throw new DalError("INVALID", "invalid_youtube");
    const media = await mediaDal.addListingMedia(ctx, listingId, {
      kind: "youtube",
      r2Key: null,
      urlSmall: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      urlLarge: `https://www.youtube.com/watch?v=${id}`,
    });
    revalidateTag(`listing:${listingId}`, "max");
    return media;
  });
}

export async function reorderMediaAction(listingId: string, orderedIds: string[]) {
  return runAction(async (ctx) => {
    if (!Array.isArray(orderedIds) || orderedIds.length > 60) throw new DalError("INVALID");
    await mediaDal.reorderListingMedia(ctx, listingId, orderedIds);
    revalidateTag(`listing:${listingId}`, "max");
    return null;
  });
}

export async function deleteMediaAction(mediaId: string) {
  return runAction(async (ctx) => {
    const removed = await mediaDal.removeListingMedia(ctx, mediaId);
    if (removed.r2Key) {
      const ext = removed.contentType === "image/jpeg" ? "jpg" : "webp";
      const keys =
        removed.kind === "image"
          ? (["small", "medium", "large"] as const).map((v) => variantKey(removed.r2Key!, v, ext))
          : [removed.r2Key];
      await storage()
        .deleteMany(keys.filter(isSafeKey))
        .catch(() => undefined);
    }
    revalidateTag(`listing:${removed.listingId}`, "max");
    return null;
  });
}

export async function captionMediaAction(mediaId: string, captions: { captionTr?: string; captionEn?: string }) {
  return runAction(async (ctx) => {
    await mediaDal.updateMediaCaption(ctx, mediaId, captions);
    return null;
  });
}
