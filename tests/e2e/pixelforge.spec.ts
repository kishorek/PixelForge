import { readFileSync } from "node:fs";
import { type Page, expect, test } from "@playwright/test";
import { unzipSync } from "fflate";
import { encodePng, pngSize } from "../fixtures/png";

const HOME = "/PixelForge/";

function landscape(): Buffer {
  return encodePng(1200, 800, (x, y) => {
    const band = ((x >> 4) + (y >> 4)) % 2 === 0 ? 14 : 0;
    return [
      Math.max(0, Math.round((255 * x) / 1199) - band),
      Math.max(0, Math.round((255 * y) / 799) - band),
      Math.round(255 * (1 - x / 1199)),
      255,
    ];
  });
}

function portrait(): Buffer {
  return encodePng(600, 900, (x, y) => [
    Math.round((255 * y) / 899),
    90,
    Math.round((255 * x) / 599),
    255,
  ]);
}

function transparent(): Buffer {
  return encodePng(400, 300, (_x, y) => [220, 30, 30, Math.round(255 * (1 - y / 299))]);
}

async function importImages(
  page: Page,
  files: { name: string; buffer: Buffer }[],
  expected: number,
): Promise<void> {
  const input = page.locator('input[type="file"]').first();
  await input.setInputFiles(
    files.map((file) => ({ name: file.name, mimeType: "image/png", buffer: file.buffer })),
  );
  await expect(page.getByText(new RegExp(`${expected} image`))).toBeVisible({ timeout: 20_000 });
}

async function go(page: Page, path: string): Promise<void> {
  await page.evaluate((hash) => {
    window.location.hash = hash;
  }, `#${path}`);
  await expect(page).toHaveURL(new RegExp(`#${path}$`));
}

async function waitForPreview(page: Page): Promise<void> {
  await expect(page.locator('img[alt^="Edited preview"]').first()).toBeVisible({ timeout: 30_000 });
}

async function fetchDownload(
  page: Page,
  name: RegExp | string,
): Promise<{ buffer: Buffer; filename: string; size: number }> {
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 60_000 }),
    page.getByRole("button", { name }).first().click(),
  ]);
  const path = await download.path();
  if (!path) throw new Error("Download did not produce a file path.");
  const buffer = readFileSync(path);
  return { buffer, filename: download.suggestedFilename(), size: buffer.length };
}

test("home renders and the mobile layout has no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(HOME);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText("Local only").first()).toBeVisible();
  await page.screenshot({ path: "/tmp/opencode/home-desktop.png", fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(HOME);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  await page.screenshot({ path: "/tmp/opencode/home-mobile.png", fullPage: true });
});

test("resize exports exactly the requested dimensions", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(HOME);
  await importImages(page, [{ name: "landscape.png", buffer: landscape() }], 1);
  await go(page, "/tools/resize");
  await waitForPreview(page);
  await page.screenshot({ path: "/tmp/opencode/resize-tool.png", fullPage: true });

  await page.getByLabel("Width", { exact: true }).fill("300");
  await expect(page.getByLabel("Height", { exact: true })).toHaveValue("200");
  await page.getByLabel("Format", { exact: true }).selectOption("png");

  const output = await fetchDownload(page, "Render & download");
  expect(output.filename).toBe("landscape-300x200.png");
  expect(pngSize(output.buffer)).toEqual({ width: 300, height: 200 });
});

test("convert flattens a transparent PNG onto a JPEG background", async ({ page }) => {
  await page.goto(HOME);
  await importImages(page, [{ name: "transparent.png", buffer: transparent() }], 1);
  await go(page, "/tools/convert");
  await waitForPreview(page);

  await page.getByLabel("Format", { exact: true }).selectOption("jpeg");
  const output = await fetchDownload(page, "Render & download");
  expect(output.filename).toBe("transparent-400x300.jpg");
  expect(output.buffer[0]).toBe(0xff);
  expect(output.buffer[1]).toBe(0xd8);
});

