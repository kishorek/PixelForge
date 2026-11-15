import { FORMAT_BY_MIME, LIMITS } from "@pixelforge/image-contracts";
import type { ImageFormat } from "@pixelforge/image-contracts";

export type DimensionValidation = { ok: true } | { ok: false; reason: string };

export function validateImageDimensions(width: number, height: number): DimensionValidation {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { ok: false, reason: "Image dimensions must be positive numbers." };
  }
  if (width > LIMITS.maxDimension || height > LIMITS.maxDimension) {
    return {
      ok: false,
      reason: `Image edge exceeds the supported maximum of ${LIMITS.maxDimension} pixels.`,
    };
  }
  const pixels = width * height;
  if (!Number.isFinite(pixels) || pixels > LIMITS.maxPixels) {
    return {
      ok: false,
      reason: `Image area exceeds the supported maximum of ${Math.floor(LIMITS.maxPixels / 1_000_000)} megapixels.`,
    };
  }
  return { ok: true };
}

const EXTENSION_FORMATS: Record<string, ImageFormat> = {
  jpg: "jpeg",
  jpeg: "jpeg",
  png: "png",
  webp: "webp",
  avif: "avif",
};

export function detectFormat(mimeType: string, filename: string): ImageFormat | null {
  const normalised = mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
  const byMime = FORMAT_BY_MIME[normalised];
  if (byMime) return byMime;
  const extension = filename.includes(".") ? filename.split(".").pop()?.toLowerCase() : undefined;
  return extension ? (EXTENSION_FORMATS[extension] ?? null) : null;
}

export function animationWarningFor(mimeType: string, bytes?: Uint8Array): string | null {
  const normalised = mimeType.toLowerCase();
  if (normalised === "image/gif") {
    return "Animated GIFs are not supported. Only the first frame will be processed.";
  }
  if (normalised === "image/webp" && bytes) {
    const header = new TextDecoder("latin1").decode(bytes.subarray(0, 64));
    if (header.includes("ANIM")) {
      return "This WebP is animated. Only the first frame will be processed.";
    }
  }
  if (normalised === "image/png" && bytes) {
    const header = new TextDecoder("latin1").decode(bytes.subarray(0, 64));
    if (header.includes("acTL")) {
      return "This PNG is animated. Only the first frame will be processed.";
    }
  }
  return null;
}

export type BlobValidation = { ok: true } | { ok: false; reason: string };

export function validateOutputBlob(blob: Blob, expectedMimeType: string): BlobValidation {
  if (blob.size <= 0) return { ok: false, reason: "The encoder produced an empty file." };
  const actual = blob.type.toLowerCase();
  const expected = expectedMimeType.toLowerCase();
  const acceptsJpegAlias = expected === "image/jpeg" && actual === "image/jpg";
  if (actual !== expected && !acceptsJpegAlias) {
    return {
      ok: false,
      reason: `The browser encoded an unexpected format (${actual || "unknown"}) instead of ${expected}.`,
    };
  }
  return { ok: true };
}
