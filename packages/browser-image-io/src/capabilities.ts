import { MIME_BY_FORMAT } from "@pixelforge/image-contracts";
import type { CapabilityReport, ImageFormat } from "@pixelforge/image-contracts";
import { createCanvas, encodeCanvas } from "./encode";

async function probeEncode(format: ImageFormat): Promise<boolean> {
  try {
    const canvas = createCanvas(2, 2);
    const context = canvas.getContext("2d") as CanvasRenderingContext2D | null;
    if (context) {
      context.fillStyle = "#ff0000";
      context.fillRect(0, 0, 2, 2);
    }
    const blob = await encodeCanvas(canvas, format, 0.8);
    const expected = MIME_BY_FORMAT[format];
    return (
      blob.size > 0 && (blob.type === expected || (format === "jpeg" && blob.type === "image/jpg"))
    );
  } catch {
    return false;
  }
}

export async function detectCapabilities(): Promise<CapabilityReport> {
  const formats: ImageFormat[] = ["jpeg", "png", "webp", "avif"];
  const encode = { jpeg: false, png: false, webp: false, avif: false };
  for (const format of formats) {
    encode[format] = await probeEncode(format);
  }
  return {
    encode,
    supportsOffscreenCanvas: typeof OffscreenCanvas !== "undefined",
    supportsWorkers: typeof Worker !== "undefined",
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
  };
}