test("compression reaches a best-effort target size", async ({ page }) => {
  await page.goto(HOME);
  await importImages(page, [{ name: "landscape.png", buffer: landscape() }], 1);
  await go(page, "/tools/compress");
  await waitForPreview(page);

  await page.getByLabel("Format", { exact: true }).selectOption("webp");
  await page.getByLabel("Target size", { exact: true }).fill("40");
  const output = await fetchDownload(page, "Render & download");
  expect(output.filename).toBe("landscape-1200x800.webp");
  expect(output.size).toBeGreaterThan(0);
  expect(output.size).toBeLessThanOrEqual(45 * 1024);
  await expect(page.getByText(/Target size met|Target not met/)).toBeVisible();
});

test("crop selection exports a smaller region", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(HOME);
  await importImages(page, [{ name: "landscape.png", buffer: landscape() }], 1);
  await go(page, "/tools/crop");

  const frame = page.locator(".crop-frame");
  await expect(frame).toBeVisible({ timeout: 20_000 });
  const box = await frame.boundingBox();
  if (!box) throw new Error("Crop frame has no bounding box.");
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.25);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.75, { steps: 12 });
  await page.mouse.up();

  await page.getByLabel("Format", { exact: true }).selectOption("png");
  const output = await fetchDownload(page, "Render & download");
  const size = pngSize(output.buffer);
  expect(size.width).toBeGreaterThan(560);
  expect(size.width).toBeLessThan(640);
  expect(size.height).toBeGreaterThan(360);
  expect(size.height).toBeLessThan(440);
});

test("watermark renders through the shared pipeline", async ({ page }) => {
  await page.goto(HOME);
  await importImages(page, [{ name: "landscape.png", buffer: landscape() }], 1);
  await go(page, "/tools/watermark");
  await waitForPreview(page);

  await expect(page.getByLabel("Watermark text")).toHaveValue("PixelForge");
  await page.getByLabel("Format", { exact: true }).selectOption("png");
  const output = await fetchDownload(page, "Render & download");
  expect(pngSize(output.buffer)).toEqual({ width: 1200, height: 800 });
});

test("editor supports add, undo, redo and comparison", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(HOME);
  await importImages(page, [{ name: "landscape.png", buffer: landscape() }], 1);
  await go(page, "/editor");
  await waitForPreview(page);

  await expect(page.getByRole("button", { name: "Undo" })).toBeDisabled();
  await page.getByRole("button", { name: "Add operation" }).click();
  await page.getByRole("menuitem", { name: /^Rotate/ }).click();
  await expect(page.getByText("Rotate", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Undo" })).toBeEnabled();

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText(/No operations yet/)).toBeVisible();
  await page.getByRole("button", { name: "Redo" }).click();
  await expect(page.getByText("Rotate", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "Compare with original" }).click();
  await expect(
    page.getByRole("slider", { name: "Compare original and edited image" }),
  ).toBeVisible();
  await page.screenshot({ path: "/tmp/opencode/editor-tool.png", fullPage: true });
});

test("batch processes multiple images and downloads a ZIP", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(HOME);
  await importImages(
    page,
    [
      { name: "landscape.png", buffer: landscape() },
      { name: "portrait.png", buffer: portrait() },
    ],
    2,
  );
  await go(page, "/batch");
  await page.getByLabel("Format", { exact: true }).selectOption("png");
  await page.getByRole("button", { name: "Process all" }).first().click();
  await expect(page.getByText(/2 succeeded/)).toBeVisible({ timeout: 90_000 });
  await page.screenshot({ path: "/tmp/opencode/batch-studio.png", fullPage: true });

  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 60_000 }),
    page.getByRole("button", { name: "Download ZIP" }).first().click(),
  ]);
  const path = await download.path();
  if (!path) throw new Error("ZIP download did not produce a file.");
  const entries = unzipSync(new Uint8Array(readFileSync(path)));
  const names = Object.keys(entries).sort();
  expect(names).toHaveLength(2);
  expect(names[0]).toMatch(/landscape-1200x800\.png/);
  expect(names[1]).toMatch(/portrait-600x900\.png/);
});

