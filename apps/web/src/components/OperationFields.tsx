import type {
  AdjustParams,
  Anchor,
  BorderParams,
  ChromaKeyParams,
  CropParams,
  Dimensions,
  FilterParams,
  ImageWatermarkParams,
  MaskEffectParams,
  Operation,
  QuantizeParams,
  ResizeParams,
  ShapeParams,
  TextWatermarkParams,
  WarpParams,
} from "@pixelforge/image-contracts";
import {
  DEFAULT_ADJUST,
  DEFAULT_BORDER,
  DEFAULT_CHROMA_KEY,
  DEFAULT_FILTER,
  DEFAULT_MASK_EFFECT,
  DEFAULT_QUANTIZE,
  DEFAULT_SHAPE,
  DEFAULT_WARP,
  cropWithAspect,
} from "@pixelforge/operation-model";
import { type MouseEvent, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useWatermarkUpload } from "../hooks/useWatermarkUpload";
import { activeAssetOf, useSession } from "../state/session";
import {
  Alert,
  Button,
  ColorField,
  Field,
  NumberField,
  RangeField,
  SegmentedControl,
  SelectField,
  SwitchRow,
  TextField,
} from "./ui";

const ANCHOR_OPTIONS: readonly { value: Anchor; label: string }[] = [
  { value: "top-left", label: "Top left" },
  { value: "top-center", label: "Top centre" },
  { value: "top-right", label: "Top right" },
  { value: "center-left", label: "Middle left" },
  { value: "center", label: "Centre" },
  { value: "center-right", label: "Middle right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "bottom-center", label: "Bottom centre" },
  { value: "bottom-right", label: "Bottom right" },
];

const ASPECT_OPTIONS = [
  { value: "free", label: "Freeform" },
  { value: "1", label: "Square 1:1" },
  { value: "1.333333", label: "Landscape 4:3" },
  { value: "0.75", label: "Portrait 3:4" },
  { value: "1.777778", label: "Wide 16:9" },
  { value: "0.5625", label: "Story 9:16" },
  { value: "1.5", label: "Photo 3:2" },
  { value: "0.666667", label: "Portrait 2:3" },
] as const;

function patchParams(operation: Operation, patch: object): Operation {
  return { ...operation, params: { ...operation.params, ...patch } } as Operation;
}

function clampCrop(crop: CropParams): CropParams {
  const width = Math.min(1, Math.max(0.01, crop.width));
  const height = Math.min(1, Math.max(0.01, crop.height));
  return {
    x: Math.min(Math.max(0, crop.x), 1 - width),
    y: Math.min(Math.max(0, crop.y), 1 - height),
    width,
    height,
  };
}

function ResizeFields({
  operation,
  source,
  onChange,
}: {
  operation: Operation & { type: "resize" };
  source: Dimensions;
  onChange: (operation: Operation) => void;
}) {
  const params = operation.params;
  const percentMode = params.percent !== null;
  const id = operation.id;

  const update = (patch: Partial<ResizeParams>) => onChange(patchParams(operation, patch));

  return (
    <>
      <Field label="Scale by">
        <SegmentedControl
          label="Resize mode"
          value={percentMode ? "percent" : "dimensions"}
          options={[
            { value: "dimensions", label: "Dimensions" },
            { value: "percent", label: "Percentage" },
          ]}
          onChange={(mode) => {
            if (mode === "percent") {
              update({ percent: 100 });
            } else {
              update({
                percent: null,
                width: Math.max(1, Math.round(source.width)),
                height: Math.max(1, Math.round(source.height)),
              });
            }
          }}
        />
      </Field>

      {percentMode ? (
        <RangeField
          id={`${id}-percent`}
          label="Scale"
          value={params.percent ?? 100}
          min={1}
          max={400}
          step={1}
          format={(value) => `${value}%`}
          onChange={(value) => update({ percent: value })}
          hint="Percentage keeps the original aspect ratio."
        />
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
            <NumberField
              id={`${id}-width`}
              label="Width"
              value={Math.round(params.width)}
              min={1}
              max={20000}
              suffix="px"
              onChange={(width) => {
                const nextHeight =
                  params.lockAspect && source.width > 0
                    ? Math.max(1, Math.round((width * source.height) / source.width))
                    : params.height;
                update({ width, height: nextHeight });
              }}
            />
            <NumberField
              id={`${id}-height`}
              label="Height"
              value={Math.round(params.height)}
              min={1}
              max={20000}
              suffix="px"
              onChange={(height) => {
                const nextWidth =
                  params.lockAspect && source.height > 0
                    ? Math.max(1, Math.round((height * source.width) / source.height))
                    : params.width;
                update({ height, width: nextWidth });
              }}
            />
          </div>
          <SwitchRow
            id={`${id}-lock`}
            label="Lock aspect ratio"
            description="Link width and height while editing."
            checked={params.lockAspect}
            onChange={(lockAspect) => update({ lockAspect })}
          />
          <Field
            label="Fit mode"
            hint="Contain fits inside the box. Cover fills and centre-crops. Stretch ignores proportion."
          >
            <SegmentedControl
              label="Resize fit mode"
              value={params.fit}
              options={[
                { value: "contain", label: "Contain" },
                { value: "cover", label: "Cover" },
                { value: "stretch", label: "Stretch" },
              ]}
              onChange={(fit) => update({ fit })}
            />
          </Field>
        </>
      )}

      <SelectField
        id={`${id}-resample`}
        label="Resampling"
        value={params.resampling}
        options={[
          { value: "bilinear", label: "Bilinear — smooth" },
          { value: "box", label: "Box — crisp downscale" },
          { value: "lanczos3", label: "Lanczos 3 — high quality" },
          { value: "catmull-rom", label: "Catmull-Rom — sharp" },
          { value: "nearest", label: "Nearest — pixel art" },
        ]}
        onChange={(resampling) => update({ resampling })}
        hint="Resampling runs in the Zig/WASM engine."
      />
    </>
  );
}

function CropFields({
  operation,
  source,
  onChange,
}: {
  operation: Operation & { type: "crop" };
  source: Dimensions;
  onChange: (operation: Operation) => void;
}) {
  const [aspect, setAspect] = useState("free");
  const crop = operation.params;
  const id = operation.id;
  const update = (patch: Partial<CropParams>) => {
    setAspect("free");
    onChange(patchParams(operation, clampCrop({ ...crop, ...patch })));
  };
  const percentage = (value: number) => Math.round(value * 100);

  return (
    <>
      <SelectField
        id={`${id}-aspect`}
        label="Aspect preset"
        value={aspect}
        options={ASPECT_OPTIONS}
        onChange={(next) => {
          setAspect(next);
          if (next === "free") return;
          onChange(patchParams(operation, cropWithAspect(Number(next), crop, source)));
        }}
        hint="Dragging on the image creates a freeform selection."
      />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
        <NumberField
          id={`${id}-x`}
          label="X position"
          value={percentage(crop.x)}
          min={0}
          max={99}
          suffix="%"
          onChange={(value) => update({ x: value / 100 })}
        />
        <NumberField
          id={`${id}-y`}
          label="Y position"
          value={percentage(crop.y)}
          min={0}
          max={99}
          suffix="%"
          onChange={(value) => update({ y: value / 100 })}
        />
        <NumberField
          id={`${id}-w`}
          label="Width"
          value={percentage(crop.width)}
          min={1}
          max={100}
          suffix="%"
          onChange={(value) => update({ width: value / 100 })}
        />
        <NumberField
          id={`${id}-h`}
          label="Height"
          value={percentage(crop.height)}
          min={1}
          max={100}
          suffix="%"
          onChange={(value) => update({ height: value / 100 })}
        />
      </div>
      <div className="row">
        <Button
          size="sm"
          onClick={() =>
            onChange(
              patchParams(operation, {
                x: (1 - crop.width) / 2,
                y: (1 - crop.height) / 2,
              }),
            )
          }
        >
          Centre selection
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setAspect("free");
            onChange(patchParams(operation, { x: 0, y: 0, width: 1, height: 1 }));
          }}
        >
          Reset
        </Button>
      </div>
      <p className="field__hint">
        Output: {Math.round(crop.width * source.width)} × {Math.round(crop.height * source.height)}{" "}
        px
      </p>
    </>
  );
}

