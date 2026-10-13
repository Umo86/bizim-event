import "server-only";
import { and, count, eq, max } from "drizzle-orm";
import { listingMedia } from "@/db/schema";
import { MAX_MEDIA } from "@/lib/listing-config";
import { mediaCaptionInput } from "@/lib/validation/listing";
import type { DalContext } from "./context";
import { DalError } from "./errors";
import { requireListingEditor } from "./listing-write";

type MediaKind = "image" | "video" | "audio" | "youtube" | "pdf_menu";

export type NewMedia = {
  kind: MediaKind;
  r2Key: string | null; // image: key base (variants derived); others: full object key
  urlSmall?: string | null;
  urlMedium?: string | null;
  urlLarge: string;
  blurDataUrl?: string | null;
  width?: number | null;
  height?: number | null;
  contentType?: string | null;
  bytes?: number | null;
};

/** Check the per-kind cap before presigning, so nobody uploads files that can't be attached. */
export async function assertMediaCapacity(ctx: DalContext, listingId: string, kind: MediaKind) {
  await requireListingEditor(ctx, listingId);
  const [{ n }] = await ctx.db
    .select({ n: count() })
    .from(listingMedia)
    .where(and(eq(listingMedia.listingId, listingId), eq(listingMedia.kind, kind)));
  if (n >= MAX_MEDIA[kind]) throw new DalError("CONFLICT", "too_many_media");
}

export async function addListingMedia(ctx: DalContext, listingId: string, media: NewMedia) {
  await assertMediaCapacity(ctx, listingId, media.kind);
  const [{ top }] = await ctx.db
    .select({ top: max(listingMedia.sortOrder) })
    .from(listingMedia)
    .where(eq(listingMedia.listingId, listingId));
  const [row] = await ctx.db
    .insert(listingMedia)
    .values({
      listingId,
      kind: media.kind,
      r2Key: media.r2Key,
      urlSmall: media.urlSmall ?? null,
      urlMedium: media.urlMedium ?? null,
      urlLarge: media.urlLarge,
      blurDataUrl: media.blurDataUrl ?? null,
      width: media.width ?? null,
      height: media.height ?? null,
      contentType: media.contentType ?? null,
      bytes: media.bytes ?? null,
      sortOrder: (top ?? -1) + 1,
    })
    .returning({
      id: listingMedia.id,
      kind: listingMedia.kind,
      urlSmall: listingMedia.urlSmall,
      urlMedium: listingMedia.urlMedium,
      urlLarge: listingMedia.urlLarge,
      blurDataUrl: listingMedia.blurDataUrl,
      captionTr: listingMedia.captionTr,
      captionEn: listingMedia.captionEn,
      width: listingMedia.width,
      height: listingMedia.height,
      sortOrder: listingMedia.sortOrder,
    });
  return row;
}

/** New order for the listing's media; ids not belonging to the listing are refused. */
export async function reorderListingMedia(ctx: DalContext, listingId: string, orderedIds: string[]) {
  await requireListingEditor(ctx, listingId);
  const rows = await ctx.db
    .select({ id: listingMedia.id })
    .from(listingMedia)
    .where(eq(listingMedia.listingId, listingId));
  const own = new Set(rows.map((r) => r.id));
  if (orderedIds.length !== own.size || orderedIds.some((id) => !own.has(id)))
    throw new DalError("INVALID", "bad_order");
  await ctx.db.transaction(async (tx) => {
    for (const [i, id] of orderedIds.entries()) {
      await tx
        .update(listingMedia)
        .set({ sortOrder: i })
        .where(and(eq(listingMedia.id, id), eq(listingMedia.listingId, listingId)));
    }
  });
}

/** Removes a media row; returns its storage key so the caller can delete the objects. */
export async function removeListingMedia(ctx: DalContext, mediaId: string) {
  const [m] = await ctx.db.select().from(listingMedia).where(eq(listingMedia.id, mediaId)).limit(1);
  if (!m) throw new DalError("FORBIDDEN");
  await requireListingEditor(ctx, m.listingId);
  await ctx.db.delete(listingMedia).where(eq(listingMedia.id, mediaId));
  return { listingId: m.listingId, kind: m.kind, r2Key: m.r2Key, urlLarge: m.urlLarge, contentType: m.contentType };
}

export async function updateMediaCaption(ctx: DalContext, mediaId: string, raw: unknown) {
  const [m] = await ctx.db
    .select({ listingId: listingMedia.listingId })
    .from(listingMedia)
    .where(eq(listingMedia.id, mediaId))
    .limit(1);
  if (!m) throw new DalError("FORBIDDEN");
  await requireListingEditor(ctx, m.listingId);
  const { captionTr, captionEn } = mediaCaptionInput.parse(raw);
  await ctx.db
    .update(listingMedia)
    .set({ captionTr: captionTr ?? null, captionEn: captionEn ?? null })
    .where(eq(listingMedia.id, mediaId));
}