test("core flow emits no console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto(HOME);
  await importImages(page, [{ name: "landscape.png", buffer: landscape() }], 1);
  await go(page, "/tools/resize");
  await waitForPreview(page);
  await go(page, "/help");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(errors).toEqual([]);
});

test("rotate exports swapped dimensions", async ({ page }) => {
  await page.goto(HOME);
  await importImages(page, [{ name: "landscape.png", buffer: landscape() }], 1);
  await go(page, "/tools/rotate");
  await waitForPreview(page);
  await page.getByLabel("Format", { exact: true }).selectOption("png");
  const output = await fetchDownload(page, "Render & download");
  expect(pngSize(output.buffer)).toEqual({ width: 800, height: 1200 });
});

test("logo watermark uploads and exports", async ({ page }) => {
  await page.goto(HOME);
  await importImages(page, [{ name: "landscape.png", buffer: landscape() }], 1);
  await go(page, "/tools/watermark");
  await waitForPreview(page);

  await page.getByRole("button", { name: "Logo", exact: true }).click();
  const logo = encodePng(64, 64, (x, y) =>
    (x - 32) ** 2 + (y - 32) ** 2 < 900 ? [255, 255, 255, 230] : [0, 0, 0, 0],
  );
  await page
    .locator(".workbench__inspector input[type=file]")
    .setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: logo });
  await expect(page.getByAltText("Selected watermark")).toBeVisible();

  await page.getByLabel("Format", { exact: true }).selectOption("png");
  const output = await fetchDownload(page, "Render & download");
  expect(pngSize(output.buffer)).toEqual({ width: 1200, height: 800 });
});

async function sampleImage(
  page: Page,
  buffer: Buffer,
  mimeType: string,
  x: number,
  y: number,
): Promise<number[]> {
  return page.evaluate(
    async ({ base64, mimeType: type, x: sampleX, y: sampleY }) => {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
      const bitmap = await createImageBitmap(new Blob([bytes], { type }));
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("No 2D context available.");
      context.drawImage(bitmap, 0, 0);
      const data = context.getImageData(sampleX, sampleY, 1, 1).data;
      bitmap.close();
      return [data[0] ?? 0, data[1] ?? 0, data[2] ?? 0, data[3] ?? 0];
    },
    { base64: buffer.toString("base64"), mimeType, x, y },
  );
}

test("adjust brightness changes exported pixels", async ({ page }) => {
  await page.goto(HOME);
  await importImages(page, [{ name: "landscape.png", buffer: landscape() }], 1);
  await go(page, "/tools/adjust");
  await waitForPreview(page);
  await page
    .getByLabel(/^Brightness/)
    .first()
    .fill("60");
  await page.waitForTimeout(700);
  await page.getByLabel("Format", { exact: true }).selectOption("png");
  const output = await fetchDownload(page, "Render & download");
  const before = await sampleImage(page, landscape(), "image/png", 600, 400);
  const after = await sampleImage(page, output.buffer, "image/png", 600, 400);
  expect(after[0]).toBeGreaterThan((before[0] ?? 0) + 30);
  await page.screenshot({ path: "/tmp/opencode/v2-adjust-e2e.png", fullPage: true });
});

test("grayscale filter equalises exported channels", async ({ page }) => {
  await page.goto(HOME);
  await importImages(page, [{ name: "landscape.png", buffer: landscape() }], 1);
  await go(page, "/tools/filters");
  await waitForPreview(page);
  await page.getByLabel("Filter", { exact: true }).selectOption("grayscale");
  await page.getByLabel("Format", { exact: true }).selectOption("png");
  const output = await fetchDownload(page, "Render & download");
  const sample = await sampleImage(page, output.buffer, "image/png", 600, 400);
  expect(Math.abs((sample[0] ?? 0) - (sample[1] ?? 0))).toBeLessThanOrEqual(2);
  expect(Math.abs((sample[1] ?? 0) - (sample[2] ?? 0))).toBeLessThanOrEqual(2);
});

