import type { ImageFormat } from "@pixelforge/image-contracts";
import { decodeImage } from "./decode";
import { detectFormat } from "./inspect";

export interface MetadataField {
  label: string;
  value: string;
  group: string;
}

export interface ImageMetadata {
  fileName: string;
  mimeType: string;
  size: number;
  width: number;
  height: number;
  format: ImageFormat | null;
  fields: MetadataField[];
  warning: string | null;
}

function inBounds(bytes: Uint8Array, offset: number, length: number): boolean {
  return offset >= 0 && length >= 0 && offset + length <= bytes.length;
}

function readAscii(bytes: Uint8Array, offset: number, length: number): string {
  if (!inBounds(bytes, offset, length)) return "";
  let result = "";
  for (let index = 0; index < length; index += 1) {
    result += String.fromCharCode(bytes[offset + index] ?? 0);
  }
  return result;
}

function readU16(bytes: Uint8Array, offset: number, little: boolean): number | null {
  if (!inBounds(bytes, offset, 2)) return null;
  const a = bytes[offset] ?? 0;
  const b = bytes[offset + 1] ?? 0;
  return little ? a | (b << 8) : (a << 8) | b;
}

function readU32(bytes: Uint8Array, offset: number, little: boolean): number | null {
  if (!inBounds(bytes, offset, 4)) return null;
  const a = bytes[offset] ?? 0;
  const b = bytes[offset + 1] ?? 0;
  const c = bytes[offset + 2] ?? 0;
  const d = bytes[offset + 3] ?? 0;
  return little
    ? (a | (b << 8) | (c << 16) | (d << 24)) >>> 0
    : ((a << 24) | (b << 16) | (c << 8) | d) >>> 0;
}

const ORIENTATION: Record<number, string> = {
  1: "Normal",
  2: "Mirror horizontal",
  3: "Rotate 180°",
  4: "Mirror vertical",
  5: "Mirror horizontal and rotate 270°",
  6: "Rotate 90° clockwise",
  7: "Mirror horizontal and rotate 90°",
  8: "Rotate 270° clockwise",
};

const EXIF_LABELS: Record<number, string> = {
  270: "Image description",
  271: "Camera make",
  272: "Camera model",
  274: "Orientation",
  282: "X resolution",
  283: "Y resolution",
  296: "Resolution unit",
  305: "Software",
  306: "Last modified",
  315: "Artist",
  33432: "Copyright",
  33434: "Exposure time",
  33437: "Aperture",
  34855: "ISO",
  36867: "Date taken",
  36868: "Date digitised",
  37385: "Flash",
  37386: "Focal length",
  40962: "Pixel width",
  40963: "Pixel height",
  41989: "35 mm focal length",
  42036: "Lens",
  1: "GPS latitude ref",
  2: "GPS latitude",
  3: "GPS longitude ref",
  4: "GPS longitude",
  5: "GPS altitude ref",
  6: "GPS altitude",
};

function rational(value: unknown): number | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const numerator = Number(value[0]);
  const denominator = Number(value[1]);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return null;
  }
  return numerator / denominator;
}

function formatExifValue(tag: number, value: unknown): string {
  if (tag === 0x0112) {
    const orientation = Number(value);
    return ORIENTATION[orientation] ?? String(orientation);
  }
  if (tag === 0x829a) {
    const seconds = rational(value);
    if (seconds === null) return String(value);
    if (seconds > 0 && seconds < 1) return `1/${Math.round(1 / seconds)} s`;
    return `${seconds.toFixed(2)} s`;
  }
  if (tag === 0x829d) {
    const aperture = rational(value);
    return aperture === null ? String(value) : `f/${aperture.toFixed(1)}`;
  }
  if (tag === 0x920a) {
    const focal = rational(value);
    return focal === null ? String(value) : `${focal.toFixed(0)} mm`;
  }
  if (tag === 0x0002 || tag === 0x0004) {
    if (Array.isArray(value) && value.length >= 3) {
      const degrees = rational(value[0]);
      const minutes = rational(value[1]);
      const seconds = rational(value[2]);
      if (degrees !== null && minutes !== null && seconds !== null) {
        return `${(degrees + minutes / 60 + seconds / 3600).toFixed(6)}°`;
      }
    }
  }
  if (Array.isArray(value)) {
    if (value.every((item) => Array.isArray(item) && item.length === 2)) {
      return value
        .map((item) => {
          const number = rational(item);
          return number === null ? String(item) : number.toFixed(3);
        })
        .join(", ");
    }
    return value.map(String).join(", ");
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(Math.round(value * 1000) / 1000);
  }
  return String(value);
}

