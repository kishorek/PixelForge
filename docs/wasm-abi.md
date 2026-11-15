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

pf_crop_rgba(
  input, output,
  width, height,
  x, y, crop_width, crop_height
) -> u32

pf_flip_rgba(buffer, width, height, horizontal: u32) -> u32
pf_rotate90_rgba(input, output, width, height, clockwise: u32) -> u32
```

### Resampling methods

| Value | Method | Use |
| --- | --- | --- |
| 0 | Nearest | Pixel art and hard edges |
| 1 | Bilinear | General smooth resampling |
| 2 | Box | Crisp downscaling by averaging |

### Rotation

`pf_rotate90_rgba` swaps the output dimensions: an input of `width × height` produces
`height × width`. The caller must allocate the matching output buffer. A 180° rotation is implemented
as a horizontal flip followed by a vertical flip.

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
version is not 1, or the smoke test returns a non-zero status.
