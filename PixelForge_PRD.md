# PixelForge Product Requirements Document

**Document status:** Draft for product and engineering planning  
**Version:** 1.0  
**Product:** PixelForge  
**Product type:** Browser-based image utility and lightweight editing studio  
**Primary deployment target:** Static hosting, initially GitHub Pages  
**Core technology direction:** React + TypeScript + Vite, Zig compiled to WebAssembly, browser image APIs  
**AI approach:** No AI features in the product  

---

## 1. Executive Summary

PixelForge is a browser-based image utility and lightweight editing studio for everyday users. It combines fast, focused tools such as image conversion, compression, resizing and cropping with a shared editing workspace for visual adjustments, annotations, watermarks, collages and batch processing.

The product is designed around three principles:

1. **Useful immediately:** Users can open the site, drop in an image and complete a common task without creating an account or learning a complex editor.
2. **Local-first processing:** Images are processed in the browser wherever practical. The initial product does not require an application server, user account or image upload service.
3. **One consistent editing engine:** Quick tools, the full editor and batch recipes use shared processing operations so results remain predictable and features do not need to be implemented multiple times.

PixelForge will use browser-native capabilities for image decoding, canvas rendering and image encoding where possible. Zig compiled to WebAssembly will provide deterministic, performance-sensitive image processing operations such as pixel transforms, convolution filters, histograms, colour conversions, comparisons and batch transformations.

The product will not include generative AI, cloud-based AI services, accounts, collaborative editing or a server-side image processing pipeline in its initial releases.

## 2. Product Vision

Make high-quality image operations accessible from any modern browser through a single, approachable workspace that works without installation and keeps users' files on their own devices.

### 2.1 Product Positioning

PixelForge sits between one-purpose online image converters and complex desktop image editors. It should be quicker to use than a full professional editor for common tasks while offering more capability and workflow consistency than a collection of disconnected utilities.

### 2.2 Product Promise

- Open the site and start working immediately.
- Process images locally wherever browser capabilities permit.
- Move from a quick operation to a richer editor without re-importing the image.
- Apply the same set of operations to multiple images through batch processing.
- Export predictable results with clear control over dimensions, format and quality.

## 3. Goals and Non-Goals

### 3.1 Goals

- Provide a broad set of practical image utilities for general users.
- Support both single-purpose quick tools and a full editing workspace.
- Support multiple image import, editing, preview and export workflows.
- Provide reliable image conversion, resizing, cropping and compression.
- Provide common visual adjustments, filters, text overlays, watermarks and borders.
- Provide repeatable batch processing through saved recipes.
- Keep original files unchanged and make editing non-destructive until export.
- Keep processing local by default and communicate clearly when an operation uses browser memory or has format limitations.
- Use Zig/WASM for suitable computational operations without forcing all image functionality into WebAssembly.
- Deploy the first version as a static website.

### 3.2 Non-Goals

The initial product is not intended to:

- Replace Photoshop, Affinity Photo, GIMP or other professional raster editors.
- Provide generative image creation, AI enhancement, AI background removal or AI object removal.
- Provide semantic subject selection or automatic portrait segmentation.
- Host or store users' image libraries on a server.
- Provide multi-user collaboration, shared cloud projects or account-based synchronization.
- Edit video or provide a full animation timeline.
- Guarantee support for every proprietary or camera RAW format.
- Guarantee identical output across every browser and operating system when browser codecs differ.

## 4. Target Audience

The primary audience is the general public. The product should serve users with different levels of image-editing experience.

### 4.1 User Segments

| Segment | Typical need | Important capabilities |
|---|---|---|
| Everyday users | Resize, crop, compress or convert a photo | Simple forms, presets, clear export |
| Social media users | Prepare images for posts, stories and thumbnails | Aspect-ratio presets, text, watermark, batch export |
| Small businesses | Apply logos, standard dimensions and repeatable output settings | Watermarks, recipes, batch processing |
| Photographers and hobbyists | Adjust tone, colour, sharpness and composition | Non-destructive adjustments, comparison, histogram |
| Designers and developers | Inspect dimensions, colour values, metadata and file properties | Pixel inspector, format details, colour tools |
| Students and educators | Create collages, annotated images and visual examples | Layouts, labels, shapes and export presets |

### 4.2 Accessibility and Skill Level

The interface must work for first-time users while retaining precise controls for experienced users. Simple controls should be the default. Advanced controls can be grouped under expandable sections or an Advanced mode.

## 5. Product Principles

1. **Local-first privacy:** Do not upload images to a PixelForge server in the standard workflow.
2. **Non-destructive editing:** Keep the original source and represent edits as an ordered operation list.
3. **Progressive complexity:** Expose the most common controls first and reveal advanced settings when needed.
4. **Predictable exports:** Show the expected file type, dimensions and estimated size before export where feasible.
5. **Capability-aware formats:** Detect browser support instead of assuming every decoder or encoder is available.
6. **Graceful degradation:** Provide a useful fallback when a browser API or WebAssembly feature is unavailable.
7. **Accessible interaction:** Support keyboard navigation, visible focus, understandable labels and sufficient contrast.
8. **Performance without blocking:** Long-running operations must not freeze the main interface.

## 6. Scope and Release Strategy

The product is divided into four releases. The first release prioritizes essential, high-frequency jobs and a reliable processing foundation.

### 6.1 Release Overview

| Release | Theme | Main capabilities |
|---|---|---|
| V1 | Image Essentials | Import, convert, resize, crop, rotate, compress, watermark, batch export |
| V2 | Creative Studio | Adjustments, filters, annotations, borders, collage and colour tools |
| V3 | Power Tools | Batch recipes, metadata, image comparison, contact sheets and print preparation |
| V4 | Advanced Local Tools | Manual background tools, restoration-style conventional filters and specialist utilities |

