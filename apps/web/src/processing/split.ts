import {
  createCanvas,
  decodeImage,
  encodeCanvas,
  get2dContext,
} from "@pixelforge/browser-image-io";
import { PixelForgeError } from "@pixelforge/image-contracts";
import type { ImageFormat } from "@pixelforge/image-contracts";
import { buildOutputNames } from "@pixelforge/operation-model";

export interface SplitRequest {
  source: Blob;
  rows: number;
  columns: number;
  format: ImageFormat;
  quality: number;
  filenameTemplate: string;
  baseName: string;
}

export interface SplitFile {
  name: string;
  blob: Blob;
  width: number;
  height: number;
  row: number;
  column: number;
}

export interface SplitResult {
  files: SplitFile[];
  width: number;
  height: number;
  rows: number;
  columns: number;
}

export async function renderSplit(request: SplitRequest): Promise<SplitResult> {
  const rows = Math.max(1, Math.min(10, Math.round(request.rows)));
  const columns = Math.max(1, Math.min(10, Math.round(request.columns)));
  const decoded = await decodeImage(request.source);
  const width = decoded.width;
  const height = decoded.height;

  try {
    const tiles: Omit<SplitFile, "name">[] = [];
    for (let row = 0; row < rows; row += 1) {
      const y0 = Math.floor((row * height) / rows);
      const y1 = Math.floor(((row + 1) * height) / rows);
      const tileHeight = Math.max(1, y1 - y0);

      for (let column = 0; column < columns; column += 1) {
        const x0 = Math.floor((column * width) / columns);
        const x1 = Math.floor(((column + 1) * width) / columns);
        const tileWidth = Math.max(1, x1 - x0);

        const canvas = createCanvas(tileWidth, tileHeight);
        const context = get2dContext(canvas);
        context.drawImage(
          decoded.bitmap,
          x0,
          y0,
          tileWidth,
          tileHeight,
          0,
          0,
          tileWidth,
          tileHeight,
        );
        const blob = await encodeCanvas(canvas, request.format, request.quality);
        tiles.push({
          blob,
          width: tileWidth,
          height: tileHeight,
          row: row + 1,
          column: column + 1,
        });
      }
    }

    const names = buildOutputNames(
      tiles.map((tile, index) => ({
        name: request.baseName,
        width: tile.width,
        height: tile.height,
        format: request.format,
        index: index + 1,
        row: tile.row,
        column: tile.column,
      })),
      request.filenameTemplate,
    );

    return {
      files: tiles.map((tile, index) => ({
        ...tile,
        name: names[index] ?? `tile-${index + 1}`,
      })),
      width,
      height,
      rows,
      columns,
    };
  } catch (error) {
    if (error instanceof PixelForgeError) throw error;
    throw new PixelForgeError(
      "WORKER_FAILED",
      `Split failed: ${error instanceof Error ? error.message : String(error)}`,
      "Try fewer tiles or a smaller image.",
    );
  } finally {
    decoded.bitmap.close();
  }
}
