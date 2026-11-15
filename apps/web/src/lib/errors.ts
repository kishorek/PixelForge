import { PixelForgeError } from "@pixelforge/image-contracts";

export function asPixelForgeError(error: unknown): PixelForgeError {
  if (error instanceof PixelForgeError) return error;
  return new PixelForgeError(
    "WORKER_FAILED",
    error instanceof Error ? error.message : String(error),
    "Try the operation again, or use a smaller image.",
  );
}

export function newId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function formatDuration(milliseconds: number): string {
  if (milliseconds < 1000) return `${Math.round(milliseconds)} ms`;
  return `${(milliseconds / 1000).toFixed(1)} s`;
}