function TextWatermarkFields({
  operation,
  onChange,
}: {
  operation: Operation & { type: "watermark-text" };
  onChange: (operation: Operation) => void;
}) {
  const params = operation.params;
  const id = operation.id;
  const update = (patch: Partial<TextWatermarkParams>) => onChange(patchParams(operation, patch));

  return (
    <>
      <TextField
        id={`${id}-text`}
        label="Watermark text"
        value={params.text}
        maxLength={120}
        onChange={(text) => update({ text })}
        placeholder="© Your Studio"
      />
      <SelectField
        id={`${id}-font`}
        label="Font"
        value={params.fontFamily}
        options={[
          { value: "system-ui, -apple-system, 'Segoe UI', sans-serif", label: "System sans" },
          { value: "Georgia, 'Times New Roman', serif", label: "Georgia serif" },
          { value: "ui-monospace, Menlo, Consolas, monospace", label: "Monospace" },
          { value: "'Arial Narrow', 'Helvetica Neue', sans-serif", label: "Condensed sans" },
        ]}
        onChange={(fontFamily) => update({ fontFamily })}
        hint="Uses system fonts, so no font download is required."
      />
      <SelectField
        id={`${id}-weight`}
        label="Weight"
        value={String(params.fontWeight)}
        options={[
          { value: "400", label: "Regular" },
          { value: "600", label: "Semibold" },
          { value: "700", label: "Bold" },
          { value: "800", label: "Heavy" },
        ]}
        onChange={(weight) =>
          update({ fontWeight: Number(weight) as TextWatermarkParams["fontWeight"] })
        }
      />
      <SwitchRow
        id={`${id}-italic`}
        label="Italic"
        checked={params.italic}
        onChange={(italic) => update({ italic })}
      />
      <RangeField
        id={`${id}-size`}
        label="Size"
        value={Math.round(params.sizeRatio * 100)}
        min={1}
        max={30}
        format={(value) => `${value}%`}
        onChange={(value) => update({ sizeRatio: value / 100 })}
        hint="Relative to the shorter image edge."
      />
      <ColorField
        id={`${id}-color`}
        label="Text colour"
        value={params.color}
        onChange={(color) => update({ color })}
      />
      <SwitchRow
        id={`${id}-plate`}
        label="Caption plate"
        description="Draw a background behind the text."
        checked={params.background !== null}
        onChange={(enabled) => update({ background: enabled ? "#000000" : null })}
      />
      {params.background !== null ? (
        <>
          <ColorField
            id={`${id}-background`}
            label="Plate colour"
            value={params.background}
            onChange={(background) => update({ background })}
          />
          <RangeField
            id={`${id}-padding`}
            label="Plate padding"
            value={Math.round(params.paddingRatio * 1000) / 10}
            min={0}
            max={20}
            step={0.1}
            format={(value) => `${value}%`}
            onChange={(value) => update({ paddingRatio: value / 100 })}
          />
        </>
      ) : null}
      <RangeField
        id={`${id}-opacity`}
        label="Opacity"
        value={Math.round(params.opacity * 100)}
        min={0}
        max={100}
        format={(value) => `${value}%`}
        onChange={(value) => update({ opacity: value / 100 })}
      />
      <SelectField
        id={`${id}-anchor`}
        label="Position"
        value={params.anchor}
        options={ANCHOR_OPTIONS}
        onChange={(anchor) => update({ anchor })}
        disabled={params.tile}
      />
      <RangeField
        id={`${id}-margin`}
        label="Margin"
        value={Math.round(params.marginRatio * 100)}
        min={0}
        max={20}
        format={(value) => `${value}%`}
        onChange={(value) => update({ marginRatio: value / 100 })}
      />
      <SwitchRow
        id={`${id}-tile`}
        label="Tile across image"
        description="Repeat the watermark diagonally."
        checked={params.tile}
        onChange={(tile) => update({ tile })}
      />
    </>
  );
}

