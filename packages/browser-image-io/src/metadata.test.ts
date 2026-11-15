import { describe, expect, it } from "vitest";
import { parseExifMetadata, parsePngMetadata } from "./metadata";

function u16le(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >> 8) & 0xff;
}

function u32le(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >> 8) & 0xff;
  bytes[offset + 2] = (value >> 16) & 0xff;
  bytes[offset + 3] = (value >> 24) & 0xff;
}

function writeAscii(bytes: Uint8Array, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    bytes[offset + index] = value.charCodeAt(index);
  }
}

describe("parseExifMetadata", () => {
  it("reads make, model and orientation from a little-endian TIFF", () => {
    const bytes = new Uint8Array(64);
    bytes[0] = 0x49;
    bytes[1] = 0x49;
    u16le(bytes, 2, 42);
    u32le(bytes, 4, 8);
    u16le(bytes, 8, 3);

    u16le(bytes, 10, 0x010f);
    u16le(bytes, 12, 2);
    u32le(bytes, 14, 6);
    u32le(bytes, 18, 50);

    u16le(bytes, 22, 0x0110);
    u16le(bytes, 24, 2);
    u32le(bytes, 26, 3);
    writeAscii(bytes, 30, "R6");

    u16le(bytes, 34, 0x0112);
    u16le(bytes, 36, 3);
    u32le(bytes, 38, 1);
    bytes[42] = 6;

    u32le(bytes, 46, 0);
    writeAscii(bytes, 50, "Canon\0");
    writeAscii(bytes, 56, "R6\0");

    const fields = parseExifMetadata(bytes, 0);
    expect(fields.find((field) => field.label === "Camera make")?.value).toBe("Canon");
    expect(fields.find((field) => field.label === "Camera model")?.value).toBe("R6");
    expect(fields.find((field) => field.label === "Orientation")?.value).toBe(
      "Rotate 90° clockwise",
    );
  });

  it("ignores malformed data", () => {
    expect(parseExifMetadata(new Uint8Array([1, 2, 3]), 0)).toEqual([]);
  });
});

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const result = new Uint8Array(12 + data.length);
  result[0] = (data.length >>> 24) & 0xff;
  result[1] = (data.length >>> 16) & 0xff;
  result[2] = (data.length >>> 8) & 0xff;
  result[3] = data.length & 0xff;
  writeAscii(result, 4, type);
  result.set(data, 8);
  return result;
}

function makePng(): Uint8Array {
  const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = new Uint8Array(13);
  ihdr[0] = 0;
  ihdr[1] = 0;
  ihdr[2] = 0;
  ihdr[3] = 10;
  ihdr[4] = 0;
  ihdr[5] = 0;
  ihdr[6] = 0;
  ihdr[7] = 20;
  ihdr[8] = 8;
  ihdr[9] = 6;
  const phys = new Uint8Array(9);
  phys[0] = 0;
  phys[1] = 0;
  phys[2] = 0x2e;
  phys[3] = 0x23;
  phys[4] = 0;
  phys[5] = 0;
  phys[6] = 0x2e;
  phys[7] = 0x23;
  phys[8] = 1;
  const text = new TextEncoder().encode("Author\0PixelForge");
  const idat = new Uint8Array([0x78, 0x9c, 0x03, 0x00, 0x00, 0x00, 0x00, 0x01]);
  return new Uint8Array([
    ...signature,
    ...pngChunk("IHDR", ihdr),
    ...pngChunk("pHYs", phys),
    ...pngChunk("tEXt", text),
    ...pngChunk("IDAT", idat),
    ...pngChunk("IEND", new Uint8Array()),
  ]);
}

describe("parsePngMetadata", () => {
  it("reads dimensions, resolution and text chunks", () => {
    const fields = parsePngMetadata(makePng());
    expect(fields.find((field) => field.label === "Width")?.value).toBe("10 px");
    expect(fields.find((field) => field.label === "Height")?.value).toBe("20 px");
    expect(fields.find((field) => field.label === "Colour type")?.value).toBe("RGBA");
    expect(fields.find((field) => field.label === "Resolution")?.value).toBe("300 × 300 DPI");
    expect(fields.find((field) => field.label === "Author")?.value).toBe("PixelForge");
  });
});
