# Privacy

PixelForge is designed around local-first processing.

## Image handling

- Images are read through the browser File API.
- Decoding, processing and encoding happen in the browser tab, including inside a Web Worker.
- No PixelForge server receives image bytes, thumbnails, file names, metadata or watermark text.
- There is no upload endpoint, account system or cloud synchronization.

## Analytics

The V1 application includes no analytics or telemetry. If privacy-preserving metrics are introduced
later, they must be opt-in or clearly disclosed and must never include image content, file names,
EXIF values or overlay text.

## Local storage

The following preferences may be stored in `localStorage`:

- `pixelforge.theme` — light or dark theme.
- `pixelforge.export-settings` — format, quality, background, target size and filename template.
- `pixelforge.recent-tools` — the last few tools used.
- `pixelforge.recipes` — saved batch recipes. Recipes contain operation parameters and optional
export settings, never image bytes.

Images are held in memory for the current session and are not written to local storage or IndexedDB
by default. Closing or reloading the tab discards the session; export anything you want to keep.

The Help page provides controls to clear the active session and local preferences.

## Dependencies and third-party code

Libraries are bundled into the static application at build time. The application does not load image
processing services or send user images to third parties. WASM runs from the same origin as the page.

## Browser and hosting visibility

The site is served as static files. Like any website, the hosting provider may see standard request
metadata such as IP address and user agent for page assets. Image data is not part of those requests.