### 6.2 MVP Definition

The MVP is V1. It must allow a user to import one or more images, perform the essential operations, preview the result, export individual files or a ZIP archive and do so without sending the image to a backend.

**MVP must-have features:**

- Drag-and-drop and file-picker import.
- Multiple image queue with thumbnail previews.
- JPEG, PNG and WebP input where supported by the browser.
- JPEG, PNG and WebP output where supported by the browser.
- Format conversion.
- Resize by width, height or percentage.
- Aspect-ratio lock and common crop presets.
- Crop, rotate and flip.
- JPEG/WebP quality setting when the selected encoder supports it.
- Target file-size guidance, with best-effort iterative compression for lossy formats.
- Text and image watermark overlays with position, scale and opacity controls.
- Before/after preview.
- Individual download and batch ZIP download.
- Processing progress, cancellation where practical and clear error messages.
- Browser-local processing and no account requirement.

**MVP exclusions:**

- AI features of any kind.
- Semantic background removal.
- Object removal or generative inpainting.
- Full layer-based professional editing.
- Cloud saving or sharing.
- Animated GIF or video editing.
- RAW camera development.

## 7. Information Architecture and Navigation

The application has two primary entry points: **Quick Tools** and **Editor**. A third entry point, **Batch Studio**, is available for multi-image work.

### 7.1 Primary Navigation

1. **Home:** Drop zone, recent in-session files, popular tools and quick-start actions.
2. **Quick Tools:** Focused single-purpose pages for conversion, compression, resize, crop and related jobs.
3. **Editor:** Shared workspace for composing multiple image operations.
4. **Batch Studio:** Apply a common configuration or saved recipe to multiple images.
5. **Presets:** Browse built-in export presets and user-created recipes.
6. **Help:** Supported formats, privacy explanation, keyboard shortcuts and troubleshooting.

### 7.2 Navigation Model

- The top bar contains the PixelForge brand, main navigation, theme control and help access.
- Quick Tools opens a searchable tool directory grouped by category.
- The Editor keeps the selected image and its operation history in the shared workspace.
- Batch Studio provides an input queue, recipe configuration, output preview and download area.
- Navigation between Quick Tools and Editor must preserve the current in-session image and applicable settings.

### 7.3 Tool Categories

| Category | Included tools |
|---|---|
| Essentials | Convert, compress, resize, crop, rotate and flip |
| Edit | Brightness, contrast, exposure, colour, sharpness and filters |
| Background and canvas | Canvas size, padding, solid background, gradient background and manual mask tools in later releases |
| Overlay | Text, logo, watermark, shapes, arrows, labels and borders |
| Compose | Collage, image merge, image split, contact sheet and before/after layout |
| Colour | Colour picker, palette extraction, histogram, colour replacement and quantization |
| Inspect | Image information, metadata, pixel inspector and transparency view |
| Social and print | Social media presets, print dimensions and DPI calculator |
| Advanced | Image diff, perceptual hash, SVG rasterization and data URI utilities |

## 8. Core User Journeys

### 8.1 Quick Compression

1. User opens PixelForge and chooses Compress.
2. User drops an image or selects it from the device.
3. PixelForge displays the original dimensions, format and file size.
4. User chooses output format and quality or enters a target size.
5. PixelForge generates a preview and estimated output size.
6. User downloads the processed image.
7. The original remains unchanged in the current session.

**Acceptance criteria:** The exported image opens successfully, uses the selected supported format, and reports the resulting dimensions and file size accurately.

### 8.2 Resize and Crop

1. User imports an image.
2. User selects Resize or Crop.
3. User selects a preset or enters custom dimensions.
4. Aspect-ratio lock is enabled by default when proportional resizing is selected.
5. User adjusts crop framing and confirms the operation.
6. PixelForge previews the result and allows undo or reset.
7. User exports the result.

**Acceptance criteria:** Output dimensions match the selected dimensions, subject to the selected crop and fit mode. The UI must clearly distinguish cropping from resizing and canvas expansion.

### 8.3 Watermark Several Images

1. User opens Batch Studio and imports multiple images.
2. User selects a text or image watermark.
3. User configures placement, scale, margins and opacity.
4. User previews the watermark on representative images.
5. User starts processing.
6. PixelForge produces a result for each valid input and reports failures individually.
7. User downloads all successful results as a ZIP archive.

**Acceptance criteria:** Each output uses the same configured watermark rules, while placement is calculated relative to each image's dimensions. One failed image must not discard successful outputs.

### 8.4 Continue in the Full Editor

1. User completes a quick operation.
2. User chooses Open in Editor.
3. PixelForge carries the source image and operation state into the Editor.
4. User adds further adjustments or overlays.
5. User exports the final image.

**Acceptance criteria:** The transition does not require re-importing the image and does not silently flatten or discard supported edit operations.

### 8.5 Save and Reuse a Recipe

1. User configures a sequence of operations.
2. User chooses Save Recipe.
3. PixelForge stores the recipe locally in the browser.
4. User opens Batch Studio and selects the saved recipe.
5. User imports a new image set and applies the recipe.
6. User reviews the results and downloads them.

This journey is targeted at V3. V1 may expose batch configurations without persistent recipe management.

## 9. Functional Requirements

Priorities use the following definitions: **P0** is required for MVP; **P1** is important for the next release; **P2** is a later enhancement.

### 9.1 Import and File Management

| ID | Requirement | Priority |
|---|---|---|
| IMP-001 | The application shall support drag-and-drop image import. | P0 |
| IMP-002 | The application shall provide a standard file picker. | P0 |
| IMP-003 | The application shall support importing multiple images in one action. | P0 |
| IMP-004 | The application shall display file name, dimensions, type and file size when available. | P0 |
| IMP-005 | The application shall generate thumbnails without modifying the source file. | P0 |
| IMP-006 | The application shall allow individual files to be removed from the session queue. | P0 |
| IMP-007 | The application shall validate file type, decode success and image dimensions before processing. | P0 |
| IMP-008 | The application should support paste-from-clipboard for compatible image data. | P1 |
| IMP-009 | The application should support opening a local image through the browser share or file-open flow where practical. | P2 |
| IMP-010 | The application shall explain when an imported format is unsupported or only partially supported. | P0 |

