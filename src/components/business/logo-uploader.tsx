"use client";

import { ImageUp, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { prepareImage, putFile, UploadError } from "@/lib/client/upload";
import { registerLogoAction, removeLogoAction, requestUploadAction } from "@/server/actions/media";

export function LogoUploader({ businessId, initialUrl }: { businessId: string; initialUrl: string | null }) {
  const t = useTranslations("fields");
  const tp = useTranslations("photos");
  const ta = useTranslations("actionErrors");
  const [url, setUrl] = useState(initialUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const prepared = await prepareImage(file);
      const small = prepared.variants.find((v) => v.name === "small")!;
      const req = await requestUploadAction(
        { scope: "logo", businessId },
        { kind: "image", files: [{ variant: "small", contentType: prepared.contentType, bytes: small.blob.size }] },
      );
      if (!req.ok) throw new UploadError(req.error);
      await putFile(req.data.uploads[0].url, small.blob, prepared.contentType);
      const reg = await registerLogoAction(businessId, req.data.keyBase, prepared.extension);
      if (!reg.ok) throw new UploadError(reg.error);
      setUrl(reg.data.logoUrl);
    } catch (err) {
      const code = err instanceof UploadError ? err.code : "UNKNOWN";
      setError(
        code === "unsupported" || code === "heic"
          ? tp(code)
          : code === "too_big"
            ? tp("tooBig")
            : ta.has(code)
              ? ta(code)
              : ta("UNKNOWN"),
      );
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-ink">
        {t("logo")} <span className="font-normal text-muted">({t("optional")})</span>
      </p>
      <div className="flex items-center gap-4">
        <div className="flex size-20 items-center justify-center overflow-hidden rounded-2xl border border-line bg-section">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element -- images are pre-sized in the browser and served from R2
            <img src={url} alt="" className="size-full object-cover" />
          ) : (
            <ImageUp className="size-7 text-muted" aria-hidden />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className={buttonVariants({ variant: "outline", size: "sm", className: "cursor-pointer" })}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {url ? t("replaceLogo") : t("uploadLogo")}
            <input
              ref={input}
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(f);
              }}
            />
          </label>
          {url ? (
            <button
              type="button"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
              onClick={async () => {
                const r = await removeLogoAction(businessId);
                if (r.ok) setUrl(null);
              }}
            >
              {t("removeLogo")}
            </button>
          ) : null}
        </div>
      </div>
      <p className="text-sm text-muted">{t("logoHint")}</p>
      {error ? (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