export function WatermarkImageField() {
  const watermark = useSession((state) => state.watermarkImage);
  const setWatermarkImage = useSession((state) => state.setWatermarkImage);
  const { upload, busy, error } = useWatermarkUpload();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <Field
      label="Logo image"
      hint={
        watermark
          ? `${watermark.name} · ${watermark.width}×${watermark.height}`
          : "PNG or SVG-derived logos work best."
      }
      error={error ?? undefined}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/avif"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
          event.target.value = "";
        }}
      />
      <div className="row">
        {watermark ? (
          <img
            src={watermark.url}
            alt="Selected watermark"
            style={{
              height: 38,
              maxWidth: 96,
              objectFit: "contain",
              background: "var(--surface-2)",
              borderRadius: 3,
            }}
          />
        ) : null}
        <Button size="sm" loading={busy} onClick={() => inputRef.current?.click()}>
          {watermark ? "Replace" : "Upload logo"}
        </Button>
        {watermark ? (
          <Button size="sm" variant="ghost" onClick={() => setWatermarkImage(null)}>
            Remove
          </Button>
        ) : null}
      </div>
    </Field>
  );
}

function ImageWatermarkFields({
  operation,
  onChange,
}: {
  operation: Operation & { type: "watermark-image" };
  onChange: (operation: Operation) => void;
}) {
  const params = operation.params;
  const id = operation.id;
  const update = (patch: Partial<ImageWatermarkParams>) => onChange(patchParams(operation, patch));

  return (
    <>
      <WatermarkImageField />
      <RangeField
        id={`${id}-scale`}
        label="Logo width"
        value={Math.round(params.scaleRatio * 100)}
        min={2}
        max={100}
        format={(value) => `${value}%`}
        onChange={(value) => update({ scaleRatio: value / 100 })}
      />
      <RangeField
        id={`${id}-opacity`}
        label="Opacity"
        value={Math.round(params.opacity * 100)}
        min={0}
        max={100}
        format={(value) => `${value}%`}
        onChange={(value) => update({ opacity: value / 100 })}
      />
      <SelectField
        id={`${id}-anchor`}
        label="Position"
        value={params.anchor}
        options={ANCHOR_OPTIONS}
        onChange={(anchor) => update({ anchor })}
        disabled={params.tile}
      />
      <RangeField
        id={`${id}-margin`}
        label="Margin"
        value={Math.round(params.marginRatio * 100)}
        min={0}
        max={20}
        format={(value) => `${value}%`}
        onChange={(value) => update({ marginRatio: value / 100 })}
      />
      <SwitchRow
        id={`${id}-tile`}
        label="Tile across image"
        description="Repeat the logo across the image."
        checked={params.tile}
        onChange={(tile) => update({ tile })}
      />
    </>
  );
}