function typeSize(type: number): number {
  switch (type) {
    case 1:
    case 2:
    case 7:
      return 1;
    case 3:
      return 2;
    case 4:
    case 9:
    case 11:
      return 4;
    case 5:
    case 10:
    case 12:
      return 8;
    default:
      return 0;
  }
}

function readExifValue(
  bytes: Uint8Array,
  type: number,
  count: number,
  offset: number,
  little: boolean,
): unknown {
  const size = typeSize(type);
  if (size === 0 || count <= 0 || count > 4096) return null;
  if (!inBounds(bytes, offset, size * count)) return null;

  if (type === 1 || type === 7) {
    return Array.from(bytes.slice(offset, offset + count));
  }
  if (type === 2) {
    return readAscii(bytes, offset, count).replace(/\0+$/, "").trim();
  }
  if (type === 3) {
    const values: number[] = [];
    for (let index = 0; index < count; index += 1) {
      values.push(readU16(bytes, offset + index * 2, little) ?? 0);
    }
    return values.length === 1 ? (values[0] ?? 0) : values;
  }
  if (type === 4) {
    const values: number[] = [];
    for (let index = 0; index < count; index += 1) {
      values.push(readU32(bytes, offset + index * 4, little) ?? 0);
    }
    return values.length === 1 ? (values[0] ?? 0) : values;
  }
  if (type === 9) {
    const values: number[] = [];
    for (let index = 0; index < count; index += 1) {
      const raw = readU32(bytes, offset + index * 4, little) ?? 0;
      values.push(raw > 0x7fffffff ? raw - 0x100000000 : raw);
    }
    return values.length === 1 ? (values[0] ?? 0) : values;
  }
  if (type === 5 || type === 10) {
    const values: number[][] = [];
    for (let index = 0; index < count; index += 1) {
      const base = offset + index * 8;
      const numerator = readU32(bytes, base, little) ?? 0;
      const denominator = readU32(bytes, base + 4, little) ?? 1;
      values.push([numerator, denominator]);
    }
    return values.length === 1 ? (values[0] ?? [0, 1]) : values;
  }
  return null;
}

export function parseExifMetadata(bytes: Uint8Array, start = 0): MetadataField[] {
  const fields: MetadataField[] = [];
  if (!inBounds(bytes, start, 8)) return fields;
  const little = bytes[start] === 0x49 && bytes[start + 1] === 0x49;
  const big = bytes[start] === 0x4d && bytes[start + 1] === 0x4d;
  if (!little && !big) return fields;
  if (readU16(bytes, start + 2, little) !== 42) return fields;
  const firstIfd = readU32(bytes, start + 4, little);
  if (firstIfd === null) return fields;

  const visited = new Set<number>();
  let safety = 0;

  const parseIfd = (relativeOffset: number, group: string) => {
    safety += 1;
    if (safety > 16 || visited.has(relativeOffset)) return;
    visited.add(relativeOffset);
    const ifdOffset = start + relativeOffset;
    const count = readU16(bytes, ifdOffset, little);
    if (count === null || count > 512) return;

    for (let index = 0; index < count; index += 1) {
      const entry = ifdOffset + 2 + index * 12;
      if (!inBounds(bytes, entry, 12)) break;
      const tag = readU16(bytes, entry, little) ?? 0;
      const type = readU16(bytes, entry + 2, little) ?? 0;
      const valueCount = readU32(bytes, entry + 4, little) ?? 0;
      const size = typeSize(type) * valueCount;
      let valueOffset = entry + 8;
      if (size > 4) {
        const pointer = readU32(bytes, entry + 8, little);
        if (pointer === null) continue;
        valueOffset = start + pointer;
      }

      if (tag === 0x8769 || tag === 0x8825) {
        const pointer = readU32(bytes, entry + 8, little);
        if (pointer !== null) parseIfd(pointer, tag === 0x8825 ? "GPS" : group);
        continue;
      }

      const label = EXIF_LABELS[tag];
      if (!label) continue;
      const value = readExifValue(bytes, type, valueCount, valueOffset, little);
      if (value === null) continue;
      const formatted = formatExifValue(tag, value);
      if (formatted.length === 0) continue;
      fields.push({ label, value: formatted, group });
    }
  };

  parseIfd(firstIfd, "EXIF");
  return fields;
}

