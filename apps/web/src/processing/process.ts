import {
  createCanvas,
  decodeImage,
  encodeCanvas,
  get2dContext,
} from "@pixelforge/browser-image-io";
import { FORMATS, PixelForgeError } from "@pixelforge/image-contracts";
import type {
  Operation,
  ProcessProgress,
  ProcessRequest,
  ProcessResult,
  ProcessStage,
} from "@pixelforge/image-contracts";
import {
  assertValidOperations,
  findTargetQuality,
  outputDimensions,
} from "@pixelforge/operation-model";
import { type PixelforgeWasm, loadPixelforgeWasm } from "../wasm/loader";
import { flattenOntoBackground, renderOperations } from "./render";

function scaledSource(
  bitmap: ImageBitmap,
  width: number,
  height: number,
  scale: number,
): { source: CanvasImageSource; width: number; height: number } {
  if (scale >= 1) return { source: bitmap, width, height };
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));
  const canvas = createCanvas(targetWidth, targetHeight);
  const context = get2dContext(canvas);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
  return { source: canvas, width: targetWidth, height: targetHeight };
}

export function scaleOperationsForPreview(
  operations: readonly Operation[],
  scale: number,
): Operation[] {
  if (scale >= 1) return operations.map((operation) => structuredClone(operation));
  return operations.map((operation) => {
    if (operation.type !== "resize" || operation.params.percent !== null) {
      return structuredClone(operation);
    }
    return {
      ...structuredClone(operation),
      params: {
        ...operation.params,
        width: Math.max(1, Math.round(operation.params.width * scale)),
        height: Math.max(1, Math.round(operation.params.height * scale)),
      },
    };
  });
}

export type ProgressListener = (progress: ProcessProgress) => void;

export async function processImage(
  request: ProcessRequest,
  onProgress: ProgressListener = () => {},
  preloadedEngine?: PixelforgeWasm,
): Promise<ProcessResult> {
  const started = performance.now();
  assertValidOperations(request.operations);
  const report = (stage: ProcessStage, progress: number) =>
    onProgress({ jobId: request.jobId, stage, progress });
  report("decode", 0.05);

  const wasm = preloadedEngine ?? (await loadPixelforgeWasm());
  const decoded = await decodeImage(request.source.blob);
  let watermarkBitmap: ImageBitmap | null = null;

  try {
    const finalDimensions = outputDimensions(
      { width: decoded.width, height: decoded.height },
      request.operations,
    );
    const preview = Boolean(request.preview);
    const scale = preview
      ? Math.min(
          1,
          (request.preview?.maxDimension ?? 1600) /
            Math.max(finalDimensions.width, finalDimensions.height),
        )
      : 1;

    const source = scaledSource(decoded.bitmap, decoded.width, decoded.height, scale);
    const operations = scaleOperationsForPreview(request.operations, scale);

    let watermark: { source: CanvasImageSource; width: number; height: number } | null = null;
    if (request.watermarkImage) {
      const decodedWatermark = await decodeImage(request.watermarkImage);
      watermarkBitmap = decodedWatermark.bitmap;
      watermark = {
        source: decodedWatermark.bitmap,
        width: decodedWatermark.width,
        height: decodedWatermark.height,
      };
    }

    report("resize", 0.15);
    const enabledCount = operations.filter((operation) => operation.enabled).length || 1;
    let rendered = 0;
    const renderedImage = renderOperations(source, operations, {
      wasm,
      watermarkImage: watermark,
      onStage: () => {
        rendered += 1;
        report("resize", 0.15 + (rendered / enabledCount) * 0.5);
      },
    });

    const outputWidth = renderedImage.width;
    const outputHeight = renderedImage.height;
    const encodeFormat = preview ? "png" : request.export.format;
    const canvas =
      !preview && request.export.format === "jpeg"
        ? flattenOntoBackground(
            renderedImage.canvas,
            outputWidth,
            outputHeight,
            request.export.background,
          )
        : renderedImage.canvas;

    report("encode", 0.72);

    let blob: Blob;
    let quality = preview ? 1 : request.export.quality;
    let targetMet: boolean | null = null;

    if (preview) {
      blob = await encodeCanvas(canvas, "png", 1);
    } else if (request.export.targetSizeBytes && FORMATS[request.export.format].lossy) {
      const encoded = new Map<number, Blob>();
      const result = await findTargetQuality(
        async (candidateQuality) => {
          const candidate = await encodeCanvas(canvas, request.export.format, candidateQuality);
          encoded.set(candidateQuality, candidate);
          return candidate.size;
        },
        request.export.targetSizeBytes,
        {
          initialQuality: request.export.quality,
          minQuality: 0.25,
          maxQuality: Math.max(0.6, request.export.quality),
          maxIterations: 7,
        },
      );
      quality = result.quality;
      targetMet = result.met;
      blob =
        encoded.get(result.quality) ??
        (await encodeCanvas(canvas, request.export.format, result.quality));
    } else {
      blob = await encodeCanvas(canvas, request.export.format, request.export.quality);
      if (request.export.targetSizeBytes) targetMet = false;
    }

    report("encode", 1);
    return {
      jobId: request.jobId,
      blob,
      width: outputWidth,
      height: outputHeight,
      format: encodeFormat,
      quality,
      targetMet,
      durationMs: performance.now() - started,
      preview,
    };
  } catch (error) {
    if (error instanceof PixelForgeError) throw error;
    throw new PixelForgeError(
      "WORKER_FAILED",
      `Image processing failed: ${error instanceof Error ? error.message : String(error)}`,
      "Try again, or use a smaller image.",
    );
  } finally {
    decoded.bitmap.close();
    watermarkBitmap?.close();
  }
}