function GroupTitle({ children }: { children: string }) {
  return <span className="field-group-title">{children}</span>;
}

function AdjustFields({
  operation,
  onChange,
}: {
  operation: Operation & { type: "adjust" };
  onChange: (operation: Operation) => void;
}) {
  const params = operation.params;
  const update = (patch: Partial<AdjustParams>) => onChange(patchParams(operation, patch));
  const slider = (
    key: keyof AdjustParams,
    label: string,
    min: number,
    max: number,
    step = 1,
    format?: (value: number) => string,
  ) => (
    <RangeField
      key={key}
      id={`${operation.id}-${key}`}
      label={label}
      value={params[key]}
      min={min}
      max={max}
      step={step}
      format={format}
      onChange={(value) => update({ [key]: value } as Partial<AdjustParams>)}
    />
  );

  return (
    <>
      <GroupTitle>Light</GroupTitle>
      {slider("exposure", "Exposure", -100, 100)}
      {slider("brightness", "Brightness", -100, 100)}
      {slider("contrast", "Contrast", -100, 100)}
      {slider("highlights", "Highlights", -100, 100)}
      {slider("shadows", "Shadows", -100, 100)}
      {slider("gamma", "Gamma", 0.2, 3, 0.01, (value) => value.toFixed(2))}
      <div className="divider" />
      <GroupTitle>Colour</GroupTitle>
      {slider("saturation", "Saturation", -100, 100)}
      {slider("vibrance", "Vibrance", -100, 100)}
      {slider("temperature", "Temperature", -100, 100)}
      {slider("tint", "Tint", -100, 100)}
      <Button
        size="sm"
        variant="ghost"
        onClick={() => onChange(patchParams(operation, DEFAULT_ADJUST))}
      >
        Reset adjustments
      </Button>
      <p className="field__hint">Tone and colour adjustments run in the WASM engine.</p>
    </>
  );
}