test("annotate exports the shape fill", async ({ page }) => {
  await page.goto(HOME);
  await importImages(page, [{ name: "landscape.png", buffer: landscape() }], 1);
  await go(page, "/tools/annotate");
  await waitForPreview(page);
  await page.getByLabel("Format", { exact: true }).selectOption("png");
  const output = await fetchDownload(page, "Render & download");
  const sample = await sampleImage(page, output.buffer, "image/png", 220, 160);
  expect(sample[0]).toBeGreaterThan(120);
  expect(sample[1]).toBeLessThan(100);
  expect(sample[2]).toBeLessThan(90);
});

test("colour inspector shows histogram, palette and pixel values", async ({ page }) => {
  await page.goto(HOME);
  await importImages(page, [{ name: "landscape.png", buffer: landscape() }], 1);
  await go(page, "/colour", 1200);
  await expect(page.locator(".histogram-chart")).toBeVisible({ timeout: 30_000 });
  expect(await page.locator(".palette-swatch").count()).toBeGreaterThan(0);
  await expect(page.getByText(/RGB \d+, \d+, \d+/)).toBeVisible();
  await expect(page.getByText("6 colours")).toBeVisible();
  await page.screenshot({ path: "/tmp/opencode/v2-colour-e2e.png", fullPage: true });
});

test("collage renders and exports the chosen layout", async ({ page }) => {
  await page.goto(HOME);
  await importImages(
    page,
    [
      { name: "landscape.png", buffer: landscape() },
      { name: "portrait.png", buffer: portrait() },
    ],
    2,
  );
  await go(page, "/collage", 1600);
  await expect(page.locator('img[alt="Collage preview"]')).toBeVisible({ timeout: 30_000 });
  await page.getByLabel("Format", { exact: true }).selectOption("png");
  const output = await fetchDownload(page, "Render & download collage");
  expect(pngSize(output.buffer)).toEqual({ width: 2400, height: 1200 });
  await page.screenshot({ path: "/tmp/opencode/v2-collage-e2e.png", fullPage: true });
});

test("before/after collage composes the processed image", async ({ page }) => {
  await page.goto(HOME);
  await importImages(page, [{ name: "landscape.png", buffer: landscape() }], 1);
  await go(page, "/tools/adjust");
  await waitForPreview(page);
  await page
    .getByLabel(/^Brightness/)
    .first()
    .fill("50");
  await page.getByLabel("Format", { exact: true }).selectOption("png");
  await page.waitForTimeout(700);
  await go(page, "/collage", 1200);
  await page.getByRole("button", { name: "Before / after" }).click();
  await expect(page.locator('img[alt="Collage preview"]')).toBeVisible({ timeout: 30_000 });
  const output = await fetchDownload(page, "Render & download collage");
  expect(pngSize(output.buffer)).toEqual({ width: 2400, height: 1200 });
  const before = await sampleImage(page, output.buffer, "image/png", 600, 600);
  const after = await sampleImage(page, output.buffer, "image/png", 1800, 600);
  expect(after[0]).toBeGreaterThan((before[0] ?? 0) + 25);
});

test("paste imports an image from the clipboard", async ({ page }) => {
  await page.goto(HOME);
  await page.evaluate((base64) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    const transfer = new DataTransfer();
    transfer.items.add(new File([bytes], "pasted.png", { type: "image/png" }));
    window.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData: transfer,
        bubbles: true,
        cancelable: true,
      }),
    );
  }, landscape().toString("base64"));
  await expect(page.getByText(/1 image/)).toBeVisible({ timeout: 20_000 });
});