const PNG_COLOUR_TYPE: Record<number, string> = {
  0: "Grayscale",
  2: "RGB",
  3: "Palette",
  4: "Grayscale + alpha",
  6: "RGBA",
};

function pngChunk(
  bytes: Uint8Array,
  offset: number,
): {
  type: string;
  data: Uint8Array;
  next: number;
} | null {
  const length = readU32(bytes, offset, false);
  if (length === null || length > bytes.length) return null;
  if (!inBounds(bytes, offset + 8, length + 4)) return null;
  const type = readAscii(bytes, offset + 4, 4);
  const data = bytes.slice(offset + 8, offset + 8 + length);
  return { type, data, next: offset + 8 + length + 4 };
}

export function parsePngMetadata(bytes: Uint8Array): MetadataField[] {
  if (readAscii(bytes, 0, 8) !== "\x89PNG\r\n\x1a\n") return [];
  const fields: MetadataField[] = [];
  let offset = 8;
  let safety = 0;
  while (offset < bytes.length && safety < 2048) {
    safety += 1;
    const chunk = pngChunk(bytes, offset);
    if (!chunk) break;
    const { type, data } = chunk;

    if (type === "IHDR" && data.length >= 13) {
      const width = readU32(data, 0, false);
      const height = readU32(data, 4, false);
      fields.push({ label: "Width", value: `${width ?? "?"} px`, group: "Image" });
      fields.push({ label: "Height", value: `${height ?? "?"} px`, group: "Image" });
      fields.push({ label: "Bit depth", value: `${data[8] ?? "?"}-bit`, group: "Image" });
      fields.push({
        label: "Colour type",
        value: PNG_COLOUR_TYPE[data[9] ?? -1] ?? `Type ${data[9]}`,
        group: "Image",
      });
    } else if (type === "pHYs" && data.length >= 9) {
      const x = readU32(data, 0, false) ?? 0;
      const y = readU32(data, 4, false) ?? 0;
      const unit = data[8] ?? 0;
      if (unit === 1) {
        fields.push({
          label: "Resolution",
          value: `${Math.round(x * 0.0254)} × ${Math.round(y * 0.0254)} DPI`,
          group: "Image",
        });
      } else {
        fields.push({
          label: "Resolution",
          value: `${x} × ${y} px (unknown unit)`,
          group: "Image",
        });
      }
    } else if (type === "tEXt") {
      const text = new TextDecoder("latin1").decode(data);
      const separator = text.indexOf("\0");
      if (separator > 0) {
        fields.push({
          label: text.slice(0, separator),
          value: text.slice(separator + 1).slice(0, 500),
          group: "Text",
        });
      }
    } else if (type === "iTXt") {
      const text = new TextDecoder("utf-8").decode(data);
      const keyword = text.split("\0")[0] ?? "";
      if (keyword) fields.push({ label: keyword, value: "(international text)", group: "Text" });
    } else if (type === "zTXt") {
      const text = new TextDecoder("latin1").decode(data);
      const keyword = text.split("\0")[0] ?? "";
      if (keyword) fields.push({ label: keyword, value: "(compressed text)", group: "Text" });
    } else if (type === "eXIf") {
      fields.push(...parseExifMetadata(data, 0));
    } else if (type === "iCCP") {
      const text = new TextDecoder("latin1").decode(data);
      const name = text.split("\0")[0] ?? "";
      fields.push({ label: "ICC profile", value: name || "Present", group: "Colour" });
    } else if (type === "gAMA" && data.length >= 4) {
      const gamma = (readU32(data, 0, false) ?? 0) / 100000;
      fields.push({ label: "Gamma", value: gamma.toFixed(2), group: "Colour" });
    } else if (type === "sRGB" && data.length >= 1) {
      const intent = ["Perceptual", "Relative colorimetric", "Saturation", "Absolute colorimetric"][
        data[0] ?? 0
      ];
      fields.push({ label: "sRGB intent", value: intent ?? String(data[0]), group: "Colour" });
    } else if (type === "tIME" && data.length >= 7) {
      fields.push({
        label: "Last modified",
        value: `${data[0] ?? 0}-${String(data[1] ?? 0).padStart(2, "0")}-${String(data[2] ?? 0).padStart(2, "0")} ${String(data[3] ?? 0).padStart(2, "0")}:${String(data[4] ?? 0).padStart(2, "0")}:${String(data[5] ?? 0).padStart(2, "0")} UTC`,
        group: "Text",
      });
    } else if (type === "acTL") {
      fields.push({
        label: "Animated PNG",
        value: "Yes — first frame is processed",
        group: "Image",
      });
    } else if (type === "IEND") {
      break;
    }

    offset = chunk.next;
  }
  return fields;
}

