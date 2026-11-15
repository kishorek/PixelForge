import type { ImageFormat } from "@pixelforge/image-contracts";

const EXTENSION_BY_FORMAT: Record<ImageFormat, string> = {
  jpeg: "jpg",
  png: "png",
  webp: "webp",
  avif: "avif",
};

function stripExtension(name: string): string {
  const lastDot = name.lastIndexOf(".");
  const base = lastDot > 0 ? name.slice(0, lastDot) : name;
  return base.trim();
}

function sanitise(value: string): string {
  return value
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export interface FilenameInfo {
  name: string;
  width: number;
  height: number;
  format: ImageFormat;
  index: number;
}

export function formatFilename(template: string, info: FilenameInfo): string {
  const base = sanitise(stripExtension(info.name)) || "image";
  const effectiveTemplate = template.trim().length > 0 ? template : "{name}";
  const extension = EXTENSION_BY_FORMAT[info.format];

  let stem = effectiveTemplate
    .replaceAll("{name}", base)
    .replaceAll("{width}", String(Math.round(info.width)))
    .replaceAll("{height}", String(Math.round(info.height)))
    .replaceAll("{format}", extension)
    .replaceAll("{index}", String(info.index));

  stem = sanitise(stem);
  if (stem.length === 0) stem = base;
  if (!stem.toLowerCase().endsWith(`.${extension}`)) stem = `${stem}.${extension}`;
  return stem;
}

export function buildOutputNames(items: readonly FilenameInfo[], template: string): string[] {
  const used = new Set<string>();
  const results: string[] = [];

  for (const item of items) {
    const candidate = formatFilename(template, item);
    let finalName = candidate;
    let suffix = 2;
    while (used.has(finalName.toLowerCase())) {
      const dot = candidate.lastIndexOf(".");
      const stem = dot > 0 ? candidate.slice(0, dot) : candidate;
      const extension = dot > 0 ? candidate.slice(dot) : "";
      finalName = `${stem}-${suffix}${extension}`;
      suffix += 1;
    }
    used.add(finalName.toLowerCase());
    results.push(finalName);
  }

  return results;
}

function trimDecimal(value: number): string {
  const fixed = value.toFixed(1);
  return fixed.endsWith(".0") ? fixed.slice(0, -2) : fixed;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) return `${trimDecimal(kilobytes)} KB`;
  const megabytes = kilobytes / 1024;
  if (megabytes < 1024) return `${trimDecimal(megabytes)} MB`;
  return `${trimDecimal(megabytes / 1024)} GB`;
}

export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "0%";
  return `${Math.round(value * 100)}%`;
}
