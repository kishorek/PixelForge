import { PixelForgeError } from "@pixelforge/image-contracts";
import type {
  AdjustParams,
  ChromaKeyParams,
  FilterPreset,
  WarpParams,
} from "@pixelforge/image-contracts";
import wasmUrl from "./pixelforge.wasm?url";

const ABI_VERSION = 1;

function hexToRgb(value: string): [number, number, number] {
  const hex = value.replace("#", "");
  if (hex.length === 3) {
    return [
      Number.parseInt((hex[0] ?? "0").repeat(2), 16),
      Number.parseInt((hex[1] ?? "0").repeat(2), 16),
      Number.parseInt((hex[2] ?? "0").repeat(2), 16),
    ];
  }
  if (hex.length !== 6) return [0, 0, 0];
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ];
}

const FILTER_CODES: Record<FilterPreset, number> = {
  grayscale: 0,
  sepia: 1,
  invert: 2,
  blur: 3,
  sharpen: 4,
  emboss: 5,
  edge: 6,
  posterize: 7,
  vignette: 8,
};

interface PixelforgeExports extends WebAssembly.Exports {
  memory: WebAssembly.Memory;
  pf_abi_version(): number;
  pf_last_error(): number;
  pf_alloc(byteLength: number): number;
  pf_free(pointer: number, byteLength: number): void;
  pf_resize_kernel_rgba(
    input: number,
    output: number,
    scratch: number,
    width: number,
    height: number,
    newWidth: number,
    newHeight: number,
    method: number,
  ): number;
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
  pf_adjust_rgba(
    buffer: number,
    width: number,
    height: number,
    brightness: number,
    contrast: number,
    saturation: number,
    temperature: number,
    exposure: number,
    highlights: number,
    shadows: number,
    tint: number,
    gamma: number,
    vibrance: number,
  ): number;
  pf_filter_rgba(
    buffer: number,
    scratch: number,
    width: number,
    height: number,
    filter: number,
    intensity: number,
  ): number;
  pf_histogram_rgba(buffer: number, width: number, height: number, output: number): number;
  pf_warp_rgba(
    buffer: number,
    scratch: number,
    width: number,
    height: number,
    perspective: number,
    distortion: number,
    backgroundR: number,
    backgroundG: number,
    backgroundB: number,
    hasBackground: number,
  ): number;
  pf_chroma_key_rgba(
    buffer: number,
    width: number,
    height: number,
    keyR: number,
    keyG: number,
    keyB: number,
    tolerance: number,
    feather: number,
    invert: number,
    backgroundR: number,
    backgroundG: number,
    backgroundB: number,
    hasBackground: number,
  ): number;
  pf_diff_rgba(
    a: number,
    b: number,
    output: number,
    width: number,
    height: number,
    amplify: number,
  ): number;
  pf_perceptual_hash_rgba(buffer: number, width: number, height: number, output: number): number;
}

export type ResamplingMethodCode = 0 | 1 | 2 | 3 | 4;

export interface HistogramData {
  r: Uint32Array;
  g: Uint32Array;
  b: Uint32Array;
  luma: Uint32Array;
}

