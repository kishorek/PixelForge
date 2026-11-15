# WebAssembly ABI (version 1)

The Zig engine is compiled for `wasm32-freestanding` and loaded by
`apps/web/src/wasm/loader.ts`. The ABI is versioned and validated at build time by
`scripts/verify-wasm.mjs`.

## Pixel format

- 8-bit RGBA, channel order R, G, B, A.
- No row padding: stride is `width * 4`.
- Buffers are tightly packed and owned by JavaScript.
- Every operation validates dimensions and buffer lengths before access.
- Alpha is preserved. Callers that flatten transparency (for example JPEG export) do so in a canvas
  after pixel operations.

## Data flow

1. JavaScript calls `pf_alloc(byteLength)` to obtain a pointer into WASM linear memory.
2. JavaScript copies the RGBA bytes into linear memory once.
3. JavaScript calls an operation with input/output pointers, dimensions and parameters.
4. Zig validates arguments, processes the buffer and returns a status code.
5. JavaScript copies the result out and calls `pf_free(pointer, byteLength)`.

Pointers are valid only until the next allocation that grows WASM memory. The loader recreates typed
array views after allocations.

## Exports

```text
pf_abi_version() -> u32
pf_last_error() -> u32

pf_alloc(byte_length: usize) -> pointer | 0
pf_free(pointer: pointer, byte_length: usize) -> void

pf_resize_rgba(
  input, output,
  width, height,
  new_width, new_height,
  method: u32
) -> u32

pf_resize_kernel_rgba(
  input, output, scratch,
  width, height,
  new_width, new_height,
  method: u32
) -> u32

pf_crop_rgba(
  input, output,
  width, height,
  x, y, crop_width, crop_height
) -> u32

pf_flip_rgba(buffer, width, height, horizontal: u32) -> u32
pf_rotate90_rgba(input, output, width, height, clockwise: u32) -> u32

pf_adjust_rgba(
  buffer, width, height,
  brightness, contrast, saturation, temperature, exposure,
  highlights, shadows, tint, gamma, vibrance
) -> u32

pf_filter_rgba(
  buffer, scratch, width, height,
  filter: u32, intensity: f32
) -> u32

pf_histogram_rgba(buffer, width, height, output: *u32) -> u32

pf_chroma_key_rgba(
  buffer, width, height,
  key_r, key_g, key_b,
  tolerance, feather, invert,
  background_r, background_g, background_b, has_background
) -> u32

pf_warp_rgba(
  buffer, scratch, width, height,
  perspective, distortion,
  background_r, background_g, background_b, has_background
) -> u32

pf_diff_rgba(
  a, b, output, width, height, amplify: f32
) -> u32

pf_perceptual_hash_rgba(buffer, width, height, output: *u32) -> u32
```

### Resampling methods

| Value | Method | Use |
| --- | --- | --- |
| 0 | Nearest | Pixel art and hard edges |
| 1 | Bilinear | General smooth resampling |
| 2 | Box | Crisp downscaling by averaging |
| 3 | Lanczos 3 | High-quality resampling with a 6-tap kernel |
| 4 | Catmull-Rom | Sharp bicubic-style resampling |

### Rotation

`pf_rotate90_rgba` swaps the output dimensions: an input of `width × height` produces
`height × width`. The caller must allocate the matching output buffer. A 180° rotation is implemented
as a horizontal flip followed by a vertical flip.

### Adjustments and filters

`pf_adjust_rgba` applies tone and colour adjustments in place. Values are -100 to 100 except `gamma`,
which is 0.2 to 3.

`pf_filter_rgba` applies a filter in place and uses the caller-provided `scratch` buffer for blur and
convolution passes. Codes: 0 grayscale, 1 sepia, 2 invert, 3 blur, 4 sharpen, 5 emboss, 6 edge,
7 posterize, 8 vignette.

`pf_resize_kernel_rgba` is used for Lanczos 3 and Catmull-Rom; `scratch` must hold
`new_width × height × 4` bytes. `pf_chroma_key_rgba` applies the key in place; `pf_warp_rgba` uses a
scratch copy of the source because the mapping is not in-place.

### Histogram

`pf_histogram_rgba` writes 4 × 256 `u32` counts in red, green, blue and luminance order. The output
pointer must be 4-byte aligned; the JavaScript loader allocates extra space and aligns it.

### Difference and perceptual hashing

`pf_diff_rgba` writes amplified absolute channel differences into `output`, with alpha set to 255.
`pf_perceptual_hash_rgba` writes four `u32` words: average-hash low/high and difference-hash
low/high. Hamming distances are calculated in JavaScript.

## Status and error codes

| Code | Meaning |
| --- | --- |
| 0 | Success |
| 1 | Invalid argument or dimension |
| 2 | Buffer exceeds the engine limit |
| 3 | Allocation failed |
| 4 | Unsupported operation or method |
| 5 | Crop region is outside the source |
| 6 | Buffer length does not match dimensions |
| 7 | Internal engine error |

On failure, `pf_last_error()` returns the same code. The JavaScript loader converts non-zero statuses
into `PixelForgeError` with code `WASM_ERROR` and a user-facing message.

## Build and validation

```bash
npm run wasm:build   # compiles and copies the artifact plus a hash manifest
npm run wasm:verify  # instantiates in Node, checks exports and runs a 2x2 -> 1x1 resize
npm run wasm:test    # runs the Zig unit tests
```

The build fails if the artifact is missing. The verifier fails if required exports are absent, the ABI
version is not 1, or the resize, adjustment, filter, histogram or diff smoke tests return a
non-zero status. Chroma key and warp are covered by the Zig unit tests.
