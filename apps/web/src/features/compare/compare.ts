import {
  type Context2D,
  createCanvas,
  decodeImage,
  encodeCanvas,
  get2dContext,
} from "@pixelforge/browser-image-io";
import { PixelForgeError } from "@pixelforge/image-contracts";
import { loadPixelforgeWasm } from "../../wasm/loader";
import { hammingSimilarity } from "./compare-math";

export interface CompareResult {
  diffBlob: Blob;
  width: number;
  height: number;
  mae: number;
  maxDifference: number;
  changedFraction: number;
  aHashSimilarity: number;
  dHashSimilarity: number;
  dimensionsA: { width: number; height: number };
  dimensionsB: { width: number; height: number };
}

function drawCover(
  context: Context2D,
  image: CanvasImageSource,
  imageWidth: number,
  imageHeight: number,
  width: number,
  height: number,
): void {
  const scale = Math.max(width / imageWidth, height / imageHeight);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  context.drawImage(
    image,
    (imageWidth - sourceWidth) / 2,
    (imageHeight - sourceHeight) / 2,
    sourceWidth,
    sourceHeight,
    0,
    0,
    width,
    height,
  );
}

export async function compareImages(
  aBlob: Blob,
  bBlob: Blob,
  amplify = 4,
  maxDimension = 1200,
): Promise<CompareResult> {
  const decodedA = await decodeImage(aBlob);
  const decodedB = await decodeImage(bBlob);
  try {
    const longest = Math.max(decodedA.width, decodedA.height);
    const scale = longest > maxDimension ? maxDimension / longest : 1;
    const width = Math.max(1, Math.round(decodedA.width * scale));
    const height = Math.max(1, Math.round(decodedA.height * scale));

    const canvasA = createCanvas(width, height);
    const contextA = get2dContext(canvasA);
    contextA.imageSmoothingEnabled = true;
    contextA.imageSmoothingQuality = "high";
    drawCover(contextA, decodedA.bitmap, decodedA.width, decodedA.height, width, height);
    const imageA = contextA.getImageData(0, 0, width, height);

    const canvasB = createCanvas(width, height);
    const contextB = get2dContext(canvasB);
    contextB.imageSmoothingEnabled = true;
    contextB.imageSmoothingQuality = "high";
    drawCover(contextB, decodedB.bitmap, decodedB.width, decodedB.height, width, height);
    const imageB = contextB.getImageData(0, 0, width, height);

    const aPixels = new Uint8Array(
      imageA.data.buffer,
      imageA.data.byteOffset,
      imageA.data.byteLength,
    );
    const bPixels = new Uint8Array(
      imageB.data.buffer,
      imageB.data.byteOffset,
      imageB.data.byteLength,
    );
    const wasm = await loadPixelforgeWasm();
    const difference = wasm.diff(aPixels, bPixels, width, height, 1);

    let sum = 0;
    let maxDifference = 0;
    let changed = 0;
    const pixels = width * height;
    for (let index = 0; index < pixels * 4; index += 4) {
      const dr = difference[index] ?? 0;
      const dg = difference[index + 1] ?? 0;
      const db = difference[index + 2] ?? 0;
      sum += dr + dg + db;
      const channelMax = Math.max(dr, dg, db);
      maxDifference = Math.max(maxDifference, channelMax);
      if (channelMax > 8) changed += 1;
    }

    const strength = Math.max(1, Math.min(32, amplify));
    const display = new Uint8ClampedArray(pixels * 4);
    for (let index = 0; index < pixels * 4; index += 4) {
      display[index] = Math.min(255, (difference[index] ?? 0) * strength);
      display[index + 1] = Math.min(255, (difference[index + 1] ?? 0) * strength);
      display[index + 2] = Math.min(255, (difference[index + 2] ?? 0) * strength);
      display[index + 3] = 255;
    }
    const diffCanvas = createCanvas(width, height);
    get2dContext(diffCanvas).putImageData(new ImageData(display, width, height), 0, 0);
    const diffBlob = await encodeCanvas(diffCanvas, "png", 1);

    const hashA = wasm.perceptualHash(aPixels, width, height);
    const hashB = wasm.perceptualHash(bPixels, width, height);
    const similarity = hammingSimilarity(hashA, hashB);

    return {
      diffBlob,
      width,
      height,
      mae: pixels > 0 ? sum / (pixels * 3) : 0,
      maxDifference,
      changedFraction: pixels > 0 ? changed / pixels : 0,
      aHashSimilarity: similarity.a,
      dHashSimilarity: similarity.d,
      dimensionsA: { width: decodedA.width, height: decodedA.height },
      dimensionsB: { width: decodedB.width, height: decodedB.height },
    };
  } catch (error) {
    if (error instanceof PixelForgeError) throw error;
    throw new PixelForgeError(
      "WORKER_FAILED",
      `Image comparison failed: ${error instanceof Error ? error.message : String(error)}`,
      "Try smaller images or a different pair.",
    );
  } finally {
    decodedA.bitmap.close();
    decodedB.bitmap.close();
  }
}
