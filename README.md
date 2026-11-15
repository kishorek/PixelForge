# PixelForge

PixelForge is a local-first image utility and lightweight editing studio that runs entirely in the
browser. Convert, compress, resize, crop, rotate, flip, watermark and batch-process images without an
account or an upload service.

The current build covers the V1 image essentials, the V2 Creative Studio, the V3 Power Tools and
the V4 Advanced Tools.
It is a static React application that decodes and encodes images with browser APIs and runs
deterministic pixel operations in a Zig-compiled WebAssembly engine.

## Features

- Drag-and-drop or file-picker import for JPEG, PNG, WebP and AVIF where the browser can decode them.
- Multi-image session queue with thumbnails, dimensions, format and size.
- Convert between JPEG, PNG, WebP and AVIF when the browser exposes the encoder.
- Compress with a quality slider and best-effort target-size search.
- Resize by pixels or percentage with aspect lock, contain/cover/stretch fit modes and WASM
  resampling.
- Freeform crop with an interactive overlay plus common aspect presets.
- Rotate by any angle with optional corner fill, and flip horizontally or vertically.
- Editor zoom with fit, 100% preview scale and pointer panning.
- Text and logo watermarks with anchor, scale, opacity, margin, tiling and caption plates.
- Tone and colour adjustments: exposure, brightness, contrast, highlights, shadows, gamma, saturation, vibrance, temperature and tint.
- WASM filters: grayscale, sepia, invert, blur, sharpen, emboss, edge, posterize and vignette.
- Shapes, lines, arrows and image borders for annotations and labels.
- Colour workspace with an interactive RGB/luminance histogram, pixel inspector and dominant palette extraction.
- Collage workspace with grid layouts and a before/after composition, exported locally.
- Clipboard paste import alongside drag-and-drop and the file picker.
- Before/after comparison, an ordered operation stack, undo/redo and non-destructive editing.
- Save, import, export and reapply recipes; reorderable batch pipelines with per-file status.
- Batch recipes applied sequentially to a queue, individual downloads and ZIP export.
- Metadata inspector for PNG/JPEG/WebP container chunks, ICC and EXIF, with a clear export-removal policy.
- Transparency analysis, pixel comparison with a perceptual hash and an amplified difference map.
- Contact sheet, horizontal/vertical merge, image split with ZIP output, and a print size/DPI calculator.
- Advanced resampling with Lanczos 3 and Catmull-Rom kernels.
- Chroma key with a colour sampler, tolerance, feathering and transparent or coloured replacement.
- A brush mask that can erase, blur or sharpen selectively with feathering and inversion.
- Approximate perspective and radial distortion correction with transparent or coloured edges.
- Palette quantization with ordered or Floyd–Steinberg dithering.
- Light and dark themes, keyboard-accessible controls and responsive layouts.
- No image data is uploaded. There is no backend.

## Quick start

Requirements:

- Node.js 22+
- npm 10+
- The pinned Zig compiler is downloaded automatically by the build scripts (Zig 0.14.1).

```bash
npm install
npm run zig:install
npm run dev
```

Open `http://localhost:5173/PixelForge/`.

The first dev run also builds the WASM engine. If you change files under `engine/zig`, run
`npm run wasm:build` again.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Build WASM and start the Vite dev server. |
| `npm run build` | Build WASM, validate the ABI and build the static application. |
| `npm run preview` | Preview the production build on port 4173. |
| `npm run wasm:build` | Compile `engine/zig` to `apps/web/src/wasm/pixelforge.wasm`. |
| `npm run wasm:verify` | Instantiate the WASM module and validate exports plus a resize smoke test. |
| `npm run wasm:test` | Run the Zig unit tests. |
| `npm run typecheck` | Typecheck all application and package sources. |
| `npm run lint` / `npm run lint:fix` | Biome checks and formatting. |
| `npm test` | Vitest unit tests for the shared packages. |
| `npm run test:e2e` | Playwright end-to-end tests against the production build. |
| `npm run verify` | Zig tests, typecheck, lint, unit tests, build and end-to-end tests. |

## Repository layout

```
apps/web/                  React + Vite application
packages/
  image-contracts/         Shared types, limits, format metadata and error types
  operation-model/         Operation defaults, validation, resize math, naming, compression search
  browser-image-io/        Decode, encode, capability detection, ZIP and download helpers
  recipe-schema/           Versioned recipe schema with safe parsing
engine/zig/                Zig/WASM pixel engine and Zig unit tests
tests/                     Fixtures, integration tests and Playwright end-to-end tests
docs/                      Architecture, ABI, format support and privacy notes
scripts/                   Zig provisioning and WASM build/verify helpers
```

## Architecture at a glance

1. React manages the session, operation stack and export settings.
2. A worker receives image blobs and operation lists, decodes with `createImageBitmap`, and runs the
   shared pipeline.
3. Crop, resize, rotate and flip use the Zig/WASM engine through a versioned pointer-based ABI.
4. Adjustments, filters and histograms run in the WASM engine; watermarks, shapes, borders and collage compositing use `OffscreenCanvas`.
5. Encoding uses the browser's native codecs; capability detection disables unavailable formats.
6. Colour analysis samples the reduced-resolution preview; export renders full resolution.
7. The main thread never receives full-resolution pixel buffers during single-image processing.

See [docs/architecture.md](docs/architecture.md) and [docs/wasm-abi.md](docs/wasm-abi.md) for details.

## Browser support

PixelForge targets current stable Chrome, Edge, Firefox and Safari. Features are detected at runtime:

- Image decoding uses `createImageBitmap`.
- Encoding support is probed by performing a small test encode for each format.
- `OffscreenCanvas` is preferred in the worker. The app falls back to a main-thread canvas path when
  workers are unavailable.
- The application does not require cross-origin isolation or `SharedArrayBuffer`.

## Privacy

Images, file names, metadata and watermark text stay in the browser tab. The application has no
analytics and no upload path. See [docs/privacy.md](docs/privacy.md).

## Deployment

The production build is a static site under `apps/web/dist`. The Vite base path defaults to
`/PixelForge/` for project GitHub Pages and can be overridden with `VITE_BASE`.

```bash
npm run build
VITE_BASE=/ npm run build   # custom domain or user site at the domain root
```

GitHub Actions workflows are included:

- `.github/workflows/ci.yml` runs Zig tests, typechecking, linting, unit tests, the production build
  and Playwright.
- `.github/workflows/deploy-pages.yml` publishes `apps/web/dist` to GitHub Pages on pushes to `main`.

Set the repository's Pages source to **GitHub Actions** once in repository settings.

## Known limitations

- Images above 120 megapixels or 20,000 pixels on either edge are rejected to protect memory.
- Animated PNG and WebP inputs are processed as a still image using the first frame. GIF is not supported.
- AVIF export is only offered when the runtime encoder probe succeeds.
- Previews are rendered at reduced resolution; exports render at full resolution with the same
  operation parameters.
- Browser codecs can produce slightly different output between browsers.
- Perspective/distortion is an approximate conventional pixel warp, not a lens-profile correction.
- Additional output codecs depend on the browser's actual canvas encoder; unsupported formats are
  detected at runtime and never faked.
- Masks are stored as PNG data URLs with the operation and count toward recipe size limits.
- Editor 100% zoom is preview-pixel scale; exports render at full resolution.
- Colour analysis, comparison and collage previews use reduced-resolution previews; exports render at full resolution.
- Metadata preservation is not available; exports re-encode and remove container, EXIF and ICC metadata.
- Recipes are stored in local storage and are removed when browser site data is cleared.