### 9.2 Conversion and Export

| ID | Requirement | Priority |
|---|---|---|
| CON-001 | The application shall convert between supported JPEG, PNG and WebP formats. | P0 |
| CON-002 | The application shall detect actual encoder support at runtime. | P0 |
| CON-003 | The application shall expose quality controls for lossy formats where supported. | P0 |
| CON-004 | The application shall expose transparency handling when converting to a format without alpha support. | P0 |
| CON-005 | The application shall allow users to choose a background colour when flattening transparency. | P0 |
| CON-006 | The application should support AVIF export when the browser provides a working encoder. | P1 |
| CON-007 | The application should support additional input formats only when the browser can decode them reliably. | P1 |
| CON-008 | The application shall show final dimensions, format and file size after export. | P0 |
| CON-009 | The application shall support descriptive output file names and collision-safe batch naming. | P0 |
| CON-010 | The application shall offer a ZIP download for multiple outputs. | P0 |
| CON-011 | The application shall warn users that metadata preservation or removal may vary by browser and export path. | P1 |
| CON-012 | The application shall not claim a target file size is guaranteed when compression is best-effort. | P0 |

### 9.3 Resize, Crop and Transform

| ID | Requirement | Priority |
|---|---|---|
| RST-001 | The application shall resize by pixel dimensions and percentage. | P0 |
| RST-002 | The application shall provide proportional and independent width/height controls. | P0 |
| RST-003 | The application shall provide common aspect-ratio presets. | P0 |
| RST-004 | The application shall support freeform crop selection. | P0 |
| RST-005 | The application shall support rotate by 90, 180 and 270 degrees. | P0 |
| RST-006 | The application shall support horizontal and vertical flip. | P0 |
| RST-007 | The application shall distinguish crop, resize-to-fit, resize-to-fill and canvas expansion. | P0 |
| RST-008 | The application should support arbitrary-angle rotation with configurable background fill. | P1 |
| RST-009 | The application should provide presets for common social and print dimensions. | P1 |
| RST-010 | The application shall prevent invalid zero, negative or unreasonable dimensions. | P0 |

### 9.4 Compression

| ID | Requirement | Priority |
|---|---|---|
| CMP-001 | The application shall expose quality and output format controls for supported lossy encoders. | P0 |
| CMP-002 | The application shall display original and output file sizes. | P0 |
| CMP-003 | The application shall display the percentage and absolute size reduction. | P0 |
| CMP-004 | The application should support best-effort target-size compression. | P0 |
| CMP-005 | The application shall preserve the original until the user downloads or explicitly replaces the working result. | P0 |
| CMP-006 | The application shall communicate when a lossless format cannot meet a requested target size without changing format or image dimensions. | P1 |

### 9.5 Watermarks and Overlays

| ID | Requirement | Priority |
|---|---|---|
| OVR-001 | The application shall support text watermark overlays. | P0 |
| OVR-002 | The application shall support image and logo watermark overlays. | P0 |
| OVR-003 | The application shall support watermark position, scale, opacity and margin settings. | P0 |
| OVR-004 | The application shall support previewing overlays before export. | P0 |
| OVR-005 | The application should support repeated tiled watermarks. | P1 |
| OVR-006 | The application should support multiple text and image overlay elements in the Editor. | P1 |
| OVR-007 | The application should support borders, labels, arrows and basic shapes. | P1 |

### 9.6 Editor and Adjustments

| ID | Requirement | Priority |
|---|---|---|
| EDT-001 | The Editor shall maintain an ordered, non-destructive operation list. | P1 |
| EDT-002 | The Editor shall support undo and redo. | P1 |
| EDT-003 | The Editor shall support brightness, contrast, saturation and temperature adjustments. | P1 |
| EDT-004 | The Editor should support exposure, highlights, shadows, tint, gamma and vibrance. | P1 |
| EDT-005 | The Editor should support grayscale, sepia, blur, vignette and selected creative filters. | P1 |
| EDT-006 | The Editor should support sharpness and convolution-based effects. | P1 |
| EDT-007 | The Editor shall provide a before/after comparison. | P1 |
| EDT-008 | The Editor shall provide zoom, pan, fit-to-screen and 100% view. | P1 |
| EDT-009 | The Editor shall provide reset for an individual adjustment and reset-all options. | P1 |
| EDT-010 | The Editor shall clearly distinguish preview rendering from full-resolution export. | P1 |

### 9.7 Batch Processing and Recipes

| ID | Requirement | Priority |
|---|---|---|
| BAT-001 | The application shall support a queue of multiple source images. | P0 |
| BAT-002 | The application shall apply common V1 operations to all valid queue items. | P0 |
| BAT-003 | The application shall show per-file progress and status. | P0 |
| BAT-004 | The application shall allow a file to fail without cancelling the entire batch. | P0 |
| BAT-005 | The application shall allow successful outputs to be downloaded individually or as a ZIP. | P0 |
| BAT-006 | The application should support saved processing recipes. | P1 |
| BAT-007 | Recipes should be exportable and importable as JSON. | P1 |
| BAT-008 | The application should support per-file naming templates. | P1 |
| BAT-009 | The application should allow users to reorder operations in a recipe. | P1 |

### 9.8 Metadata, Inspection and Colour Utilities