test("batch recipes save, apply and import", async ({ page }) => {
  await page.goto(HOME);
  await importImages(page, [{ name: "landscape.png", buffer: landscape() }], 1);
  await go(page, "/batch");
  await page.getByRole("button", { name: "Add operation" }).click();
  await page.getByRole("menuitem", { name: /^Filter/ }).click();
  await page.getByLabel("Recipe name").fill("E2E recipe");
  await page.getByRole("button", { name: "Save current recipe" }).click();
  await expect(page.getByText("Saved recipe “E2E recipe”.")).toBeVisible();

  await go(page, "/presets");
  await expect(page.getByText("E2E recipe", { exact: true })).toBeVisible();
  await expect(page.getByText(/1 operation/)).toBeVisible();
  await page.getByRole("button", { name: "Apply" }).first().click();
  await expect(page).toHaveURL(/#\/batch$/);
  await expect(page.getByText("Filter", { exact: true }).first()).toBeVisible();

  const imported = JSON.stringify({
    schemaVersion: 1,
    name: "Imported recipe",
    operations: [
      { id: "import-1", type: "rotate", enabled: true, params: { angle: 180, background: null } },
    ],
  });
  await go(page, "/presets");
  await page.locator('input[type="file"][accept*="json"]').setInputFiles({
    name: "imported.json",
    mimeType: "application/json",
    buffer: Buffer.from(imported),
  });
  await expect(page.getByText("Imported recipe", { exact: true })).toBeVisible();
});

test("compare reports identical images and exports a diff", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(HOME);
  await importImages(
    page,
    [
      { name: "a.png", buffer: landscape() },
      { name: "b.png", buffer: landscape() },
    ],
    2,
  );
  await go(page, "/compare", 900);
  await expect(page.getByText("Perceptual similarity")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("100%").first()).toBeVisible();
  await page.getByRole("button", { name: "Difference", exact: true }).click();
  await expect(page.getByAltText("Difference map")).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download difference" }).first().click(),
  ]);
  expect(download.suggestedFilename()).toBe("pixelforge-diff.png");
  await page.screenshot({ path: "/tmp/opencode/p3-compare.png", fullPage: true });
});

test("contact sheet and merge modes export", async ({ page }) => {
  await page.goto(HOME);
  await importImages(
    page,
    [
      { name: "one.png", buffer: landscape() },
      { name: "two.png", buffer: portrait() },
      { name: "three.png", buffer: transparent() },
    ],
    3,
  );
  await go(page, "/collage", 1600);
  await page.getByRole("button", { name: "Contact sheet" }).click();
  await expect(page.getByLabel("Width", { exact: true })).toHaveValue("2480");
  await page.waitForTimeout(1000);
  await expect(page.locator('img[alt="Collage preview"]')).toBeVisible();
  await page.getByLabel("Format", { exact: true }).selectOption("png");
  const sheet = await fetchDownload(page, "Render & download collage");
  expect(pngSize(sheet.buffer)).toEqual({ width: 2480, height: 827 });
  await page.screenshot({ path: "/tmp/opencode/p3-contact-sheet.png", fullPage: true });

  await page.getByRole("button", { name: "Merge", exact: true }).click();
  await expect(page.getByLabel("Width", { exact: true })).toHaveValue("2400");
  await page.waitForTimeout(1000);
  const merged = await fetchDownload(page, "Render & download collage");
  expect(pngSize(merged.buffer)).toEqual({ width: 2400, height: 1200 });
});

test("split exports a ZIP of grid tiles", async ({ page }) => {
  await page.goto(HOME);
  await importImages(page, [{ name: "landscape.png", buffer: landscape() }], 1);
  await go(page, "/split", 900);
  await page.getByLabel("Rows", { exact: true }).fill("2");
  await page.getByLabel("Columns", { exact: true }).fill("2");
  await page.getByLabel("Format", { exact: true }).selectOption("png");
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 60_000 }),
    page.getByRole("button", { name: "Split & download ZIP" }).first().click(),
  ]);
  const path = await download.path();
  if (!path) throw new Error("Split ZIP did not produce a file.");
  const entries = unzipSync(new Uint8Array(readFileSync(path)));
  const names = Object.keys(entries);
  expect(names).toHaveLength(4);
  expect(pngSize(Buffer.from(entries[names[0] as string] as Uint8Array))).toEqual({
    width: 600,
    height: 400,
  });
  await page.screenshot({ path: "/tmp/opencode/p3-split.png", fullPage: true });
});