function FilterFields({
  operation,
  onChange,
}: {
  operation: Operation & { type: "filter" };
  onChange: (operation: Operation) => void;
}) {
  const params = operation.params;
  const update = (patch: Partial<FilterParams>) => onChange(patchParams(operation, patch));

  return (
    <>
      <SelectField
        id={`${operation.id}-preset`}
        label="Filter"
        value={params.preset}
        options={[
          { value: "grayscale", label: "Grayscale" },
          { value: "sepia", label: "Sepia" },
          { value: "invert", label: "Invert" },
          { value: "blur", label: "Blur" },
          { value: "sharpen", label: "Sharpen" },
          { value: "emboss", label: "Emboss" },
          { value: "edge", label: "Edge detect" },
          { value: "posterize", label: "Posterize" },
          { value: "vignette", label: "Vignette" },
        ]}
        onChange={(preset) => update({ preset })}
      />
      <RangeField
        id={`${operation.id}-intensity`}
        label="Strength"
        value={Math.round(params.intensity * 100)}
        min={0}
        max={100}
        format={(value) => `${value}%`}
        onChange={(value) => update({ intensity: value / 100 })}
      />
      <Button
        size="sm"
        variant="ghost"
        onClick={() => onChange(patchParams(operation, DEFAULT_FILTER))}
      >
        Reset filter
      </Button>
      <p className="field__hint">
        Blur, sharpen, emboss and edge use convolution. Add another filter for a stacked look.
      </p>
    </>
  );
}

function clampShape(params: ShapeParams): ShapeParams {
  const width = Math.min(1, Math.max(0.01, params.width));
  const height = Math.min(1, Math.max(0.01, params.height));
  return {
    ...params,
    width,
    height,
    x: Math.min(Math.max(0, params.x), 1 - width),
    y: Math.min(Math.max(0, params.y), 1 - height),
  };
}