export function parseJpegMetadata(bytes: Uint8Array): MetadataField[] {
  if ((bytes[0] ?? 0) !== 0xff || (bytes[1] ?? 0) !== 0xd8) return [];
  const fields: MetadataField[] = [];
  let offset = 2;
  let safety = 0;

  while (offset + 4 <= bytes.length && safety < 4096) {
    safety += 1;
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1] ?? 0;
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    if (marker === 0xda || marker === 0xd9) break;
    const length = readU16(bytes, offset + 2, false);
    if (length === null || length < 2 || !inBounds(bytes, offset + 4, length - 2)) break;
    const dataStart = offset + 4;
    const dataLength = length - 2;
    const prefix = readAscii(bytes, dataStart, Math.min(dataLength, 40));

    if (marker === 0xe0 && prefix.startsWith("JFIF\0")) {
      const major = bytes[dataStart + 5] ?? 0;
      const minor = bytes[dataStart + 6] ?? 0;
      const unit = bytes[dataStart + 7] ?? 0;
      const densityX = readU16(bytes, dataStart + 8, false) ?? 0;
      const densityY = readU16(bytes, dataStart + 10, false) ?? 0;
      fields.push({ label: "JFIF", value: `${major}.${minor}`, group: "Image" });
      if (unit === 1) {
        fields.push({
          label: "Resolution",
          value: `${densityX} × ${densityY} DPI`,
          group: "Image",
        });
      } else if (unit === 2) {
        fields.push({
          label: "Resolution",
          value: `${Math.round(densityX * 2.54)} × ${Math.round(densityY * 2.54)} DPI`,
          group: "Image",
        });
      }
    } else if (marker === 0xe1 && prefix.startsWith("Exif\0\0")) {
      fields.push(...parseExifMetadata(bytes, dataStart + 6));
    } else if (marker === 0xe1 && prefix.startsWith("http://ns.adobe.com/xap/1.0/")) {
      fields.push({ label: "XMP metadata", value: "Present", group: "Metadata" });
    } else if (marker === 0xe2 && prefix.startsWith("ICC_PROFILE\0")) {
      fields.push({ label: "ICC profile", value: "Present", group: "Colour" });
    } else if (marker === 0xed && prefix.startsWith("Photoshop")) {
      fields.push({ label: "Photoshop metadata", value: "Present", group: "Metadata" });
    } else if (marker === 0xfe) {
      fields.push({
        label: "Comment",
        value: readAscii(bytes, dataStart, Math.min(dataLength, 500)),
        group: "Text",
      });
    } else if (
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)
    ) {
      const precision = bytes[dataStart] ?? 0;
      const height = readU16(bytes, dataStart + 1, false) ?? 0;
      const width = readU16(bytes, dataStart + 3, false) ?? 0;
      fields.push({ label: "JPEG precision", value: `${precision}-bit`, group: "Image" });
      fields.push({ label: "Encoded size", value: `${width} × ${height} px`, group: "Image" });
    }

    offset += 2 + length;
  }
  return fields;
}

