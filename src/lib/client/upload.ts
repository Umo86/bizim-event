/**
 * Browser-side upload pipeline (client components only).
 *  1. Resize to 400 / 1200 / 2000 px. WebP where the browser can encode it,
 *     JPEG otherwise (older Safari). Re-encoding drops EXIF, including GPS.
 *  2. Ask the server for presigned PUT URLs (one per size).
 *  3. PUT each file straight to storage, then register the upload.
 */
import imageCompression from "browser-image-compression";
import { IMAGE_VARIANTS, type ImageVariantName } from "@/lib/listing-config";

const LIB_URL = "/vendor/browser-image-compression.js"; // self-hosted copy for the web worker

export type PreparedImage = {
  contentType: "image/webp" | "image/jpeg";
  extension: "webp" | "jpg";
  variants: { name: ImageVariantName; blob: Blob }[];
  width: number;
  height: number;
  blurDataUrl?: string;
};

export class UploadError extends Error {
  constructor(readonly code: "unsupported" | "heic" | "too_big" | "failed" | string) {
    super(code);
  }
}

const MAX_SOURCE_BYTES = 40 * 1024 * 1024;

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function compress(file: File, size: number, quality: number, maxSizeMB: number, fileType: string) {
  return imageCompression(file, {
    maxWidthOrHeight: size,
    maxSizeMB,
    initialQuality: quality,
    fileType,
    useWebWorker: true,
    libURL: LIB_URL,
    alwaysKeepResolution: true,
    preserveExif: false,
  });
}

const isHeic = (file: File) => /^image\/hei[cf]/.test(file.type) || /\.(heic|heif)$/i.test(file.name);

export async function prepareImage(file: File): Promise<PreparedImage> {
  if (file.size > MAX_SOURCE_BYTES) throw new UploadError("too_big");
  if (!/^image\//.test(file.type) && !isHeic(file)) throw new UploadError("unsupported");
  try {
    let contentType: PreparedImage["contentType"] = "image/webp";
    const first = await compress(
      file,
      IMAGE_VARIANTS[0].size,
      IMAGE_VARIANTS[0].quality,
      IMAGE_VARIANTS[0].maxSizeMB,
      contentType,
    );
    if (first.type !== "image/webp") contentType = "image/jpeg";
    const variants: PreparedImage["variants"] = [];
    for (const v of IMAGE_VARIANTS) {
      const blob =
        v.name === "small" && contentType === "image/webp"
          ? first
          : await compress(file, v.size, v.quality, v.maxSizeMB, contentType);
      variants.push({ name: v.name, blob });
    }
    const large = variants[variants.length - 1].blob;
    const bitmap = await createImageBitmap(large);
    const { width, height } = bitmap;
    bitmap.close();
    const tiny = await compress(file, 24, 0.5, 0.01, contentType);
    const blurDataUrl = await blobToDataUrl(tiny);
    return {
      contentType,
      extension: contentType === "image/webp" ? "webp" : "jpg",
      variants,
      width,
      height,
      blurDataUrl: blurDataUrl.length <= 2000 ? blurDataUrl : undefined,
    };
  } catch (err) {
    if (err instanceof UploadError) throw err;
    // Safari decodes HEIC natively; most other desktop browsers can't.
    throw new UploadError(isHeic(file) ? "heic" : "unsupported");
  }
}

/** PUT one file to its presigned URL. */
export async function putFile(url: string, blob: Blob, contentType: string) {
  const res = await fetch(url, { method: "PUT", body: blob, headers: { "Content-Type": contentType } });
  if (!res.ok) throw new UploadError("failed");
}