| ID | Requirement | Priority |
|---|---|---|
| INS-001 | The application should display available image metadata. | P1 |
| INS-002 | The application should provide an explicit metadata-removal option where the export path allows it. | P1 |
| INS-003 | The application should provide RGB, HEX and HSL pixel inspection. | P1 |
| INS-004 | The application should display RGB and luminance histograms. | P1 |
| INS-005 | The application should extract a dominant-colour palette. | P1 |
| INS-006 | The application should display alpha-channel and transparency information. | P1 |
| INS-007 | The application may provide image hashing and duplicate comparison. | P2 |
| INS-008 | The application may provide pixel-level and perceptual image comparison. | P2 |

### 9.9 Composition and Social Media Tools

| ID | Requirement | Priority |
|---|---|---|
| COM-001 | The application should provide common social media dimension presets. | P1 |
| COM-002 | The application should provide basic multi-image collage layouts. | P1 |
| COM-003 | The application should provide side-by-side and slider-based before/after layouts. | P1 |
| COM-004 | The application should provide image merge and image splitting tools. | P2 |
| COM-005 | The application may provide contact sheet generation. | P2 |
| COM-006 | The application may provide print dimension and DPI calculations. | P2 |

## 10. UX and UI Specification

### 10.1 Overall Layout

The desktop application uses four principal areas:

- **Top bar:** Brand, primary navigation, project status, theme and help.
- **Left sidebar:** Tool categories, operation list, layers or batch queue depending on the active workspace.
- **Central canvas:** Main image preview and direct manipulation surface.
- **Right inspector:** Context-sensitive properties and controls for the selected operation or element.
- **Bottom filmstrip:** Source images, batch items or output variants when relevant.

On smaller screens, sidebars become drawers or collapsible panels. The canvas remains the primary focus.

### 10.2 Home Screen

The home screen should include:

- A prominent drag-and-drop upload area.
- Buttons for Open Editor, Convert, Compress, Resize and Batch Process.
- A searchable tool directory.
- A short privacy statement explaining local processing.
- Recently used tools stored locally, without requiring an account.

### 10.3 Quick Tool Screen

Each quick tool should follow a consistent pattern:

1. Tool title and one-sentence explanation.
2. Import or current image selection.
3. Main controls with sensible defaults.
4. Preview area.
5. Output summary.
6. Download action.
7. Optional Open in Editor action.

A quick tool should not expose every advanced Editor feature. It should focus on completing one task with minimal interaction.

### 10.4 Editor Screen

The Editor should include:

- Canvas with fit, zoom and pan controls.
- Selectable operation stack.
- Contextual controls in the right inspector.
- Undo and redo.
- Before/after comparison.
- Export panel.
- A visible indication when the preview is lower resolution than the source.

### 10.5 Batch Studio Screen

The Batch Studio should include:

- File queue with thumbnail, source name, source size and status.
- Recipe or operation configuration panel.
- A sample preview selection.
- Start, pause where technically safe, cancel and retry controls.
- Per-file progress and error detail.
- Output file naming and ZIP download settings.

### 10.6 Interaction and Feedback

- All long operations must display progress or an indeterminate busy state.
- Controls must provide immediate preview feedback where possible.
- Sliders should support keyboard adjustment and optional numeric entry.
- Destructive actions must have clear labels and undo or confirmation where appropriate.
- The interface must explain when an operation cannot be completed because of file format, memory or browser limitations.
- Error messages should describe the next useful action rather than expose raw stack traces.

### 10.7 Accessibility

- Target WCAG 2.2 AA for primary workflows.
- All interactive controls must be keyboard accessible.
- Use semantic headings, buttons, labels and status announcements.
- Provide visible keyboard focus.
- Do not communicate status through colour alone.
- Provide text alternatives for icons and meaningful visual controls.
- Support reduced motion preferences.
- Maintain usable contrast in light and dark themes.

## 11. Technical Architecture

### 11.1 Architecture Overview

PixelForge is a static web application with browser-local processing. The React application manages user interaction and application state. Browser APIs decode and encode images and provide canvas rendering. Zig/WASM performs computational image operations. Web Workers isolate CPU-intensive processing from the UI thread.

```text
Browser
│
├── React + TypeScript UI
│   ├── Home and tool directory
│   ├── Quick tools
│   ├── Editor workspace
│   ├── Batch Studio
│   └── Export experience
│
├── Application services
│   ├── Project and session state
│   ├── Operation graph / recipe manager
│   ├── Format capability detection
│   ├── File queue and naming
│   └── Export and ZIP service
│
├── Web Workers
│   ├── Image decode / transform orchestration
│   ├── Zig WASM worker
│   └── Batch job scheduler
│
├── Browser media APIs
│   ├── File / Blob
│   ├── createImageBitmap
│   ├── Canvas / OffscreenCanvas
│   ├── ImageData
│   └── Blob encoding
│
├── Zig WebAssembly engine
│   ├── Pixel operations
│   ├── Colour conversion
│   ├── Convolution and filters
│   ├── Histograms and statistics
│   ├── Image comparison
│   └── Batch pixel transforms
│
└── Browser storage
    ├── IndexedDB: recipes and preferences
    └── Session memory: active image data and edit state
```

### 11.2 Frontend Technology

- **React:** Component-based user interface.
- **TypeScript:** Type-safe application and worker interfaces.
- **Vite:** Development server and production bundling.
- **Canvas API:** Preview composition and rendering.
- **OffscreenCanvas:** Preferred in workers when available, with a main-thread canvas fallback.
- **Web Workers:** Keep intensive processing away from the UI thread.
- **IndexedDB:** Store user preferences, recipes and small project metadata locally.
- **ZIP library:** Package multiple output blobs into a downloadable archive.

The frontend should be modular and avoid tight coupling between UI components and the Zig ABI.

### 11.3 Zig and WebAssembly Responsibilities

Zig should be used for deterministic computational work where it offers a meaningful benefit. It should not be used simply because the product is built with WebAssembly.

