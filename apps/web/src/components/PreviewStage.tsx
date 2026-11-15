import type { CropParams } from "@pixelforge/image-contracts";
import { type CSSProperties, type PointerEvent, useRef, useState } from "react";
import type { PreviewState } from "../hooks/usePreview";
import type { SessionAsset } from "../state/session";
import { Alert, Spinner } from "./ui";

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

function BeforeAfter({ original, edited }: { original: string; edited: string }) {
  const [split, setSplit] = useState(50);
  return (
    <div className="compare" style={{ "--split": `${split}%` } as CSSProperties}>
      <img className="compare__layer compare__after" src={edited} alt="Edited preview" />
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
  emptyTitle = "No image selected",
  emptyHint = "Add an image to the queue to start editing.",
}: {
  asset: SessionAsset | null;
  preview: PreviewState;
  compare?: boolean;
  crop?: CropParams;
  onCropChange?: (crop: CropParams) => void;
  emptyTitle?: string;
  emptyHint?: string;
}) {
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

  return (
    <div className={`stage${compare && !cropping ? " stage--compare" : ""}`}>
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
