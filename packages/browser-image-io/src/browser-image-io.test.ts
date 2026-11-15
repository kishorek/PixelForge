import { unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import {
  animationWarningFor,
  detectFormat,
  validateImageDimensions,
  validateOutputBlob,
  zipFiles,
} from "./index";

describe("validateImageDimensions", () => {
  it("accepts reasonable dimensions", () => {
    expect(validateImageDimensions(4000, 3000)).toEqual({ ok: true });
  });

  it("rejects zero and non-finite dimensions", () => {
    expect(validateImageDimensions(0, 100).ok).toBe(false);
    expect(validateImageDimensions(Number.NaN, 100).ok).toBe(false);
  });

  it("rejects an image above the pixel limit", () => {
    const result = validateImageDimensions(20_000, 20_000);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/120/);
  });

  it("rejects a dimension above the edge limit", () => {
    const result = validateImageDimensions(25_000, 100);
    expect(result.ok).toBe(false);
  });
});

describe("detectFormat", () => {
  it("detects supported mime types", () => {
    expect(detectFormat("image/jpeg", "a.bin")).toBe("jpeg");
    expect(detectFormat("image/png", "")).toBe("png");
    expect(detectFormat("image/webp", "")).toBe("webp");
    expect(detectFormat("image/avif", "")).toBe("avif");
  });

  it("falls back to the file extension", () => {
    expect(detectFormat("", "photo.JPG")).toBe("jpeg");
    expect(detectFormat("application/octet-stream", "photo.webp")).toBe("webp");
  });

  it("returns null for unsupported input", () => {
    expect(detectFormat("image/gif", "loop.gif")).toBeNull();
    expect(detectFormat("", "notes.txt")).toBeNull();
  });
});

describe("animationWarningFor", () => {
  it("warns for animated GIF input", () => {
    expect(animationWarningFor("image/gif")).toMatch(/first frame/i);
  });

  it("returns null for still images", () => {
    expect(animationWarningFor("image/png")).toBeNull();
  });
});

describe("validateOutputBlob", () => {
  it("rejects an empty or mismatched blob", () => {
    expect(validateOutputBlob(new Blob([]), "image/png").ok).toBe(false);
    expect(
      validateOutputBlob(new Blob([new Uint8Array([1])], { type: "image/png" }), "image/webp").ok,
    ).toBe(false);
  });

  it("accepts a non-empty blob of the requested type", () => {
    expect(
      validateOutputBlob(new Blob([new Uint8Array([1])], { type: "image/png" }), "image/png").ok,
    ).toBe(true);
  });
});

describe("zipFiles", () => {
  it("packages named entries into a zip blob", async () => {
    const zip = await zipFiles([
      { name: "one.txt", blob: new Blob(["hello"]) },
      { name: "two.txt", blob: new Blob(["world"]) },
    ]);
    expect(zip.type).toBe("application/zip");
    const entries = unzipSync(new Uint8Array(await zip.arrayBuffer()));
    expect(Object.keys(entries).sort()).toEqual(["one.txt", "two.txt"]);
    expect(new TextDecoder().decode(entries["one.txt"])).toBe("hello");
    expect(new TextDecoder().decode(entries["two.txt"])).toBe("world");
  });

  it("rejects an empty file list", async () => {
    await expect(zipFiles([])).rejects.toThrow();
  });
});
