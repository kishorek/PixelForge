# PixelForge

PixelForge is a local-first image utility and lightweight editing studio that runs entirely in the
browser. Convert, compress, resize, crop, rotate, flip, watermark and batch-process images without an
account or an upload service.

The V1 MVP is a static React application that decodes and encodes images with browser APIs and runs
deterministic pixel operations in a Zig-compiled WebAssembly engine.

## Features

- Drag-and-drop or file-picker import for JPEG, PNG, WebP and AVIF where the browser can decode them.
- Multi-image session queue with thumbnails, dimensions, format and size.
- Convert between JPEG, PNG, WebP and AVIF when the browser exposes the encoder.
- Compress with a quality slider and best-effort target-size search.
- Resize by pixels or percentage with aspect lock, contain/cover/stretch fit modes and WASM
  resampling.
- Freeform crop with an interactive overlay plus common aspect presets.
- Rotate by 90°, 180° or 270° and flip horizontally or vertically.
- Text and logo watermarks with anchor, scale, opacity, margin and tiling.
- Before/after comparison, an ordered operation stack, undo/redo and non-destructive editing.
- Batch recipes applied sequentially to a queue, individual downloads and ZIP export.
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
4. Watermarks and final compositing use `OffscreenCanvas`.
5. Encoding uses the browser's native codecs; capability detection disables unavailable formats.
6. The main thread never receives full-resolution pixel buffers during processing.

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
- Animated PNG and WebP inputs are processed as a still image using the first frame. GIF is not a V1 input.
- Metadata preservation or removal varies by browser and export path.
- AVIF export is only offered when the runtime encoder probe succeeds.
- Previews are rendered at reduced resolution; exports render at full resolution with the same
  operation parameters.
- Browser codecs can produce slightly different output between browsers.