export interface PerceptualHash {
  aHashLo: number;
  aHashHi: number;
  dHashLo: number;
  dHashHi: number;
}

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
  adjust(rgba: Uint8Array, width: number, height: number, params: AdjustParams): Uint8Array;
  filter(
    rgba: Uint8Array,
    width: number,
    height: number,
    preset: FilterPreset,
    intensity: number,
  ): Uint8Array;
  histogram(rgba: Uint8Array, width: number, height: number): HistogramData;
  chromaKey(rgba: Uint8Array, width: number, height: number, params: ChromaKeyParams): Uint8Array;
  warp(rgba: Uint8Array, width: number, height: number, params: WarpParams): Uint8Array;
  diff(a: Uint8Array, b: Uint8Array, width: number, height: number, amplify: number): Uint8Array;
  perceptualHash(rgba: Uint8Array, width: number, height: number): PerceptualHash;
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
      const scratchLength = method >= 3 ? newWidth * height * 4 : 0;
      const scratchPointer = scratchLength > 0 ? allocate(scratchLength) : 0;
      try {
        new Uint8Array(exports.memory.buffer, inputPointer, rgba.length).set(rgba);
        const status =
          method >= 3
            ? exports.pf_resize_kernel_rgba(
                inputPointer,
                outputPointer,
                scratchPointer,
                width,
                height,
                newWidth,
                newHeight,
                method,
              )
            : exports.pf_resize_rgba(
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
        if (scratchPointer) exports.pf_free(scratchPointer, scratchLength);
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
    adjust(rgba, width, height, params) {
      const pointer = allocate(rgba.length);
      try {
        new Uint8Array(exports.memory.buffer, pointer, rgba.length).set(rgba);
        const status = exports.pf_adjust_rgba(
          pointer,
          width,
          height,
          params.brightness,
          params.contrast,
          params.saturation,
          params.temperature,
          params.exposure,
          params.highlights,
          params.shadows,
          params.tint,
          params.gamma,
          params.vibrance,
        );
        if (status !== 0) statusError(status);
        return read(pointer, rgba.length);
      } finally {
        exports.pf_free(pointer, rgba.length);
      }
    },
    filter(rgba, width, height, preset, intensity) {
      const pointer = allocate(rgba.length);
      const scratch = allocate(rgba.length);
      try {
        new Uint8Array(exports.memory.buffer, pointer, rgba.length).set(rgba);
        const status = exports.pf_filter_rgba(
          pointer,
          scratch,
          width,
          height,
          FILTER_CODES[preset],
          intensity,
        );
        if (status !== 0) statusError(status);
        return read(pointer, rgba.length);
      } finally {
        exports.pf_free(pointer, rgba.length);
        exports.pf_free(scratch, rgba.length);
      }
    },
    histogram(rgba, width, height) {
      const pointer = allocate(rgba.length);
      const outputSize = 4096;
      const rawOutput = allocate(outputSize + 4);
      const alignedOutput = Math.ceil(rawOutput / 4) * 4;
      try {
        new Uint8Array(exports.memory.buffer, pointer, rgba.length).set(rgba);
        const status = exports.pf_histogram_rgba(pointer, width, height, alignedOutput);
        if (status !== 0) statusError(status);
        const all = new Uint32Array(exports.memory.buffer, alignedOutput, 1024).slice();
        return {
          r: all.slice(0, 256),
          g: all.slice(256, 512),
          b: all.slice(512, 768),
          luma: all.slice(768, 1024),
        };
      } finally {
        exports.pf_free(pointer, rgba.length);
        exports.pf_free(rawOutput, outputSize + 4);
      }
    },
    diff(a, b, width, height, amplify) {
      const aPointer = allocate(a.length);
      const bPointer = allocate(b.length);
      const outputPointer = allocate(a.length);
      try {
        new Uint8Array(exports.memory.buffer, aPointer, a.length).set(a);
        new Uint8Array(exports.memory.buffer, bPointer, b.length).set(b);
        const status = exports.pf_diff_rgba(
          aPointer,
          bPointer,
          outputPointer,
          width,
          height,
          amplify,
        );
        if (status !== 0) statusError(status);
        return read(outputPointer, a.length);
      } finally {
        exports.pf_free(aPointer, a.length);
        exports.pf_free(bPointer, b.length);
        exports.pf_free(outputPointer, a.length);
      }
    },
    chromaKey(rgba, width, height, params) {
      const pointer = allocate(rgba.length);
      const [keyR, keyG, keyB] = hexToRgb(params.color);
      const [backgroundR, backgroundG, backgroundB] = params.background
        ? hexToRgb(params.background)
        : [0, 0, 0];
      try {
        new Uint8Array(exports.memory.buffer, pointer, rgba.length).set(rgba);
        const status = exports.pf_chroma_key_rgba(
          pointer,
          width,
          height,
          keyR,
          keyG,
          keyB,
          params.tolerance,
          params.feather,
          params.invert ? 1 : 0,
          backgroundR,
          backgroundG,
          backgroundB,
          params.background ? 1 : 0,
        );
        if (status !== 0) statusError(status);
        return read(pointer, rgba.length);
      } finally {
        exports.pf_free(pointer, rgba.length);
      }
    },
    warp(rgba, width, height, params) {
      const pointer = allocate(rgba.length);
      const scratch = allocate(rgba.length);
      const [backgroundR, backgroundG, backgroundB] = params.background
        ? hexToRgb(params.background)
        : [0, 0, 0];
      try {
        new Uint8Array(exports.memory.buffer, pointer, rgba.length).set(rgba);
        const status = exports.pf_warp_rgba(
          pointer,
          scratch,
          width,
          height,
          params.perspective,
          params.distortion,
          backgroundR,
          backgroundG,
          backgroundB,
          params.background ? 1 : 0,
        );
        if (status !== 0) statusError(status);
        return read(pointer, rgba.length);
      } finally {
        exports.pf_free(pointer, rgba.length);
        exports.pf_free(scratch, rgba.length);
      }
    },
    perceptualHash(rgba, width, height) {
      const pointer = allocate(rgba.length);
      const rawOutput = allocate(20);
      const alignedOutput = Math.ceil(rawOutput / 4) * 4;
      try {
        new Uint8Array(exports.memory.buffer, pointer, rgba.length).set(rgba);
        const status = exports.pf_perceptual_hash_rgba(pointer, width, height, alignedOutput);
        if (status !== 0) statusError(status);
        const values = new Uint32Array(exports.memory.buffer, alignedOutput, 4);
        return {
          aHashLo: values[0] ?? 0,
          aHashHi: values[1] ?? 0,
          dHashLo: values[2] ?? 0,
          dHashHi: values[3] ?? 0,
        };
      } finally {
        exports.pf_free(pointer, rgba.length);
        exports.pf_free(rawOutput, 20);
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
