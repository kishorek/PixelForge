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
6. Render operations in order with WASM resize/transform/adjust/filter operations and canvas composition for overlays.
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
- Tone and colour adjustments for exposure, contrast, saturation, temperature, highlights, shadows, tint, gamma and vibrance.
- Filters: grayscale, sepia, invert, blur, sharpen, emboss, edge, posterize and vignette.
- RGB and luminance histograms.
- Colour conversion helpers and luminance used by the engine tests.

Shape, border, caption, watermark and collage rendering, font handling, image decoding and encoding
stay in the browser, where mature platform APIs already exist.

### Colour analysis

The Colour workspace draws the processed preview into a canvas, computes RGB and luminance
histograms with the WASM engine (falling back to JavaScript if needed), samples pixels under the
pointer or from numeric coordinates, and extracts a quantised dominant palette. Analysis uses the
preview resolution; export remains full resolution.

### Collage and before/after composition

Collage layout math lives in a pure module with unit tests. The composer decodes each source image
sequentially, draws it into a cell with cover or contain fitting, and encodes the result with the
same browser encoders as single-image export. The before/after mode renders the active image's
operation pipeline at full resolution before composing it with the original.

## Recipes and local data

Batch pipelines can be saved as versioned recipes with `createRecipe`, validated on import with
`parseRecipe`, and persisted in local storage under `pixelforge.recipes`. Applying a recipe restores
its ordered operation list and optional export settings. Import rejects unknown operation types,
malformed parameters, oversized payloads and unsupported schema versions.

## Metadata and transparency

The metadata service reads the first 4 MB of PNG, JPEG and WebP files, parses container chunks and
common EXIF tags, and groups results for the inspector. Exports are re-encoded through the browser
canvas, which removes container, EXIF and ICC metadata; the UI states this explicitly. Colour
analysis also reports alpha fractions, alpha range and non-transparent content bounds.

## Editor zoom and arbitrary rotation

Right-angle rotations use the WASM transform path. Arbitrary angles render through a canvas
transform, expanding the canvas to the rotated bounds and optionally filling exposed corners.
The Editor viewport supports fit-to-screen, 100% preview-pixel scale, step zoom and pointer panning.
Zoom operates on the reduced-resolution preview; export remains full resolution.

## Advanced processing

Advanced resampling adds Lanczos 3 and Catmull-Rom kernels through a scratch-buffer ABI. Chroma
keying compares RGB distance to a selected colour and supports tolerance, feathering, inversion
and a replacement background. Masked effects store a normalized PNG mask with the operation; the
worker decodes it, feathers it with the blur filter and applies erase, blur or sharpen only where
the mask is white. Perspective/distortion uses an inverse keystone/radial mapping with bilinear
sampling. Quantization extracts a k-means palette and supports ordered and Floyd–Steinberg
dithering in JavaScript. All advanced effects are conventional image processing and are never
described as semantic or AI-powered.

## Comparison and composition

The Compare workspace cover-fits both images to a common reduced size, computes a WASM channel
difference and perceptual hashes (aHash and dHash), and reports mean/maximum difference and changed
pixels. Contact sheet, merge and collage use the compose worker; split uses a split worker. All
composition paths decode sources sequentially and close bitmaps after drawing. The print calculator
is a pure unit-conversion module with tests.

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
