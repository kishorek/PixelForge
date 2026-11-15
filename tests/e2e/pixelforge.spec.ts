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
