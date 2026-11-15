# Architecture

## Goals

PixelForge separates user interaction, image processing and pixel-level computation so that quick
tools, the editor and Batch Studio share one predictable pipeline. The application is a static site:
there is no server component and no upload path.

## Layers

### Application shell (`apps/web/src/app`)

- Routing with `HashRouter` so static hosting does not need an SPA rewrite.
- Theme provider with semantic design tokens for light and dark modes.
- Runtime capability detection for encoders and canvas support.
- A capability sync that keeps the persisted export format valid.

### Session state (`apps/web/src/state/session.ts`)

A Zustand store holds:

- The imported image queue (`SessionAsset` with original `Blob`, preview URLs and metadata).
- Per-image ordered operation lists.
- Undo/redo history per image.
- A separate batch recipe and the active export settings.
- The watermark image and recent-tool preferences.

Original files are never mutated. Operation lists are serializable and are cloned before being sent
to the worker.

### Shared packages (`packages/*`)

- `image-contracts` defines pixel, operation, export, progress and error types, plus format metadata
  and hard limits.
- `operation-model` owns validation, defaults, resize planning, output dimension simulation, filename
  generation with collision handling, and the bounded compression quality search.
- `browser-image-io` owns browser decoding/encoding, capability probing, thumbnail generation, ZIP
  packaging and download helpers.
- `recipe-schema` provides a versioned, validated recipe format for future recipe persistence and
  import/export.

These packages have no React dependency and are unit tested directly.

### Processing pipeline (`apps/web/src/processing`)

`process.ts` is the single entry point used by previews, single exports and batch items:

1. Validate the operation list.
2. Load the WASM engine.
3. Decode the source with `createImageBitmap`.
4. Compute final output dimensions and, for previews, a scale factor.
5. Scale absolute resize targets for preview rendering so parameters stay consistent.
6. Render operations in order with WASM pixel operations and canvas composition.
7. Flatten transparency for JPEG exports.
8. Encode at the requested quality or run the bounded target-size search.
9. Return a Blob, dimensions, actual quality and whether the target was met.

Preview rendering and full-resolution export use the same operation definitions. Only the source
sampling resolution differs, and the UI labels preview dimensions.

### Worker (`apps/web/src/workers`)

- `image.worker.ts` runs the processing module in a module worker.
- `client.ts` manages job IDs, progress events, worker crash recovery and a main-thread fallback when
  workers are unavailable.
- Batch processing is sequential to bound memory use and keep per-file status accurate.

### Zig/WASM engine (`engine/zig`)

The engine is a freestanding `wasm32` module with a deliberately small pointer-based ABI. It handles:

- RGBA buffer validation and allocation.
- Bilinear, box and nearest resampling.
- Normalized crop, horizontal/vertical flip and right-angle rotation.
- Colour conversion helpers and luminance used by the engine tests.

Watermark rendering, font handling, image decoding and encoding stay in the browser, where mature
platform APIs already exist.

## Preview and export consistency

- Crop rectangles are stored as normalized fractions, so they scale with any preview resolution.
- Watermark sizes and margins are fractions of image dimensions.
- Absolute resize targets are scaled for previews by the same factor as the source.
- Target-size compression is only run for lossy encoders; PNG reports that a target is best-effort
  and may not be met.
- The export panel explicitly separates preview dimensions from the encoded result.

## Error handling

Errors are represented by `PixelForgeError` with a stable code and a user-facing hint. Processing
errors are isolated per job; a failed batch item does not discard successful outputs. Worker crashes
reject pending jobs with a recoverable error and respawn the worker for later jobs.

## Memory and limits

- A decoded image is capped at 120 megapixels and 20,000 pixels per edge.
- Previews are capped at 1800 pixels on the longest edge.
- Batch jobs run sequentially.
- WASM allocations are freed in `finally` blocks, `ImageBitmap`s are closed, and object URLs are
  revoked when replaced or when the session is cleared.
- Full-resolution duplicate buffers are avoided by transferring pixels through one WASM allocation
  pair per operation.

## Storage

Only preferences are persisted locally: theme, export defaults and recent tools. Recipes are defined
and validated by `recipe-schema` but are not persisted in V1. Images live in memory for the session
and are discarded when the tab closes or the session is cleared.