**Recommended Zig modules:**

| Module | Responsibility | Release |
|---|---|---|
| `core/pixel.zig` | Pixel buffer operations and channel access | V1 |
| `core/color.zig` | RGB, HSL, HSV, luminance and colour transforms | V1 |
| `core/resize.zig` | Resampling kernels and pixel-level resize operations | V1 |
| `core/transform.zig` | Flip, rotate and geometric buffer transforms | V1 |
| `core/histogram.zig` | Channel and luminance histograms | V2 |
| `filters/convolution.zig` | Blur, sharpen, edge and emboss kernels | V2 |
| `filters/adjustments.zig` | Brightness, contrast, saturation and tone operations | V2 |
| `analysis/diff.zig` | Pixel difference and comparison metrics | V3 |
| `analysis/hash.zig` | Image hashing and perceptual comparison primitives | V3 |
| `batch/operations.zig` | Reusable ordered processing operations | V1/V3 |
| `wasm/exports.zig` | Stable exports exposed to JavaScript | V1 |

### 11.4 Responsibilities That Should Remain in JavaScript or Browser APIs

- File selection, drag-and-drop and browser permission handling.
- Browser image decoding and format capability checks.
- DOM, accessible controls and canvas display.
- Font loading and text rendering unless a future requirement proves otherwise.
- Image encoding where browser-native encoders provide sufficient output.
- Download initiation and ZIP packaging.
- IndexedDB access and application routing.
- Worker lifecycle and job scheduling.

This division avoids duplicating mature browser functionality and keeps the WASM interface focused.

### 11.5 WebAssembly Target and Build Strategy

Use a browser-compatible freestanding WebAssembly target for the image engine rather than assuming a WASI runtime is available in the browser. The exact Zig version, target flags and exported symbol configuration must be pinned and validated in the repository's build workflow.

The build should produce a small, versioned WASM artifact and a JavaScript loader. The build pipeline must fail when the WASM artifact is missing, exports do not match the declared interface or smoke tests fail.

### 11.6 JavaScript-to-Zig Interface

The WASM boundary should use a deliberately small and versioned ABI. Avoid sending large image buffers as JSON or copying every pixel through individual function calls.

Recommended initial approach:

1. JavaScript decodes the source image into an `ImageData` or compatible pixel buffer.
2. The worker obtains a pointer from Zig's exported allocation function.
3. JavaScript copies the pixel buffer into WASM linear memory in one operation.
4. JavaScript calls an exported operation with pointers, dimensions, stride and operation parameters.
5. Zig processes the buffer.
6. JavaScript copies the result into a new browser buffer for preview or encoding.
7. JavaScript calls the matching free function when the memory is no longer required.

The ABI should expose a version function, allocation and free functions, operation functions and a structured error code. The interface should define ownership, alignment, buffer length, pixel format, row stride and error semantics.

A possible conceptual interface is:

```text
pf_abi_version() -> u32
pf_alloc(byte_length: usize) -> pointer
pf_free(pointer: pointer, byte_length: usize)
pf_resize_rgba(input_ptr, output_ptr, width, height, new_width, new_height, method) -> status
pf_adjust_rgba(buffer_ptr, width, height, operation_params_ptr) -> status
pf_histogram_rgba(buffer_ptr, width, height, output_ptr) -> status
pf_last_error() -> error_code
```

The final signatures must be adapted to the pinned Zig toolchain and WebAssembly ABI. They are an interface design example, not a claim that these exact functions already exist.

### 11.7 Pixel Buffer Contract

The initial internal processing format should be 8-bit RGBA with an explicit row stride. Requirements:

- Channel order must be documented and tested.
- The application must not assume all source images contain transparency.
- Alpha handling must be defined for every operation.
- Operations must document whether they preserve, premultiply or flatten alpha.
- All dimensions and buffer lengths must be validated before memory access.
- Allocation sizes must be checked for integer overflow and configured limits.
- Any WASM trap or worker failure must result in a recoverable user-facing error.

Higher bit-depth and alternate colour space support can be considered after the initial release.

## 12. Image Processing Pipeline

### 12.1 Standard Processing Flow

```text
User imports file
      │
      ▼
Validate file and inspect metadata
      │
      ▼
Decode with browser image API
      │
      ▼
Create source representation
      │
      ├── Keep original Blob unchanged
      │
      ▼
Create preview representation
      │
      ▼
Apply ordered edit operations
      │
      ├── Browser canvas operations
      ├── Zig/WASM pixel operations
      └── Overlay / composition operations
      │
      ▼
Render preview
      │
      ▼
User confirms export settings
      │
      ▼
Render full-resolution output
      │
      ▼
Encode using supported browser encoder
      │
      ▼
Validate output and create Blob
      │
      ├── Download one file
      └── Package multiple files as ZIP
```

### 12.2 Import and Decode

- Accept files through the File API and drag-and-drop.
- Validate extension and MIME type as hints, not as the sole source of truth.
- Attempt actual decoding and handle decode failures.
- Read available dimensions before allocating large working buffers where possible.
- Detect animated formats and clearly state whether only the first frame is being processed.
- Preserve the original Blob for reprocessing and export decisions.

### 12.3 Preview Rendering

- Generate a preview resolution suitable for the displayed canvas.
- Use the same operation definitions as full-resolution export.
- Do not silently apply different parameters to preview and export.
- Display a preview-quality indicator when downsampling is used.
- Debounce rapid slider changes and cancel stale preview jobs where practical.

### 12.4 Operation Graph

Edits should be represented as a serializable, ordered list of operations rather than immediately mutating the only copy of the image.

Example conceptual document:

```json
{
  "schemaVersion": 1,
  "source": {
    "name": "photo.jpg",
    "width": 4000,
    "height": 3000,
    "mimeType": "image/jpeg"
  },
  "operations": [
    {
      "id": "op-1",
      "type": "resize",
      "params": {
        "width": 1600,
        "height": 1200,
        "fit": "contain",
        "resampling": "lanczos3"
      },
      "enabled": true
    },
    {
      "id": "op-2",
      "type": "watermark-text",
      "params": {
        "text": "Sample watermark",
        "anchor": "bottom-right",
        "opacity": 0.35,
        "scale": 0.08
      },
      "enabled": true
    }
  ]
}
```

The example is illustrative. The production schema must define parameter ranges, units, defaults and migration rules.

### 12.5 Operation Ordering

Operation order can affect the result. The UI must preserve and display the order. The application may offer recommended ordering for common workflows, but must not silently reorder user operations.

For batch recipes, each operation must be deterministic for the same input, parameters and implementation version, except where browser codec output naturally differs.

### 12.6 Encoding and Export

- Detect supported output MIME types before presenting them as available.
- Use browser-native encoders when suitable.
- Handle transparent pixels explicitly when exporting to JPEG.
- Verify the returned Blob type and non-zero size.
- Use object URLs for downloads and revoke them when no longer needed.
- Provide individual downloads and ZIP packaging for multiple files.
- Do not claim exact output size until encoding is complete.

### 12.7 Compression Strategy

For target-size compression:

1. Start with the user's requested format and dimensions.
2. Encode at the requested quality.
3. Compare actual size to the target.
4. Adjust quality through a bounded search for lossy encoders.
5. Stop when the target is met, a minimum quality threshold is reached or the iteration limit is reached.
6. Report the best achieved result and whether the target was met.

If the selected format is lossless or cannot meet the target, suggest an alternative format or dimension change without silently changing the user's settings.

## 13. Browser Processing and Performance

### 13.1 Worker Strategy

CPU-intensive operations should run in Web Workers. The main thread should be reserved for interaction, rendering and accessibility. Prefer transferable buffers when ownership can be moved safely. Avoid unnecessary copies of full-resolution pixel data.

The initial release should not require `SharedArrayBuffer` or cross-origin isolation. This reduces hosting and deployment complexity. Multi-threaded WASM can be evaluated later as an optional enhancement.

### 13.2 Performance Targets

These are initial engineering targets and must be validated on representative devices.

| Scenario | Target |
|---|---|
| Initial application shell | Interactive within 3 seconds on a typical broadband desktop |
| WASM module load | Ideally under 1 MB compressed for the initial core module |
| Common preview adjustment | Visible response within 150 ms for a typical 12 MP image using preview resolution |
| Simple operation on a 12 MP image | Target under 2 seconds on a recent desktop for supported operations |
| UI responsiveness | Main interface remains usable during worker processing |
| Batch status | Per-file progress and completion state are visible |

Do not treat these targets as guarantees across all devices or image sizes. Measure on low-memory mobile devices as well as desktop browsers.

### 13.3 Memory Management

- Set configurable limits for source dimensions, decoded pixel count and concurrent processing jobs.
- Avoid decoding every batch item simultaneously.
- Process large batches sequentially or with a small concurrency limit.
- Release ImageBitmap, object URLs, WASM allocations and large typed arrays when no longer required.
- Provide a clear recovery path when memory allocation or decoding fails.
- Do not retain full-resolution duplicate buffers without a documented need.

### 13.4 Compatibility

The product should support current stable versions of Chrome, Edge, Firefox and Safari, subject to their support for required browser APIs. Feature detection must determine actual functionality at runtime.

- If OffscreenCanvas is unavailable, use a worker-compatible fallback or main-thread canvas for limited operations.
- If a particular format encoder is unavailable, hide or disable that output option with an explanation.
- If a browser cannot process a selected image size safely, explain the limitation and suggest a smaller image or another browser.

## 14. Data, State and Persistence

### 14.1 Data Storage

- Original image bytes remain in memory for the active session unless the user explicitly downloads or chooses another local action.
- User preferences and small recipes may be stored in IndexedDB or local storage.
- Full image files should not be persisted by default.
- The product should explain that browser storage may be cleared by the user or browser.
- No account or cloud synchronization is required in the initial product.

### 14.2 Core Data Entities

| Entity | Purpose | Key fields |
|---|---|---|
| ImageAsset | Imported source or generated output | id, name, type, size, width, height, source reference |
| EditDocument | Current editing session | id, sourceAssetId, operationIds, schemaVersion |
| Operation | One image transformation | id, type, params, enabled, order |
| BatchJob | A collection of work | id, inputAssetIds, recipeId, status, resultIds |
| Recipe | Reusable operation sequence | id, name, schemaVersion, operations |
| ExportSettings | Output configuration | format, quality, dimensions, file naming |
| UserPreferences | Local application preferences | theme, defaults, last-used-tool |

### 14.3 Recipe Versioning

Recipes must include a schema version. On import, PixelForge must validate the schema and reject unknown or unsafe operation types. Future versions may provide migration functions for supported older recipes.

## 15. Security and Privacy

### 15.1 Privacy Requirements

- Image files must not be transmitted to a PixelForge-controlled server in the normal processing path.
- No analytics event may include image bytes, file names, EXIF values or user-entered overlay text.
- The privacy statement must explain the local-first processing model and its limitations.
- If third-party assets or libraries are loaded, disclose their role and avoid sending user image data to them.
- No hidden remote processing or background upload is permitted.

### 15.2 File Safety

- Treat imported files as untrusted input.
- Validate decoded dimensions and allocation sizes.
- Do not inject SVG or metadata text into the DOM as executable markup.
- If SVG input is supported, sanitize it or render it through a constrained safe path before display.
- Do not trust file extensions or MIME strings alone.
- Keep dependencies updated and review package advisories.
- Protect recipe import from malformed data, oversized parameters and unsupported operation types.

### 15.3 User Control