test("metadata inspector reads file structure and discloses export removal", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(HOME);
  await importImages(page, [{ name: "landscape.png", buffer: landscape() }], 1);
  await go(page, "/metadata", 900);
  await expect(page.getByText("Metadata on export")).toBeVisible();
  await expect(page.getByText("landscape.png").first()).toBeVisible();
  await expect(page.getByText("1200 × 800 px")).toBeVisible();
  await expect(page.getByText("Metadata removal applied")).toBeVisible();
  await expect(page.getByText("RGBA")).toBeVisible();
  await page.screenshot({ path: "/tmp/opencode/p3-metadata.png", fullPage: true });
});

test("print calculator converts pixels and DPI", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(HOME);
  await importImages(page, [{ name: "landscape.png", buffer: landscape() }], 1);
  await go(page, "/print", 600);
  await page.getByRole("button", { name: "Load active image" }).click();
  await expect(page.getByText("4.00 in × 2.67 in")).toBeVisible();
  await expect(page.getByText("2400 × 3000 px")).toBeVisible();
  await page.screenshot({ path: "/tmp/opencode/p3-print.png", fullPage: true });
});

test("advanced resampling exports the requested dimensions", async ({ page }) => {
  await page.goto(HOME);
  await importImages(page, [{ name: "landscape.png", buffer: landscape() }], 1);
  await go(page, "/tools/resize");
  await waitForPreview(page);
  await page.getByLabel("Resampling").selectOption("lanczos3");
  await page.getByLabel("Width", { exact: true }).fill("320");
  await page.getByLabel("Format", { exact: true }).selectOption("png");
  const output = await fetchDownload(page, "Render & download");
  expect(pngSize(output.buffer)).toEqual({ width: 320, height: 213 });
});

test("chroma key makes the selected colour transparent", async ({ page }) => {
  const keyed = encodePng(200, 200, (x, y) =>
    x >= 50 && x < 150 && y >= 50 && y < 150 ? [220, 30, 30, 255] : [255, 255, 255, 255],
  );
  await page.goto(HOME);
  await importImages(page, [{ name: "keyed.png", buffer: keyed }], 1);
  await go(page, "/tools/chroma-key");
  await waitForPreview(page);
  await page.getByLabel("Format", { exact: true }).selectOption("png");
  const output = await fetchDownload(page, "Render & download");
  const background = await sampleImage(page, output.buffer, "image/png", 10, 10);
  const subject = await sampleImage(page, output.buffer, "image/png", 100, 100);
  expect(background[3]).toBe(0);
  expect(subject[3]).toBe(255);
  expect(subject[0]).toBeGreaterThan(180);
});

test("perspective warp exports with transparent exposed edges", async ({ page }) => {
  await page.goto(HOME);
  await importImages(page, [{ name: "landscape.png", buffer: landscape() }], 1);
  await go(page, "/tools/warp");
  await waitForPreview(page);
  await page.getByLabel("Perspective numeric value").fill("60");
  await page.waitForTimeout(700);
  await page.getByLabel("Format", { exact: true }).selectOption("png");
  const output = await fetchDownload(page, "Render & download");
  expect(pngSize(output.buffer)).toEqual({ width: 1200, height: 800 });
  const corner = await sampleImage(page, output.buffer, "image/png", 0, 799);
  expect(corner[3]).toBe(0);
  await page.screenshot({ path: "/tmp/opencode/p4-warp.png", fullPage: true });
});