export function parseWebpMetadata(bytes: Uint8Array): MetadataField[] {
  if (readAscii(bytes, 0, 4) !== "RIFF" || readAscii(bytes, 8, 4) !== "WEBP") return [];
  const fields: MetadataField[] = [];
  let offset = 12;
  let safety = 0;

  while (offset + 8 <= bytes.length && safety < 2048) {
    safety += 1;
    const type = readAscii(bytes, offset, 4);
    const size = readU32(bytes, offset + 4, true);
    if (size === null || !inBounds(bytes, offset + 8, size)) break;
    const dataStart = offset + 8;

    if (type === "VP8X" && size >= 10) {
      const flags = bytes[dataStart] ?? 0;
      const width =
        ((bytes[dataStart + 4] ?? 0) |
          ((bytes[dataStart + 5] ?? 0) << 8) |
          ((bytes[dataStart + 6] ?? 0) << 16)) +
        1;
      const height =
        ((bytes[dataStart + 7] ?? 0) |
          ((bytes[dataStart + 8] ?? 0) << 8) |
          ((bytes[dataStart + 9] ?? 0) << 16)) +
        1;
      fields.push({ label: "Extended WebP", value: "Yes", group: "Image" });
      fields.push({ label: "Canvas size", value: `${width} × ${height} px`, group: "Image" });
      fields.push({ label: "Alpha", value: flags & 0x10 ? "Yes" : "No", group: "Image" });
      fields.push({ label: "Animated", value: flags & 0x02 ? "Yes" : "No", group: "Image" });
      if (flags & 0x20) fields.push({ label: "ICC profile", value: "Present", group: "Colour" });
      if (flags & 0x08)
        fields.push({ label: "EXIF metadata", value: "Present", group: "Metadata" });
      if (flags & 0x04) fields.push({ label: "XMP metadata", value: "Present", group: "Metadata" });
    } else if (type === "ICCP") {
      fields.push({ label: "ICC profile", value: "Present", group: "Colour" });
    } else if (type === "EXIF") {
      const prefix = readAscii(bytes, dataStart, Math.min(size, 6));
      fields.push(...parseExifMetadata(bytes, dataStart + (prefix.startsWith("Exif") ? 6 : 0)));
    } else if (type === "XMP ") {
      fields.push({ label: "XMP metadata", value: "Present", group: "Metadata" });
    } else if (type === "ANIM" || type === "ANMF") {
      fields.push({
        label: "Animated WebP",
        value: "Yes — first frame is processed",
        group: "Image",
      });
    }

    offset = dataStart + size + (size % 2);
  }
  return fields;
}

export async function readImageMetadata(blob: Blob, fileName: string): Promise<ImageMetadata> {
  const format = detectFormat(blob.type, fileName);
  const decoded = await decodeImage(blob);
  const width = decoded.width;
  const height = decoded.height;
  decoded.bitmap.close();

  const header = new Uint8Array(
    await blob.slice(0, Math.min(blob.size, 4 * 1024 * 1024)).arrayBuffer(),
  );
  let fields: MetadataField[] = [];
  if (format === "png") fields = parsePngMetadata(header);
  else if (format === "jpeg") fields = parseJpegMetadata(header);
  else if (format === "webp") fields = parseWebpMetadata(header);

  const base: MetadataField[] = [
    { label: "File name", value: fileName, group: "File" },
    { label: "Type", value: blob.type || "unknown", group: "File" },
    { label: "Size", value: `${Math.round(blob.size / 1024)} KB`, group: "File" },
    { label: "Dimensions", value: `${width} × ${height} px`, group: "Image" },
    { label: "Format", value: format?.toUpperCase() ?? "Unknown", group: "File" },
  ];

  return {
    fileName,
    mimeType: blob.type,
    size: blob.size,
    width,
    height,
    format,
    fields: [...base, ...fields],
    warning:
      fields.length === 0
        ? "No container or EXIF metadata was found in the readable header."
        : null,
  };
}