function ShapeFields({
  operation,
  onChange,
}: {
  operation: Operation & { type: "shape" };
  onChange: (operation: Operation) => void;
}) {
  const params = operation.params;
  const update = (patch: Partial<ShapeParams>) =>
    onChange(patchParams(operation, clampShape({ ...params, ...patch })));
  const percentage = (value: number) => Math.round(value * 100);

  return (
    <>
      <Field label="Shape" hint="Lines and arrows run diagonally through the selection box.">
        <SegmentedControl
          label="Shape type"
          value={params.shape}
          options={[
            { value: "rectangle", label: "Rectangle" },
            { value: "ellipse", label: "Ellipse" },
            { value: "line", label: "Line" },
            { value: "arrow", label: "Arrow" },
          ]}
          onChange={(shape) => update({ shape: shape as ShapeParams["shape"] })}
        />
      </Field>
      <GroupTitle>Geometry</GroupTitle>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
        <NumberField
          id={`${operation.id}-x`}
          label="X position"
          value={percentage(params.x)}
          min={0}
          max={99}
          suffix="%"
          onChange={(value) => update({ x: value / 100 })}
        />
        <NumberField
          id={`${operation.id}-y`}
          label="Y position"
          value={percentage(params.y)}
          min={0}
          max={99}
          suffix="%"
          onChange={(value) => update({ y: value / 100 })}
        />
        <NumberField
          id={`${operation.id}-width`}
          label="Width"
          value={percentage(params.width)}
          min={1}
          max={100}
          suffix="%"
          onChange={(value) => update({ width: value / 100 })}
        />
        <NumberField
          id={`${operation.id}-height`}
          label="Height"
          value={percentage(params.height)}
          min={1}
          max={100}
          suffix="%"
          onChange={(value) => update({ height: value / 100 })}
        />
      </div>
      {params.shape === "rectangle" || params.shape === "ellipse" ? (
        <ColorField
          id={`${operation.id}-fill`}
          label="Fill"
          value={params.fill}
          onChange={(fill) => update({ fill })}
        />
      ) : null}
      <ColorField
        id={`${operation.id}-stroke`}
        label="Stroke"
        value={params.stroke}
        onChange={(stroke) => update({ stroke })}
      />
      <RangeField
        id={`${operation.id}-stroke-width`}
        label="Stroke width"
        value={Math.round(params.strokeWidthRatio * 1000) / 10}
        min={0}
        max={10}
        step={0.1}
        format={(value) => `${value}%`}
        onChange={(value) => update({ strokeWidthRatio: value / 100 })}
      />
      <RangeField
        id={`${operation.id}-opacity`}
        label="Opacity"
        value={Math.round(params.opacity * 100)}
        min={0}
        max={100}
        format={(value) => `${value}%`}
        onChange={(value) => update({ opacity: value / 100 })}
      />
      <Button
        size="sm"
        variant="ghost"
        onClick={() => onChange(patchParams(operation, DEFAULT_SHAPE))}
      >
        Reset shape
      </Button>
    </>
  );
}

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((value) =>
      Math.max(0, Math.min(255, Math.round(value)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

function ColourSampler({ onPick }: { onPick: (colour: string) => void }) {
  const asset = useSession(activeAssetOf);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dataRef = useRef<ImageData | null>(null);

  useEffect(() => {
    if (!asset) {
      dataRef.current = null;
      return;
    }
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const maxEdge = 280;
      const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return;
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      dataRef.current = context.getImageData(0, 0, canvas.width, canvas.height);
    };
    image.src = asset.previewUrl;
    return () => {
      cancelled = true;
      image.onload = null;
    };
  }, [asset]);

  if (!asset) return null;

  const pick = (event: MouseEvent<HTMLButtonElement>) => {
    const canvas = canvasRef.current;
    const data = dataRef.current;
    if (!canvas || !data) return;
    const rect = canvas.getBoundingClientRect();
    const keyboard = event.detail === 0;
    const x = keyboard
      ? Math.floor(canvas.width / 2)
      : Math.floor(((event.clientX - rect.left) / rect.width) * canvas.width);
    const y = keyboard
      ? Math.floor(canvas.height / 2)
      : Math.floor(((event.clientY - rect.top) / rect.height) * canvas.height);
    const offset = (y * canvas.width + x) * 4;
    onPick(toHex(data.data[offset] ?? 0, data.data[offset + 1] ?? 0, data.data[offset + 2] ?? 0));
  };

  return (
    <div className="colour-sampler">
      <span className="field__label">Pick a colour from the image</span>
      <button
        type="button"
        className="colour-sampler__image"
        onClick={pick}
        aria-label="Pick a colour from the active image (click the image)"
      >
        <canvas ref={canvasRef} />
      </button>
      <span className="field__hint">
        Click the background colour in this sample. Keyboard activation picks the centre pixel.
      </span>
    </div>
  );
}

function ChromaKeyFields({
  operation,
  onChange,
}: {
  operation: Operation & { type: "chroma-key" };
  onChange: (operation: Operation) => void;
}) {
  const params = operation.params;
  const update = (patch: Partial<ChromaKeyParams>) => onChange(patchParams(operation, patch));

  return (
    <>
      <ColourSampler onPick={(color) => update({ color })} />
      <ColorField
        id={`${operation.id}-key`}
        label="Key colour"
        value={params.color}
        onChange={(color) => update({ color })}
      />
      <RangeField
        id={`${operation.id}-tolerance`}
        label="Tolerance"
        value={params.tolerance}
        min={0}
        max={100}
        format={(value) => `${value}%`}
        onChange={(tolerance) => update({ tolerance })}
        hint="How close a pixel must be to the key colour."
      />
      <RangeField
        id={`${operation.id}-feather`}
        label="Feather"
        value={params.feather}
        min={0}
        max={100}
        format={(value) => `${value}%`}
        onChange={(feather) => update({ feather })}
        hint="Softens the edge between keyed and kept pixels."
      />
      <SwitchRow
        id={`${operation.id}-invert`}
        label="Keep the keyed colour instead"
        description="Invert the key mask."
        checked={params.invert}
        onChange={(invert) => update({ invert })}
      />
      <SwitchRow
        id={`${operation.id}-replace`}
        label="Replace with a background colour"
        description="When off, keyed pixels become transparent."
        checked={params.background !== null}
        onChange={(enabled) => update({ background: enabled ? "#ffffff" : null })}
      />
      {params.background !== null ? (
        <ColorField
          id={`${operation.id}-background`}
          label="Background colour"
          value={params.background}
          onChange={(background) => update({ background })}
        />
      ) : null}
      <Button
        size="sm"
        variant="ghost"
        onClick={() => onChange(patchParams(operation, DEFAULT_CHROMA_KEY))}
      >
        Reset chroma key
      </Button>
    </>
  );
}

function QuantizeFields({
  operation,
  onChange,
}: {
  operation: Operation & { type: "quantize" };
  onChange: (operation: Operation) => void;
}) {
  const params = operation.params;
  const update = (patch: Partial<QuantizeParams>) => onChange(patchParams(operation, patch));

  return (
    <>
      <RangeField
        id={`${operation.id}-colours`}
        label="Palette colours"
        value={params.colors}
        min={2}
        max={64}
        onChange={(colors) => update({ colors: Math.round(colors) })}
        hint="The palette is extracted from the current image."
      />
      <SelectField
        id={`${operation.id}-dither`}
        label="Dithering"
        value={params.dither}
        options={[
          { value: "none", label: "None" },
          { value: "ordered", label: "Ordered (Bayer 4×4)" },
          { value: "floyd-steinberg", label: "Floyd–Steinberg" },
        ]}
        onChange={(dither) => update({ dither: dither as QuantizeParams["dither"] })}
      />
      <Button
        size="sm"
        variant="ghost"
        onClick={() => onChange(patchParams(operation, DEFAULT_QUANTIZE))}
      >
        Reset quantization
      </Button>
      <p className="field__hint">
        Palette reduction is a conventional colour quantizer; dithering trades banding for a
        patterned result.
      </p>
    </>
  );
}

function MaskEffectFields({
  operation,
  onChange,
}: {
  operation: Operation & { type: "mask-effect" };
  onChange: (operation: Operation) => void;
}) {
  const params = operation.params;
  const update = (patch: Partial<MaskEffectParams>) => onChange(patchParams(operation, patch));

  return (
    <>
      <SelectField
        id={`${operation.id}-effect`}
        label="Masked effect"
        value={params.effect}
        options={[
          { value: "erase", label: "Erase (alpha)" },
          { value: "blur", label: "Blur" },
          { value: "sharpen", label: "Sharpen" },
        ]}
        onChange={(effect) => update({ effect: effect as MaskEffectParams["effect"] })}
      />
      <RangeField
        id={`${operation.id}-feather`}
        label="Feather"
        value={params.feather}
        min={0}
        max={100}
        format={(value) => `${value}%`}
        onChange={(feather) => update({ feather })}
        hint="Softens the mask edge before the effect is applied."
      />
      <SwitchRow
        id={`${operation.id}-invert`}
        label="Invert mask"
        checked={params.invert}
        onChange={(invert) => update({ invert })}
      />
      {params.maskDataUrl.length === 0 ? (
        <Alert tone="info" title="No mask painted">
          Paint a mask with the brush, then return here to tune the effect.{" "}
          <Link to="/mask">Open the Mask tool</Link>.
        </Alert>
      ) : (
        <Link className="btn btn--sm" to="/mask">
          Edit mask in Mask tool
        </Link>
      )}
      <Button
        size="sm"
        variant="ghost"
        onClick={() => onChange(patchParams(operation, DEFAULT_MASK_EFFECT))}
      >
        Reset masked effect
      </Button>
      <p className="field__hint">
        The mask is stored as a PNG with the operation and is applied at full resolution on export.
      </p>
    </>
  );
}

function WarpFields({
  operation,
  onChange,
}: {
  operation: Operation & { type: "warp" };
  onChange: (operation: Operation) => void;
}) {
  const params = operation.params;
  const update = (patch: Partial<WarpParams>) => onChange(patchParams(operation, patch));

  return (
    <>
      <RangeField
        id={`${operation.id}-perspective`}
        label="Perspective"
        value={params.perspective}
        min={-100}
        max={100}
        onChange={(perspective) => update({ perspective })}
        hint="Approximate vertical keystone. Negative and positive directions mirror."
      />
      <RangeField
        id={`${operation.id}-distortion`}
        label="Distortion"
        value={params.distortion}
        min={-100}
        max={100}
        onChange={(distortion) => update({ distortion })}
        hint="Radial barrel (+) or pincushion (−) correction."
      />
      <SwitchRow
        id={`${operation.id}-background`}
        label="Fill exposed edges"
        description="When off, areas warped outside the source become transparent."
        checked={params.background !== null}
        onChange={(enabled) => update({ background: enabled ? "#000000" : null })}
      />
      {params.background !== null ? (
        <ColorField
          id={`${operation.id}-background-colour`}
          label="Edge colour"
          value={params.background}
          onChange={(background) => update({ background })}
        />
      ) : null}
      <Button
        size="sm"
        variant="ghost"
        onClick={() => onChange(patchParams(operation, DEFAULT_WARP))}
      >
        Reset warp
      </Button>
      <p className="field__hint">
        This is a conventional pixel warp, not a semantic correction. Extreme values can reveal
        transparent or filled edges.
      </p>
    </>
  );
}

function BorderFields({
  operation,
  onChange,
}: {
  operation: Operation & { type: "border" };
  onChange: (operation: Operation) => void;
}) {
  const params = operation.params;
  const update = (patch: Partial<BorderParams>) => onChange(patchParams(operation, patch));

  return (
    <>
      <RangeField
        id={`${operation.id}-width`}
        label="Border width"
        value={Math.round(params.widthRatio * 1000) / 10}
        min={0}
        max={20}
        step={0.1}
        format={(value) => `${value}%`}
        onChange={(value) => update({ widthRatio: value / 100 })}
      />
      <ColorField
        id={`${operation.id}-colour`}
        label="Border colour"
        value={params.color}
        onChange={(color) => update({ color })}
      />
      <RangeField
        id={`${operation.id}-opacity`}
        label="Opacity"
        value={Math.round(params.opacity * 100)}
        min={0}
        max={100}
        format={(value) => `${value}%`}
        onChange={(value) => update({ opacity: value / 100 })}
      />
      <SwitchRow
        id={`${operation.id}-inset`}
        label="Inset border"
        description="Keep the border inside the image bounds."
        checked={params.inset}
        onChange={(inset) => update({ inset })}
      />
      <Button
        size="sm"
        variant="ghost"
        onClick={() => onChange(patchParams(operation, DEFAULT_BORDER))}
      >
        Reset border
      </Button>
    </>
  );
}

export function OperationFields({
  operation,
  source,
  onChange,
}: {
  operation: Operation;
  source: Dimensions;
  onChange: (operation: Operation) => void;
}) {
  switch (operation.type) {
    case "resize":
      return <ResizeFields operation={operation} source={source} onChange={onChange} />;
    case "crop":
      return <CropFields operation={operation} source={source} onChange={onChange} />;
    case "rotate": {
      const params = operation.params;
      const normalized = ((params.angle % 360) + 360) % 360;
      return (
        <>
          <Field label="Right-angle presets" hint="Right-angle rotations use the faster WASM path.">
            <SegmentedControl
              label="Rotation preset"
              value={String(normalized)}
              options={[
                { value: "0", label: "0°" },
                { value: "90", label: "90°" },
                { value: "180", label: "180°" },
                { value: "270", label: "270°" },
              ]}
              onChange={(angle) => onChange(patchParams(operation, { angle: Number(angle) }))}
            />
          </Field>
          <NumberField
            id={`${operation.id}-angle`}
            label="Angle"
            value={Math.round(params.angle)}
            min={-360}
            max={360}
            suffix="°"
            onChange={(angle) => onChange(patchParams(operation, { angle }))}
            hint="Arbitrary angles expand the canvas to the rotated bounds."
          />
          <SwitchRow
            id={`${operation.id}-fill`}
            label="Fill exposed corners"
            description="When off, areas outside the rotated image become transparent."
            checked={params.background !== null && params.background !== undefined}
            onChange={(enabled) =>
              onChange(patchParams(operation, { background: enabled ? "#000000" : null }))
            }
          />
          {params.background !== null && params.background !== undefined ? (
            <ColorField
              id={`${operation.id}-background`}
              label="Corner colour"
              value={params.background}
              onChange={(background) => onChange(patchParams(operation, { background }))}
            />
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onChange(patchParams(operation, { angle: 90, background: null }))}
          >
            Reset rotation
          </Button>
        </>
      );
    }
    case "flip":
      return (
        <Field label="Flip direction">
          <SegmentedControl
            label="Flip direction"
            value={operation.params.direction}
            options={[
              { value: "horizontal", label: "Horizontal" },
              { value: "vertical", label: "Vertical" },
            ]}
            onChange={(direction) =>
              onChange(
                patchParams(operation, { direction: direction as "horizontal" | "vertical" }),
              )
            }
          />
        </Field>
      );
    case "watermark-text":
      return <TextWatermarkFields operation={operation} onChange={onChange} />;
    case "watermark-image":
      return <ImageWatermarkFields operation={operation} onChange={onChange} />;
    case "adjust":
      return <AdjustFields operation={operation} onChange={onChange} />;
    case "filter":
      return <FilterFields operation={operation} onChange={onChange} />;
    case "shape":
      return <ShapeFields operation={operation} onChange={onChange} />;
    case "border":
      return <BorderFields operation={operation} onChange={onChange} />;
    case "chroma-key":
      return <ChromaKeyFields operation={operation} onChange={onChange} />;
    case "warp":
      return <WarpFields operation={operation} onChange={onChange} />;
    case "mask-effect":
      return <MaskEffectFields operation={operation} onChange={onChange} />;
    case "quantize":
      return <QuantizeFields operation={operation} onChange={onChange} />;
  }
}
