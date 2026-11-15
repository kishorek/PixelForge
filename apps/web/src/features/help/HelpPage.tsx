import { FORMATS } from "@pixelforge/image-contracts";
import type { ImageFormat } from "@pixelforge/image-contracts";
import { ShieldCheck, Trash2 } from "lucide-react";
import { useState } from "react";
import { useCapabilities } from "../../app/capabilities";
import { Badge, Button, ConfirmDialog } from "../../components/ui";
import { useSession } from "../../state/session";
import { imageProcessor } from "../../workers/client";

const FORMAT_LIST: ImageFormat[] = ["jpeg", "png", "webp", "avif"];

export function HelpPage() {
  const capabilities = useCapabilities();
  const assets = useSession((state) => state.assets);
  const clearSession = useSession((state) => state.clearSession);
  const [confirmSession, setConfirmSession] = useState(false);
  const [confirmStorage, setConfirmStorage] = useState(false);
  const [storageCleared, setStorageCleared] = useState(false);

  return (
    <div className="page">
      <header className="page-header">
        <span className="eyebrow">Help</span>
        <h1>Supported formats, privacy and limits</h1>
        <p className="lede">
          PixelForge is a static application. Your images are processed in this browser tab; there
          is no account and no upload service.
        </p>
      </header>

      <div className="prose">
        <section>
          <h2>Format support</h2>
          <p>
            Decoding depends on the browser’s built-in image decoders. Encoding is detected at
            runtime by attempting a small test encode.
          </p>
          <div className="summary">
            {FORMAT_LIST.map((format) => {
              const info = FORMATS[format];
              const supported = capabilities?.encode[format];
              return (
                <div className="summary__row" key={format}>
                  <span className="summary__label">
                    {info.label} <span className="muted">· {info.mimeType}</span>
                  </span>
                  <span className="summary__value">
                    {supported === undefined ? (
                      <Badge>Checking…</Badge>
                    ) : supported ? (
                      <Badge tone="ok">Encode supported</Badge>
                    ) : (
                      <Badge tone="warn">Encode unavailable</Badge>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
          <p>
            JPEG has no alpha channel. When exporting to JPEG, transparent pixels are flattened onto
            the background colour you choose. PNG is lossless, so target-size compression is
            best-effort and may not reach the requested size.
          </p>
        </section>

        <section>
          <h2>Privacy</h2>
          <div className="privacy-strip">
            <ShieldCheck className="privacy-strip__icon" size={22} aria-hidden="true" />
            <div>
              <h3>Local-first processing</h3>
              <p>
                Images, file names, metadata and watermark text are never sent to a PixelForge
                server. There is no analytics that includes image content. Third-party code is
                bundled with the application rather than loaded from a remote service at runtime.
              </p>
            </div>
          </div>
          <p>
            Closing or reloading the tab discards the session. Export anything you want to keep.
            Preferences such as theme and export defaults are stored in local storage and can be
            cleared below.
          </p>
        </section>

        <section>
          <h2>Limits and known behaviour</h2>
          <ul>
            <li>
              Images above 120 megapixels or 20,000 pixels on an edge are rejected to protect
              memory.
            </li>
            <li>Animated PNG and WebP inputs use the first frame; GIF is not a V1 input.</li>
            <li>
              Exported metadata varies by browser and format; PixelForge does not guarantee that
              EXIF or colour profiles are preserved or removed.
            </li>
            <li>
              Preview rendering uses a reduced resolution. The export always renders at full
              resolution with the same operation parameters.
            </li>
            <li>
              Processing runs sequentially in a worker. Very large batches take longer and use more
              memory; cancel and process in smaller groups if needed.
            </li>
            <li>Output may differ slightly between browsers because their encoders differ.</li>
            <li>Histogram, palette and pixel inspection use the reduced-resolution preview.</li>
            <li>
              Editor 100% zoom is preview-pixel scale; exports render at full resolution. Drag the
              zoomed canvas to pan.
            </li>
            <li>
              Collage, merge, contact sheet and split render sequentially in workers; very large
              queues can take longer.
            </li>
            <li>
              Metadata is read from the first 4 MB of the file; exports re-encode and remove
              metadata.
            </li>
            <li>
              Saved recipes and preferences live in local storage and are removed when site data is
              cleared.
            </li>
            <li>
              Advanced resampling offers Lanczos 3 and Catmull-Rom; perspective/distortion is an
              approximate conventional warp.
            </li>
            <li>
              Masks are stored with the operation as a PNG and apply to every image in batch
              processing.
            </li>
            <li>
              Output formats are limited to codecs the browser actually encodes; unsupported formats
              are not faked.
            </li>
          </ul>
        </section>

        <section>
          <h2>Keyboard and interaction</h2>
          <ul>
            <li>
              Use <kbd>Tab</kbd> and <kbd>Shift</kbd>+<kbd>Tab</kbd> to move through controls.
            </li>
            <li>Focus a slider and use the arrow keys to adjust it precisely.</li>
            <li>
              Paste an image from the clipboard with <kbd>Ctrl</kbd>/<kbd>Cmd</kbd>+<kbd>V</kbd>.
            </li>
            <li>Drag on the crop preview to draw a new crop; drag inside it to move it.</li>
            <li>The comparison slider is keyboard adjustable and works like any range input.</li>
            <li>
              Dialogs close with <kbd>Escape</kbd> and trap focus while open.
            </li>
          </ul>
        </section>

        <section>
          <h2>Session data</h2>
          <div className="row">
            <Button
              variant="danger"
              icon={<Trash2 size={15} aria-hidden="true" />}
              disabled={assets.length === 0}
              onClick={() => setConfirmSession(true)}
            >
              Clear active session
            </Button>
            <Button onClick={() => setConfirmStorage(true)}>Clear local preferences</Button>
          </div>
          {storageCleared ? (
            <p className="field__hint">Local preferences were cleared. Reload to see defaults.</p>
          ) : null}
        </section>
      </div>

      <ConfirmDialog
        open={confirmSession}
        onOpenChange={setConfirmSession}
        title="Clear the active session?"
        description="All imported images and unexported edits will be removed from this tab. This cannot be undone."
        confirmLabel="Clear session"
        onConfirm={() => {
          imageProcessor.cancelAll();
          clearSession();
          setConfirmSession(false);
        }}
      />
      <ConfirmDialog
        open={confirmStorage}
        onOpenChange={setConfirmStorage}
        title="Clear local preferences?"
        description="Theme, export defaults, recent tools and saved recipes stored in this browser will be removed. Images in the current session are not affected."
        confirmLabel="Clear preferences"
        onConfirm={() => {
          try {
            localStorage.removeItem("pixelforge.theme");
            localStorage.removeItem("pixelforge.export-settings");
            localStorage.removeItem("pixelforge.recent-tools");
            localStorage.removeItem("pixelforge.recipes");
          } catch {
            // Storage may be unavailable.
          }
          setStorageCleared(true);
          setConfirmStorage(false);
        }}
      />
    </div>
  );
}
