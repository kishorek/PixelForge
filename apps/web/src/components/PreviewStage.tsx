import type { CropParams } from "@pixelforge/image-contracts";
import { type CSSProperties, type PointerEvent, useEffect, useRef, useState } from "react";
import type { PreviewState } from "../hooks/usePreview";
import type { SessionAsset } from "../state/session";
import { Alert, IconButton, Spinner } from "./ui";

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function clampCrop(crop: CropParams): CropParams {
  const width = Math.min(1, Math.max(0.02, crop.width));
  const height = Math.min(1, Math.max(0.02, crop.height));
  return {
    x: Math.min(Math.max(0, crop.x), 1 - width),
    y: Math.min(Math.max(0, crop.y), 1 - height),
    width,
    height,
  };
}

function CropOverlay({
  asset,
  crop,
  onChange,
}: {
  asset: SessionAsset;
  crop: CropParams;
  onChange: (crop: CropParams) => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{
    mode: "new" | "move" | "resize";
    startX: number;
    startY: number;
    startCrop: CropParams;
  } | null>(null);

  const toNormalised = (clientX: number, clientY: number) => {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: clamp01((clientX - rect.left) / rect.width),
      y: clamp01((clientY - rect.top) / rect.height),
    };
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const point = toNormalised(event.clientX, event.clientY);
    const withinX = point.x >= crop.x && point.x <= crop.x + crop.width;
    const withinY = point.y >= crop.y && point.y <= crop.y + crop.height;
    const nearCorner =
      Math.abs(point.x - (crop.x + crop.width)) < 0.04 &&
      Math.abs(point.y - (crop.y + crop.height)) < 0.04;
    const isFullFrame =
      crop.x <= 0.001 && crop.y <= 0.001 && crop.width >= 0.999 && crop.height >= 0.999;
    const mode = nearCorner ? "resize" : withinX && withinY && !isFullFrame ? "move" : "new";
    setDrag({ mode, startX: point.x, startY: point.y, startCrop: crop });
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    const point = toNormalised(event.clientX, event.clientY);
    if (drag.mode === "new") {
      onChange(
        clampCrop({
          x: Math.min(drag.startX, point.x),
          y: Math.min(drag.startY, point.y),
          width: Math.abs(point.x - drag.startX),
          height: Math.abs(point.y - drag.startY),
        }),
      );
      return;
    }
    if (drag.mode === "move") {
      onChange(
        clampCrop({
          ...drag.startCrop,
          x: drag.startCrop.x + (point.x - drag.startX),
          y: drag.startCrop.y + (point.y - drag.startY),
        }),
      );
      return;
    }
    onChange(
      clampCrop({
        x: drag.startCrop.x,
        y: drag.startCrop.y,
        width: point.x - drag.startCrop.x,
        height: point.y - drag.startCrop.y,
      }),
    );
  };

  const handlePointerUp = () => {
    setDrag(null);
  };

  return (
    <div
      ref={frameRef}
      className="crop-frame"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <img
        className="crop-frame__image"
        src={asset.previewUrl}
        alt={`Crop source: ${asset.name}`}
        draggable={false}
      />
      <div
        className="crop-frame__selection"
        aria-hidden="true"
        style={{
          left: `${crop.x * 100}%`,
          top: `${crop.y * 100}%`,
          width: `${crop.width * 100}%`,
          height: `${crop.height * 100}%`,
        }}
      >
        <span className="crop-frame__handle" />
      </div>
    </div>
  );
}

function BeforeAfter({
  original,
  edited,
  fill = false,
}: {
  original: string;
  edited: string;
  fill?: boolean;
}) {
  const [split, setSplit] = useState(50);
  return (
    <div
      className="compare"
      style={
        {
          "--split": `${split}%`,
          ...(fill ? { width: "100%", height: "100%", maxWidth: "none", maxHeight: "none" } : {}),
        } as CSSProperties
      }
    >
      <img
        className="compare__layer compare__after"
        src={edited}
        alt="Edited preview"
        style={
          fill ? { width: "100%", height: "100%", maxWidth: "none", maxHeight: "none" } : undefined
        }
      />
      <img className="compare__before" src={original} alt="Original version" />
      <span className="compare__handle" aria-hidden="true" />
      <input
        className="compare__range"
        type="range"
        min={0}
        max={100}
        value={split}
        aria-label="Compare original and edited image"
        onChange={(event) => setSplit(Number(event.target.value))}
      />
    </div>
  );
}

