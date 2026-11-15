import type {
  Anchor,
  CropParams,
  Dimensions,
  ImageWatermarkParams,
  Operation,
  ResizeParams,
  TextWatermarkParams,
} from "@pixelforge/image-contracts";
import { cropWithAspect } from "@pixelforge/operation-model";
import { useRef, useState } from "react";
import { useWatermarkUpload } from "../hooks/useWatermarkUpload";
import { useSession } from "../state/session";
import {
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
        label="Colour"
        value={params.color}
        onChange={(color) => update({ color })}
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
    case "rotate":
      return (
        <Field label="Rotation" hint="Right-angle rotations run in the WASM engine.">
          <SegmentedControl
            label="Rotation angle"
            value={String(operation.params.angle)}
            options={[
              { value: "90", label: "90° clockwise" },
              { value: "180", label: "180°" },
              { value: "270", label: "270° clockwise" },
            ]}
            onChange={(angle) =>
              onChange(patchParams(operation, { angle: Number(angle) as 90 | 180 | 270 }))
            }
          />
        </Field>
      );
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
  }
}
