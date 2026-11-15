import { PixelForgeError } from "@pixelforge/image-contracts";
import wasmUrl from "./pixelforge.wasm?url";

const ABI_VERSION = 1;

interface PixelforgeExports extends WebAssembly.Exports {
  memory: WebAssembly.Memory;
  pf_abi_version(): number;
  pf_last_error(): number;
  pf_alloc(byteLength: number): number;
  pf_free(pointer: number, byteLength: number): void;
  pf_resize_rgba(
    input: number,
    output: number,
    width: number,
    height: number,
    newWidth: number,
    newHeight: number,
    method: number,
  ): number;
  pf_crop_rgba(
    input: number,
    output: number,
    width: number,
    height: number,
    x: number,
    y: number,
    cropWidth: number,
    cropHeight: number,
  ): number;
  pf_flip_rgba(buffer: number, width: number, height: number, horizontal: number): number;
  pf_rotate90_rgba(
    input: number,
    output: number,
    width: number,
    height: number,
    clockwise: number,
  ): number;
}

export type ResamplingMethodCode = 0 | 1 | 2;

export interface PixelforgeWasm {
  readonly abiVersion: number;
  resize(
    rgba: Uint8Array,
    width: number,
    height: number,
    newWidth: number,
    newHeight: number,
    method: ResamplingMethodCode,
  ): Uint8Array;
  crop(
    rgba: Uint8Array,
    width: number,
    height: number,
    x: number,
    y: number,
    cropWidth: number,
    cropHeight: number,
  ): Uint8Array;
  flipInPlace(rgba: Uint8Array, width: number, height: number, horizontal: boolean): Uint8Array;
  rotate90(rgba: Uint8Array, width: number, height: number, clockwise: boolean): Uint8Array;
}

const ERROR_MESSAGES: Record<number, string> = {
  1: "The image engine rejected the request arguments.",
  2: "The image is too large for the engine buffer limit.",
  3: "The image engine could not allocate memory.",
  4: "The requested operation is not supported by the image engine.",
  5: "The image region is outside the source bounds.",
  6: "The pixel buffer length did not match the image dimensions.",
  7: "The image engine encountered an internal error.",
};

function createEngine(exports: PixelforgeExports): PixelforgeWasm {
  const abiVersion = exports.pf_abi_version();
  if (abiVersion !== ABI_VERSION) {
    throw new PixelForgeError(
      "WASM_ERROR",
      `The image engine ABI version ${abiVersion} does not match the expected version ${ABI_VERSION}.`,
      "Rebuild the application so the JavaScript and WebAssembly bundles match.",
    );
  }

  const statusError = (status: number): never => {
    const code = status === 0 ? exports.pf_last_error() : status;
    throw new PixelForgeError(
      "WASM_ERROR",
      ERROR_MESSAGES[code] ?? `The image engine returned status ${status}.`,
    );
  };

  const allocate = (length: number): number => {
    const pointer = exports.pf_alloc(length);
    if (!pointer)
      throw new PixelForgeError("WASM_ERROR", "The image engine could not allocate memory.");
    return pointer;
  };

  const read = (pointer: number, length: number): Uint8Array =>
    new Uint8Array(exports.memory.buffer, pointer, length).slice();

  return {
    abiVersion,
    resize(rgba, width, height, newWidth, newHeight, method) {
      const outputLength = newWidth * newHeight * 4;
      const inputPointer = allocate(rgba.length);
      const outputPointer = allocate(outputLength);
      try {
        new Uint8Array(exports.memory.buffer, inputPointer, rgba.length).set(rgba);
        const status = exports.pf_resize_rgba(
          inputPointer,
          outputPointer,
          width,
          height,
          newWidth,
          newHeight,
          method,
        );
        if (status !== 0) statusError(status);
        return read(outputPointer, outputLength);
      } finally {
        exports.pf_free(inputPointer, rgba.length);
        exports.pf_free(outputPointer, outputLength);
      }
    },
    crop(rgba, width, height, x, y, cropWidth, cropHeight) {
      const outputLength = cropWidth * cropHeight * 4;
      const inputPointer = allocate(rgba.length);
      const outputPointer = allocate(outputLength);
      try {
        new Uint8Array(exports.memory.buffer, inputPointer, rgba.length).set(rgba);
        const status = exports.pf_crop_rgba(
          inputPointer,
          outputPointer,
          width,
          height,
          x,
          y,
          cropWidth,
          cropHeight,
        );
        if (status !== 0) statusError(status);
        return read(outputPointer, outputLength);
      } finally {
        exports.pf_free(inputPointer, rgba.length);
        exports.pf_free(outputPointer, outputLength);
      }
    },
    flipInPlace(rgba, width, height, horizontal) {
      const bufferPointer = allocate(rgba.length);
      try {
        new Uint8Array(exports.memory.buffer, bufferPointer, rgba.length).set(rgba);
        const status = exports.pf_flip_rgba(bufferPointer, width, height, horizontal ? 1 : 0);
        if (status !== 0) statusError(status);
        return read(bufferPointer, rgba.length);
      } finally {
        exports.pf_free(bufferPointer, rgba.length);
      }
    },
    rotate90(rgba, width, height, clockwise) {
      const outputLength = width * height * 4;
      const inputPointer = allocate(rgba.length);
      const outputPointer = allocate(outputLength);
      try {
        new Uint8Array(exports.memory.buffer, inputPointer, rgba.length).set(rgba);
        const status = exports.pf_rotate90_rgba(
          inputPointer,
          outputPointer,
          width,
          height,
          clockwise ? 1 : 0,
        );
        if (status !== 0) statusError(status);
        return read(outputPointer, outputLength);
      } finally {
        exports.pf_free(inputPointer, rgba.length);
        exports.pf_free(outputPointer, outputLength);
      }
    },
  };
}

let enginePromise: Promise<PixelforgeWasm> | null = null;

export function loadPixelforgeWasm(): Promise<PixelforgeWasm> {
  if (!enginePromise) {
    enginePromise = (async () => {
      const response = await fetch(wasmUrl);
      if (!response.ok) {
        throw new PixelForgeError("WASM_ERROR", "The image engine file could not be loaded.");
      }
      const bytes = await response.arrayBuffer();
      const { instance } = await WebAssembly.instantiate(bytes, {});
      return createEngine(instance.exports as PixelforgeExports);
    })().catch((error) => {
      enginePromise = null;
      if (error instanceof PixelForgeError) throw error;
      throw new PixelForgeError(
        "WASM_ERROR",
        `The image engine failed to initialise: ${error instanceof Error ? error.message : String(error)}`,
        "Reload the page. If the problem continues, try another browser.",
      );
    });
  }
  return enginePromise;
}
