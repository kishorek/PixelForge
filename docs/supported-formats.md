# Supported formats

PixelForge detects capabilities at runtime. A format is offered for export only when a small test
encode produces a non-empty Blob of the expected MIME type.

## Input

| Format | Input | Notes |
| --- | --- | --- |
| JPEG | Yes, where the browser decodes it | No alpha channel |
| PNG | Yes, where the browser decodes it | Alpha supported |
| WebP | Yes, where the browser decodes it | Alpha supported; animated WebP is processed as its first frame |
| AVIF | Yes, where the browser decodes it | Alpha supported; availability varies |
| GIF | Not in V1 | Not part of the V1 import matrix |

File extensions and MIME types are treated as hints. PixelForge always attempts a real decode and
reports a decoding error when the file is corrupt or unsupported.

## Output

| Format | Lossy | Alpha | Target-size search |
| --- | --- | --- | --- |
| JPEG | Yes | No | Yes |
| PNG | No | Yes | Not guaranteed; reported as best-effort |
| WebP | Yes | Yes | Yes |
| AVIF | Yes | Yes | Yes, when the encoder is available |

## Transparency

- PNG, WebP and AVIF exports preserve alpha when the encoder supports it.
- JPEG exports flatten transparent pixels onto the background colour selected in the export panel.
- The default background is white.

## Metadata

Metadata handling depends on the browser's decoder and encoder. PixelForge does not currently expose
a metadata editor, and it does not claim that EXIF, ICC profiles or orientation tags are preserved or
removed. The Help page discloses this limitation.

## Orientation and animation

- Image decoding uses the browser's standard decode path, including its EXIF orientation handling.
- Animated PNG and WebP inputs are detected where possible and rendered as a still image using the
  first frame, with a warning in the UI.
- GIF input is not part of the V1 import matrix.

## Limits

- Maximum decoded area: 120,000,000 pixels.
- Maximum edge length: 20,000 pixels.
- Preview maximum edge: 1,800 pixels.
- These limits protect against memory exhaustion and are enforced before large allocations.