test("mask workspace erases through a generated mask", async ({ page }) => {
  await page.goto(HOME);
  await importImages(page, [{ name: "landscape.png", buffer: landscape() }], 1);
  await go(page, "/mask", 900);
  await expect(page.locator(".mask-overlay")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Centre ellipse" }).click();
  await page.waitForTimeout(900);
  await page.getByLabel("Format", { exact: true }).selectOption("png");
  const output = await fetchDownload(page, "Render & download");
  const centre = await sampleImage(page, output.buffer, "image/png", 600, 400);
  const corner = await sampleImage(page, output.buffer, "image/png", 10, 10);
  expect(centre[3]).toBe(0);
  expect(corner[3]).toBe(255);
  await page.screenshot({ path: "/tmp/opencode/p4-mask.png", fullPage: true });
});

test("mask brush paints and erases the stroke area", async ({ page }) => {
  await page.goto(HOME);
  await importImages(page, [{ name: "landscape.png", buffer: landscape() }], 1);
  await go(page, "/mask", 900);
  const overlay = page.locator(".mask-overlay");
  await expect(overlay).toBeVisible({ timeout: 30_000 });
  await overlay.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  const box = await overlay.boundingBox();
  if (!box) throw new Error("Mask overlay has no bounding box.");
  await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.5, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(900);
  await page.getByLabel("Format", { exact: true }).selectOption("png");
  const output = await fetchDownload(page, "Render & download");
  const centre = await sampleImage(page, output.buffer, "image/png", 600, 400);
  const corner = await sampleImage(page, output.buffer, "image/png", 10, 10);
  expect(centre[3]).toBe(0);
  expect(corner[3]).toBe(255);
});

async function countUniqueColours(page: Page, buffer: Buffer, mimeType: string): Promise<number> {
  return page.evaluate(
    async ({ base64, type }) => {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
      const bitmap = await createImageBitmap(new Blob([bytes], { type }));
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d");
      if (!context) return 0;
      context.drawImage(bitmap, 0, 0);
      const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const colours = new Set<string>();
      for (let offset = 0; offset < data.length; offset += 4) {
        colours.add(`${data[offset]},${data[offset + 1]},${data[offset + 2]}`);
      }
      bitmap.close();
      return colours.size;
    },
    { base64: buffer.toString("base64"), type: mimeType },
  );
}

test("quantize limits the exported palette", async ({ page }) => {
  await page.goto(HOME);
  await importImages(page, [{ name: "landscape.png", buffer: landscape() }], 1);
  await go(page, "/tools/quantize");
  await waitForPreview(page);
  await page.getByLabel("Palette colours numeric value").fill("2");
  await page.waitForTimeout(700);
  await page.getByLabel("Format", { exact: true }).selectOption("png");
  const output = await fetchDownload(page, "Render & download");
  expect(await countUniqueColours(page, output.buffer, "image/png")).toBeLessThanOrEqual(2);
});

test("arbitrary rotation expands the canvas with transparent corners", async ({ page }) => {
  await page.goto(HOME);
  await importImages(page, [{ name: "landscape.png", buffer: landscape() }], 1);
  await go(page, "/tools/rotate");
  await waitForPreview(page);
  await page.getByLabel("Angle", { exact: true }).fill("45");
  await page.waitForTimeout(700);
  await page.getByLabel("Format", { exact: true }).selectOption("png");
  const output = await fetchDownload(page, "Render & download");
  expect(pngSize(output.buffer)).toEqual({ width: 1414, height: 1414 });
  const corner = await sampleImage(page, output.buffer, "image/png", 0, 0);
  expect(corner[3]).toBe(0);
});

test("editor zoom supports fit, 100% and pan", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(HOME);
  await importImages(page, [{ name: "landscape.png", buffer: landscape() }], 1);
  await go(page, "/editor", 900);
  const image = page.locator(".zoom-image");
  await expect(image).toBeVisible({ timeout: 30_000 });
  const fitWidth = await image.evaluate((element) => element.getBoundingClientRect().width);

  await page.getByRole("button", { name: "100%", exact: true }).click();
  await expect(page.locator(".zoom-controls__value")).toHaveText("100%");
  const fullWidth = await image.evaluate((element) => element.getBoundingClientRect().width);
  expect(fullWidth).toBeGreaterThan(fitWidth + 100);

  const viewport = page.locator(".zoom-viewport");
  const box = await viewport.boundingBox();
  if (!box) throw new Error("Zoom viewport has no bounding box.");
  const before = await viewport.evaluate((element) => element.scrollLeft);
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.5, { steps: 8 });
  await page.mouse.up();
  const after = await viewport.evaluate((element) => element.scrollLeft);
  expect(after).toBeGreaterThan(before);

  await page.getByRole("button", { name: "Fit", exact: true }).click();
  const fitAgain = await image.evaluate((element) => element.getBoundingClientRect().width);
  expect(fitAgain).toBeLessThan(fullWidth);
});