- Provide Clear Session to release active images and working buffers.
- Provide Clear Local Data for locally stored recipes and preferences.
- Make download actions explicit.
- Explain that clearing a browser tab or session can remove work that has not been exported.

## 16. Error Handling and Edge Cases

The application must handle at least the following cases:

- Unsupported or corrupted image file.
- File whose extension does not match its content.
- Very large image dimensions or pixel count.
- Browser memory exhaustion or WASM allocation failure.
- Unsupported output format.
- An image with transparency exported to JPEG.
- Animated image input where only one frame is processed.
- Batch job with a mixture of valid and invalid files.
- Watermark image with an unsupported format.
- Font unavailable or not yet loaded before text rendering.
- User closes or reloads the page during processing.
- ZIP creation failure or download blocked by browser settings.
- Web Worker crash or WASM trap.

Errors must be isolated to the affected task wherever possible. The application should retain the original image and allow retry after recoverable failures.

## 17. Analytics and Product Success Metrics

The initial release can operate without collecting personal usage analytics. If privacy-preserving analytics are introduced later, they must be opt-in or clearly disclosed and must never include user image content or metadata.

### 17.1 Product Metrics

- Number of completed image operations per session.
- Successful export rate.
- Import-to-export completion rate.
- Batch processing completion rate.
- Repeat usage of quick tools.
- Recipe creation and reuse rate after V3.
- Frequency of processing errors by operation type and browser, without collecting file contents.

### 17.2 Quality Metrics

- Crash-free processing sessions.
- WASM worker failure rate.
- Export validation failure rate.
- Median and 95th percentile processing duration by operation and image size bucket.
- Application startup time.
- Browser compatibility test pass rate.

### 17.3 Initial Success Criteria

The MVP is ready for public launch when:

- All P0 requirements pass acceptance testing.
- The common import, convert, resize, crop, compress, watermark and batch flows work in supported desktop browsers.
- The application does not upload images to a backend.
- The main interface remains responsive during supported long-running operations.
- Exported files open in common image viewers and browsers.
- No known critical security or data-loss defects remain.

## 18. Testing Strategy

### 18.1 Unit Tests

- Colour conversion functions.
- Resize kernel calculations.
- Transform coordinate mapping.
- Alpha-channel behaviour.
- Histogram calculations.
- Compression target search logic.
- Recipe schema validation and migration.
- File naming and collision handling.

### 18.2 Golden Image Tests

Maintain a small test corpus with known dimensions, transparency and colour properties. Compare outputs against reference images with tolerances appropriate to each operation and browser encoder.

Avoid requiring byte-for-byte equality for formats where browser encoding can vary. Use pixel comparisons, structural checks and quality thresholds where appropriate.

### 18.3 Integration Tests

- File import through picker and drag-and-drop.
- JavaScript-to-WASM memory transfers.
- Worker lifecycle and cancellation.
- Operation graph evaluation.
- Export and download.
- ZIP packaging.
- Recipe import and execution.

### 18.4 End-to-End Tests

Automate the major user journeys across supported browsers:

- Compress one image.
- Convert a transparent PNG to JPEG with a chosen background.
- Resize and crop to a social preset.
- Apply a watermark to a batch.
- Continue a quick edit in the Editor.
- Recover from one invalid file in a batch.

### 18.5 Manual Testing

Test with portrait, landscape, square, transparent, very large, low-resolution and unusually named files. Include mobile and low-memory device testing before broad release.

## 19. Deployment and CI/CD

### 19.1 Hosting

The initial deployment target is GitHub Pages. The hosted application consists of static HTML, CSS, JavaScript, WASM assets and other static resources.

### 19.2 Build Pipeline

1. Install pinned frontend dependencies.
2. Install or provision a pinned Zig compiler version.
3. Run Zig unit tests.
4. Compile the browser-compatible WASM module.
5. Validate the exported ABI and WASM artifact.
6. Run frontend linting, type checks and unit tests.
7. Build the production frontend.
8. Run smoke tests against the built static output.
9. Deploy to GitHub Pages after the required branch or release checks pass.

### 19.3 Deployment Considerations

- Configure the correct Vite base path for a project site hosted below the account root.
- Ensure `.wasm` files are served with an appropriate WebAssembly MIME type where possible.
- Include a fallback loading path if streaming instantiation is unavailable or MIME configuration is incorrect.
- Version WASM assets and use content hashes to avoid stale browser caches.
- Keep the application functional as a static site with no required runtime server.

## 20. Phased Implementation Plan

The time estimates below are planning ranges for a small, experienced team. Actual duration depends on UI depth, codec compatibility, test coverage and the quality bar for release.

### Phase 0: Technical Foundation

**Objective:** Prove the browser and Zig integration before building the full UI.

Deliverables:
- Repository structure and pinned toolchain.
- Minimal React/Vite application.
- Zig-to-WASM build and load path.
- Worker-based WASM execution.
- Defined RGBA pixel buffer contract.
- One verified pixel operation and one transform operation.
- Basic image decode and export spike.
- Automated smoke test.

Exit criteria:
- A browser can import an image, pass pixel data to Zig, process it and export a valid image.
- The main UI remains responsive during processing.
- Buffer ownership and cleanup are covered by tests.

### Phase 1: MVP Image Essentials

**Objective:** Deliver the useful first public version.

Deliverables:
- Home and tool navigation.
- Import queue and thumbnails.
- Convert, compress, resize, crop, rotate and flip.
- Text and image watermark.
- Before/after preview.
- Batch operations and per-file status.
- Individual and ZIP export.
- Privacy and supported-format information.
- Responsive layout and accessible controls.

Exit criteria:
- All P0 requirements pass.
- Core workflows work across supported desktop browsers.
- Exported files pass validation.

### Phase 2: Creative Studio

**Objective:** Turn the utilities into a cohesive editing experience.