export function PreviewStage({
  asset,
  preview,
  compare = false,
  crop,
  onCropChange,
  zoomable = false,
  emptyTitle = "No image selected",
  emptyHint = "Add an image to the queue to start editing.",
}: {
  asset: SessionAsset | null;
  preview: PreviewState;
  compare?: boolean;
  crop?: CropParams;
  onCropChange?: (crop: CropParams) => void;
  zoomable?: boolean;
  emptyTitle?: string;
  emptyHint?: string;
}) {
  const zoomViewportRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const [scaleOverride, setScaleOverride] = useState<number | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!zoomable || !preview.url) return;
    const element = zoomViewportRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) setViewport({ width: rect.width, height: rect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [zoomable, preview.url]);

  if (!asset) {
    return (
      <div className="stage">
        <div className="stage__empty">
          <strong>{emptyTitle}</strong>
          <span>{emptyHint}</span>
        </div>
      </div>
    );
  }

  const cropping = crop !== undefined && onCropChange !== undefined;
  const showZoom = zoomable && preview.url !== null && !cropping;
  const fitScale =
    showZoom && preview.width > 0 && preview.height > 0 && viewport.width > 0 && viewport.height > 0
      ? Math.max(
          0.05,
          Math.min(
            1,
            (viewport.width - 32) / preview.width,
            (viewport.height - 32) / preview.height,
          ),
        )
      : 1;
  const scale = scaleOverride ?? fitScale;

  const handleZoomPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!showZoom || event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest("input,button")) return;
    const element = zoomViewportRef.current;
    if (!element) return;
    panRef.current = {
      x: event.clientX,
      y: event.clientY,
      left: element.scrollLeft,
      top: element.scrollTop,
    };
    element.setPointerCapture(event.pointerId);
  };

  const handleZoomPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const pan = panRef.current;
    const element = zoomViewportRef.current;
    if (!pan || !element) return;
    element.scrollLeft = pan.left - (event.clientX - pan.x);
    element.scrollTop = pan.top - (event.clientY - pan.y);
  };

  const handleZoomPointerUp = () => {
    panRef.current = null;
  };

  return (
    <div className={`stage${compare && !cropping ? " stage--compare" : ""}`}>
      {showZoom ? (
        <>
          <section
            ref={zoomViewportRef}
            className="zoom-viewport"
            tabIndex={0}
            aria-label="Zoomable image preview. Drag to pan when zoomed; arrow keys scroll."
            onPointerDown={handleZoomPointerDown}
            onPointerMove={handleZoomPointerMove}
            onPointerUp={handleZoomPointerUp}
            onPointerCancel={handleZoomPointerUp}
          >
            <div
              className="zoom-content"
              style={{ width: preview.width * scale, height: preview.height * scale }}
            >
              {compare ? (
                <BeforeAfter original={asset.previewUrl} edited={preview.url as string} fill />
              ) : (
                <img
                  className="zoom-image"
                  src={preview.url ?? undefined}
                  alt={`Edited preview of ${asset.name}`}
                  draggable={false}
                  style={{ width: "100%", height: "100%" }}
                />
              )}
            </div>
          </section>
        </>
      ) : (
        <div className="stage__inner">
          {cropping ? (
            <CropOverlay asset={asset} crop={crop} onChange={onCropChange} />
          ) : preview.url ? (
            compare ? (
              <BeforeAfter original={asset.previewUrl} edited={preview.url} />
            ) : (
              <img
                className="stage__image"
                src={preview.url}
                alt={`Edited preview of ${asset.name}`}
              />
            )
          ) : preview.busy ? (
            <output className="stage__empty" aria-live="polite">
              <Spinner label="Rendering preview" />
              <strong>Rendering preview…</strong>
              <span>Applying the current operations at preview resolution.</span>
            </output>
          ) : (
            <div className="stage__empty">
              <strong>Preview unavailable</strong>
              <span>{preview.error?.message ?? "Adjust the settings to generate a preview."}</span>
            </div>
          )}
        </div>
      )}

      {showZoom ? (
        <fieldset className="stage__toolbar zoom-controls" aria-label="Preview zoom">
          <button
            type="button"
            className="zoom-control"
            aria-pressed={scaleOverride === null}
            onClick={() => setScaleOverride(null)}
          >
            Fit
          </button>
          <button
            type="button"
            className="zoom-control"
            aria-pressed={scaleOverride === 1}
            onClick={() => setScaleOverride(1)}
          >
            100%
          </button>
          <IconButton
            label="Zoom out"
            onClick={() => setScaleOverride(Math.max(0.1, scale / 1.25))}
          >
            −
          </IconButton>
          <span className="zoom-controls__value mono">{Math.round(scale * 100)}%</span>
          <IconButton label="Zoom in" onClick={() => setScaleOverride(Math.min(8, scale * 1.25))}>
            +
          </IconButton>
        </fieldset>
      ) : null}

      {preview.error && preview.url ? (
        <div className="stage__alert">
          <Alert tone="danger" title="Preview problem">
            {preview.error.message} {preview.error.hint}
          </Alert>
        </div>
      ) : null}

      <div className="stage__status" aria-live="polite">
        {cropping
          ? "Drag to select a crop area"
          : preview.busy
            ? "Rendering preview…"
            : preview.url
              ? `Preview ${preview.width}×${preview.height}${preview.durationMs ? ` · ${Math.round(preview.durationMs)} ms` : ""}`
              : "No preview"}
      </div>
    </div>
  );
}
