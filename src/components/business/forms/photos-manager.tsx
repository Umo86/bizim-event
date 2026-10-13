"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FileText, GripVertical, ImagePlus, Loader2, MonitorPlay, Music, Trash2, Video } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/form";
import { prepareImage, putFile, UploadError } from "@/lib/client/upload";
import { MIN_PHOTOS, type ListingType } from "@/lib/listing-config";
import {
  addYoutubeAction,
  captionMediaAction,
  deleteMediaAction,
  registerMediaAction,
  reorderMediaAction,
  requestUploadAction,
} from "@/server/actions/media";
import type { ListingEditorData } from "@/server/dal/listing-write";
import { cn } from "@/lib/utils";
import type { SaveState } from "../autosave";
import { StepActions } from "../step-actions";

type Media = ListingEditorData["media"][number];
type QueueItem = { id: string; name: string; status: "preparing" | "uploading" | "error"; message?: string };

export function PhotosManager({
  data,
  storageEnabled,
  backHref,
  nextHref,
  nextLabel,
}: {
  data: ListingEditorData;
  storageEnabled: boolean;
  backHref?: string | null;
  nextHref?: string | null;
  nextLabel?: string;
}) {
  const t = useTranslations("photos");
  const ta = useTranslations("actionErrors");
  const tv = useTranslations("validation");
  const listingId = data.listing.id;
  const type = data.listing.type as ListingType;
  const min = MIN_PHOTOS[type];
  const [media, setMedia] = useState<Media[]>(data.media);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [state, setState] = useState<SaveState>("idle");
  const [dragOver, setDragOver] = useState(false);
  const [youtube, setYoutube] = useState("");
  const [youtubeError, setYoutubeError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const images = media.filter((m) => m.kind === "image");
  const others = media.filter((m) => m.kind !== "image");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const errorText = (code: string) => {
    if (code === "unsupported" || code === "heic") return t(code);
    if (code === "too_big") return t("tooBig");
    return ta.has(code) ? ta(code) : ta("UNKNOWN");
  };

  const updateQueue = (id: string, patch: Partial<QueueItem> | null) =>
    setQueue((q) => (patch ? q.map((i) => (i.id === id ? { ...i, ...patch } : i)) : q.filter((i) => i.id !== id)));

  async function uploadImage(file: File) {
    const id = crypto.randomUUID();
    setQueue((q) => [...q, { id, name: file.name, status: "preparing" }]);
    try {
      const prepared = await prepareImage(file);
      updateQueue(id, { status: "uploading" });
      const req = await requestUploadAction(
        { scope: "listing", listingId },
        {
          kind: "image",
          files: prepared.variants.map((v) => ({
            variant: v.name,
            contentType: prepared.contentType,
            bytes: v.blob.size,
          })),
        },
      );
      if (!req.ok) throw new UploadError(req.error);
      await Promise.all(
        req.data.uploads.map((u) =>
          putFile(u.url, prepared.variants.find((v) => v.name === u.variant)!.blob, prepared.contentType),
        ),
      );
      const reg = await registerMediaAction(listingId, {
        kind: "image",
        keyBase: req.data.keyBase,
        variants: ["small", "medium", "large"],
        extension: prepared.extension,
        width: prepared.width,
        height: prepared.height,
        blurDataUrl: prepared.blurDataUrl,
      });
      if (!reg.ok) throw new UploadError(reg.error);
      setMedia((m) => [...m, reg.data]);
      updateQueue(id, null);
      setState("saved");
    } catch (err) {
      updateQueue(id, {
        status: "error",
        message: t("failed", { name: file.name, reason: errorText(err instanceof UploadError ? err.code : "UNKNOWN") }),
      });
    }
  }

  async function uploadFile(kind: "video" | "audio" | "pdf_menu", file: File) {
    const id = crypto.randomUUID();
    setQueue((q) => [...q, { id, name: file.name, status: "uploading" }]);
    try {
      const req = await requestUploadAction(
        { scope: "listing", listingId },
        { kind, files: [{ variant: "original", contentType: file.type, bytes: file.size }] },
      );
      if (!req.ok) throw new UploadError(req.error);
      await putFile(req.data.uploads[0].url, file, file.type);
      const reg = await registerMediaAction(listingId, {
        kind,
        keyBase: req.data.keyBase,
        variants: ["original"],
        extension: req.data.extension,
      });
      if (!reg.ok) throw new UploadError(reg.error);
      setMedia((m) => [...m, reg.data]);
      updateQueue(id, null);
    } catch (err) {
      updateQueue(id, {
        status: "error",
        message: t("failed", { name: file.name, reason: errorText(err instanceof UploadError ? err.code : "UNKNOWN") }),
      });
    }
  }

  async function addFiles(files: FileList | File[]) {
    for (const f of Array.from(files)) await uploadImage(f);
  }

  async function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const from = images.findIndex((m) => m.id === e.active.id);
    const to = images.findIndex((m) => m.id === e.over!.id);
    const reordered = arrayMove(images, from, to);
    const next = [...reordered, ...others];
    setMedia(next);
    setState("saving");
    const res = await reorderMediaAction(
      listingId,
      next.map((m) => m.id),
    );
    setState(res.ok ? "saved" : "error");
  }

  async function remove(id: string) {
    if (!window.confirm(t("deleteConfirm"))) return;
    const res = await deleteMediaAction(id);
    if (res.ok) setMedia((m) => m.filter((x) => x.id !== id));
  }

  return (
    <div className="space-y-8">
      {!storageEnabled ? <Notice tone="warning">{t("storageOff")}</Notice> : null}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) void addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors",
          dragOver ? "border-primary-strong bg-primary-soft" : "border-line bg-section",
        )}
      >
        <ImagePlus className="size-9 text-primary-strong" aria-hidden />
        <p className="font-semibold text-ink">{t("drop")}</p>
        <p className="max-w-md text-sm text-muted">{t("dropHint")}</p>
        <label
          className={cn(
            buttonVariants({ variant: "primary" }),
            "cursor-pointer",
            !storageEnabled && "pointer-events-none opacity-50",
          )}
        >
          {t("add")}
          <input
            ref={fileInput}
            type="file"
            accept="image/*,.heic,.heif"
            multiple
            className="sr-only"
            disabled={!storageEnabled}
            onChange={(e) => {
              if (e.target.files?.length) void addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {queue.length ? (
        <ul className="space-y-2" aria-live="polite">
          {queue.map((q) => (
            <li
              key={q.id}
              className={cn("flex items-center gap-2 text-sm", q.status === "error" ? "text-danger" : "text-muted")}
            >
              {q.status === "error" ? null : <Loader2 className="size-4 animate-spin" aria-hidden />}
              {q.status === "error"
                ? q.message
                : q.status === "preparing"
                  ? t("resizing", { name: q.name })
                  : t("uploading", { name: q.name })}
              {q.status === "error" ? (
                <button type="button" className="ml-2 text-xs underline" onClick={() => updateQueue(q.id, null)}>
                  ×
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-semibold text-ink">{t("count", { count: images.length, min })}</p>
          <p className={cn("text-sm", images.length >= min ? "text-success" : "text-muted")}>
            {images.length >= min ? t("enough") : t("needMore", { count: min - images.length })}
          </p>
        </div>
        {images.length > 1 ? <p className="text-sm text-muted">{t("dragToReorder")}</p> : null}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
          accessibility={{ screenReaderInstructions: { draggable: t("dragToReorder") } }}
        >
          <SortableContext items={images.map((m) => m.id)} strategy={rectSortingStrategy}>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {images.map((m, i) => (
                <SortablePhoto key={m.id} media={m} isCover={i === 0} onDelete={() => remove(m.id)} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      </div>

      {type === "performer" ? (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 font-semibold text-ink">
            <MonitorPlay className="size-5 text-primary-strong" aria-hidden />
            {t("youtubeTitle")}
          </h2>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-64 flex-1 space-y-1.5">
              <label htmlFor="youtube" className="text-sm text-muted">
                {t("youtubeLabel")}
              </label>
              <Input
                id="youtube"
                type="url"
                placeholder="https://youtu.be/…"
                value={youtube}
                onChange={(e) => setYoutube(e.target.value)}
              />
            </div>
            <button
              type="button"
              className={buttonVariants({ variant: "outline" })}
              onClick={async () => {
                setYoutubeError(null);
                const res = await addYoutubeAction(listingId, { url: youtube });
                if (res.ok) {
                  setMedia((m) => [...m, res.data]);
                  setYoutube("");
                } else setYoutubeError(tv("invalid_youtube"));
              }}
            >
              {t("addYoutube")}
            </button>
          </div>
          {youtubeError ? <p className="text-sm font-medium text-danger">{youtubeError}</p> : null}
        </section>
      ) : null}

      <ExtraFiles
        kinds={type === "venue" ? ["video"] : type === "caterer" ? ["pdf_menu"] : ["audio", "video"]}
        others={others}
        storageEnabled={storageEnabled}
        onUpload={uploadFile}
        onDelete={remove}
      />

      <StepActions
        state={state}
        backHref={backHref}
        nextHref={nextHref}
        nextLabel={nextLabel}
        onBeforeLeave={async () => queue.every((q) => q.status === "error")}
        onContinue={async () => queue.every((q) => q.status === "error")}
      />
    </div>
  );
}

function SortablePhoto({ media, isCover, onDelete }: { media: Media; isCover: boolean; onDelete: () => void }) {
  const t = useTranslations("photos");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: media.id });
  const [captionTr, setCaptionTr] = useState(media.captionTr ?? "");
  const [captionEn, setCaptionEn] = useState(media.captionEn ?? "");
  const [saved, setSaved] = useState(false);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group relative overflow-hidden rounded-xl border border-line bg-white",
        isDragging && "z-10 shadow-card ring-2 ring-primary-strong",
      )}
    >
      <div
        className="relative aspect-[3/2] bg-section bg-cover bg-center"
        style={media.blurDataUrl ? { backgroundImage: `url(${media.blurDataUrl})` } : undefined}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={media.urlSmall ?? media.urlMedium ?? media.urlLarge ?? ""}
          alt={media.captionEn ?? media.captionTr ?? ""}
          loading="lazy"
          className="size-full object-cover"
        />
        {isCover ? (
          <span className="absolute left-2 top-2 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-ink">
            {t("cover")}
          </span>
        ) : null}
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={t("dragToReorder")}
          className="absolute right-2 top-2 flex size-9 cursor-grab items-center justify-center rounded-full bg-white/95 text-ink active:cursor-grabbing"
        >
          <GripVertical className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={t("delete")}
          className="absolute bottom-2 right-2 flex size-9 items-center justify-center rounded-full bg-white/95 text-danger hover:bg-white"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      </div>
      <details className="px-3 py-2 text-sm">
        <summary className="cursor-pointer text-muted">{t("caption")}</summary>
        <div className="mt-2 space-y-2">
          <input
            aria-label={`${t("caption")} (TR)`}
            lang="tr"
            placeholder="TR"
            value={captionTr}
            maxLength={200}
            onChange={(e) => setCaptionTr(e.target.value)}
            className="h-9 w-full rounded-lg border border-line px-2"
          />
          <input
            aria-label={`${t("caption")} (EN)`}
            lang="en"
            placeholder="EN"
            value={captionEn}
            maxLength={200}
            onChange={(e) => setCaptionEn(e.target.value)}
            className="h-9 w-full rounded-lg border border-line px-2"
          />
          <button
            type="button"
            className="text-sm font-semibold text-primary-strong hover:underline"
            onClick={async () => {
              const r = await captionMediaAction(media.id, { captionTr, captionEn });
              setSaved(r.ok);
            }}
          >
            {saved ? "✓ " : ""}
            {t("saveCaption")}
          </button>
        </div>
      </details>
    </li>
  );
}

function ExtraFiles({
  kinds,
  others,
  storageEnabled,
  onUpload,
  onDelete,
}: {
  kinds: ("video" | "audio" | "pdf_menu")[];
  others: Media[];
  storageEnabled: boolean;
  onUpload: (kind: "video" | "audio" | "pdf_menu", file: File) => Promise<void>;
  onDelete: (id: string) => void;
}) {
  const t = useTranslations("photos");
  const meta = {
    video: {
      title: t("videoTitle"),
      add: t("addVideo"),
      hint: t("videoHint"),
      accept: "video/mp4,video/webm,video/quicktime",
      Icon: Video,
      file: (n: number) => t("videoFile", { n }),
    },
    audio: {
      title: t("audioTitle"),
      add: t("addAudio"),
      hint: t("audioHint"),
      accept: "audio/mpeg,audio/mp4,audio/x-m4a,audio/ogg,audio/wav",
      Icon: Music,
      file: (n: number) => t("audioFile", { n }),
    },
    pdf_menu: {
      title: t("menuTitle"),
      add: t("addMenu"),
      hint: t("menuHint"),
      accept: "application/pdf",
      Icon: FileText,
      file: (n: number) => t("menuFile", { n }),
    },
  } as const;
  const youtube = others.filter((m) => m.kind === "youtube");

  return (
    <div className="space-y-8">
      {youtube.length ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {youtube.map((m) => (
            <li key={m.id} className="relative overflow-hidden rounded-xl border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.urlSmall ?? ""} alt="" className="aspect-video w-full object-cover" />
              <button
                type="button"
                onClick={() => onDelete(m.id)}
                aria-label={t("delete")}
                className="absolute right-2 top-2 flex size-9 items-center justify-center rounded-full bg-white/95 text-danger"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {kinds.map((kind) => {
        const m = meta[kind];
        const items = others.filter((o) => o.kind === kind);
        return (
          <section key={kind} className="space-y-3">
            <h2 className="flex items-center gap-2 font-semibold text-ink">
              <m.Icon className="size-5 text-primary-strong" aria-hidden />
              {m.title}
            </h2>
            {items.length ? (
              <ul className="space-y-2">
                {items.map((item, i) => (
                  <li key={item.id} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2">
                    <a
                      href={item.urlLarge ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 truncate text-sm font-medium text-primary-strong hover:underline"
                    >
                      {m.file(i + 1)}
                    </a>
                    <button
                      type="button"
                      onClick={() => onDelete(item.id)}
                      aria-label={t("delete")}
                      className="flex size-9 items-center justify-center rounded-full text-danger hover:bg-section"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <label
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "cursor-pointer",
                !storageEnabled && "pointer-events-none opacity-50",
              )}
            >
              {m.add}
              <input
                type="file"
                accept={m.accept}
                className="sr-only"
                disabled={!storageEnabled}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onUpload(kind, f);
                  e.target.value = "";
                }}
              />
            </label>
            <p className="text-sm text-muted">{m.hint}</p>
          </section>
        );
      })}
    </div>
  );
}