Deliverables:
- Shared Editor workspace.
- Operation stack and non-destructive edits.
- Undo and redo.
- Brightness, contrast, saturation, temperature and selected tone adjustments.
- Filters and convolution-based effects.
- Shapes, labels, borders and richer text overlays.
- Colour picker and histogram.
- Collage and before/after composition.

Exit criteria:
- Quick tools and Editor use shared operation definitions.
- Preview and full-resolution export apply the same operation parameters.
- Undo and redo remain consistent across supported operations.

### Phase 3: Batch Recipes and Power Tools

**Objective:** Support repeatable workflows and advanced inspection.

Deliverables:
- Save, import and export recipes.
- Recipe schema versioning.
- Reorderable batch operation pipelines.
- Image metadata inspector and metadata removal where supported.
- Pixel inspector and transparency analysis.
- Image diff and perceptual comparison.
- Contact sheet, image split and merge utilities.
- Print size and DPI calculators.

Exit criteria:
- Recipes can be imported safely and applied consistently.
- Invalid files and operations fail safely without losing successful outputs.

### Phase 4: Advanced Conventional Image Tools

**Objective:** Expand capability while maintaining a strict no-AI product position.

Potential deliverables:
- Manual colour-based background selection.
- Chroma key and mask brush.
- Manual masking and feathering.
- Advanced resampling methods.
- Selective blur and sharpening.
- Perspective and distortion corrections.
- Advanced colour quantization and dithering.
- Additional browser-supported codecs.

Exit criteria:
- Each feature has documented limitations and test coverage.
- No feature is described as AI-powered or semantic when it is based on conventional image processing.

## 21. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Browser codec differences | Different formats may be available across browsers | Detect capabilities at runtime and provide clear alternatives |
| Large-image memory use | Crashes or failed exports | Use previews, bounded concurrency, explicit limits and early validation |
| WASM memory copying overhead | Slower performance for large images | Minimize copies, process in workers and benchmark end-to-end |
| Zig toolchain changes | Build or ABI incompatibility | Pin Zig version and test the compiled artifact in CI |
| Scope expansion | Delayed MVP | Keep V1 limited to the defined P0 feature set |
| Preview/export mismatch | User distrust | Share operation definitions and validate against full-resolution test images |
| Loss of unsaved work | User frustration | Preserve session state while active and clearly communicate that export is required for durable storage |
| Unsupported format assumptions | Confusing user experience | Feature-detect decoding and encoding and maintain a tested format matrix |
| Complex editor architecture | High maintenance cost | Use a typed operation model and shared processing engine |
| Unsafe imported content | Security risk | Validate data, constrain SVG support and keep dependencies current |

## 22. Open Decisions

These decisions should be resolved during Phase 0 or before V1 implementation is complete.

1. **Initial maximum image dimensions:** Select conservative defaults based on device testing and make them configurable.
2. **Supported browser matrix:** Define exact minimum browser versions after testing the required APIs.
3. **AVIF export:** Decide whether to include it in the first release or enable only on verified browsers.
4. **Animated image handling:** Decide whether V1 rejects animated images or processes only the first frame with a clear warning.
5. **Font strategy:** Decide whether to ship a small set of licensed fonts or rely on system fonts for watermark text.
6. **Local recipe persistence:** Decide whether recipe storage is included in V1 or V2.
7. **Telemetry:** Decide whether to launch without analytics or introduce privacy-preserving, disclosed usage metrics.
8. **License review:** Review every dependency and any third-party codec or image-processing library before distribution.

## 23. Definition of Done

A feature is complete when:

- Its functional requirements and acceptance criteria are met.
- It works with the supported file types and has tested failure behaviour.
- It does not block the main UI during intensive processing.
- Memory allocations, buffers, object URLs and worker resources are released correctly.
- It has unit and relevant integration or end-to-end tests.
- It is accessible by keyboard and has understandable labels and feedback.
- Its limitations are documented in the UI or help content.
- It does not transmit user image data to a PixelForge server.
- Its exported output has been validated with representative files.

## 24. Recommended Repository Structure

```text
pixelforge/
├── apps/
│   └── web/
│       ├── src/
│       │   ├── app/
│       │   ├── components/
│       │   ├── features/
│       │   │   ├── home/
│       │   │   ├── quick-tools/
│       │   │   ├── editor/
│       │   │   ├── batch-studio/
│       │   │   ├── presets/
│       │   │   └── export/
│       │   ├── services/
│       │   ├── workers/
│       │   ├── state/
│       │   └── styles/
│       └── public/
│
├── packages/
│   ├── image-contracts/
│   ├── operation-model/
│   ├── browser-image-io/
│   └── recipe-schema/
│
├── engine/
│   └── zig/
│       ├── src/
│       │   ├── core/
│       │   ├── filters/
│       │   ├── analysis/
│       │   ├── batch/
│       │   └── wasm/
│       ├── build.zig
│       └── build.zig.zon
│
├── tests/
│   ├── fixtures/
│   ├── golden-images/
│   ├── integration/
│   └── e2e/
│
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy-pages.yml
│
├── docs/
│   ├── architecture.md
│   ├── wasm-abi.md
│   ├── supported-formats.md
│   └── privacy.md
│
└── README.md
```

## 25. Final Product Recommendation

Build PixelForge as a local-first image utility suite with a shared non-destructive editing engine. Do not attempt to ship every feature in the first release. Establish the browser-to-Zig processing contract first, then deliver the essential workflow of import, convert, resize, crop, compress, watermark and batch export.

The key architectural decision is to use the browser for image decoding, rendering and encoding, while using Zig/WASM for the computational image operations that benefit from a portable, high-performance engine. This keeps the application suitable for static hosting, limits unnecessary complexity and creates a foundation that can grow into a capable editing studio without requiring a backend.
