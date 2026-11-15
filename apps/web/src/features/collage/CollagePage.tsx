import { downloadBlob } from "@pixelforge/browser-image-io";
import { FORMATS } from "@pixelforge/image-contracts";
import type { Operation } from "@pixelforge/image-contracts";
import { formatBytes, formatFilename } from "@pixelforge/operation-model";
import { Download } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ExportSettingsFields } from "../../components/ExportPanel";
import { Workbench } from "../../components/Workbench";
import {
  Alert,
  Badge,
  Button,
  ColorField,
  Field,
  NumberField,
  RangeField,
  SegmentedControl,
  SelectField,
  Spinner,
  SwitchRow,
} from "../../components/ui";
import { usePreview } from "../../hooks/usePreview";
import { asPixelForgeError, newId } from "../../lib/errors";
import { activeAssetOf, useSession } from "../../state/session";
import { imageProcessor } from "../../workers/client";
import { collageProcessor } from "../../workers/collageClient";
import {
  COLLAGE_LAYOUTS,
  COLLAGE_LAYOUT_IDS,
  type CollageCell,
  type CollageLayoutId,
  contactSheetCells,
  mergeCells,
} from "./layouts";

const EMPTY_OPERATIONS: Operation[] = [];

type CollageMode = "images" | "before-after" | "contact-sheet" | "merge";

interface SizePreset {
  id: string;
  label: string;
  width: number | null;
  height: number | null;
}

const SIZE_PRESETS: SizePreset[] = [
  { id: "layout", label: "Layout default", width: null, height: null },
  { id: "square", label: "Square — 2000 × 2000", width: 2000, height: 2000 },
  { id: "landscape", label: "Landscape — 2400 × 1600", width: 2400, height: 1600 },
  { id: "portrait", label: "Portrait — 1600 × 2400", width: 1600, height: 2400 },
  { id: "story", label: "Story — 1080 × 1920", width: 1080, height: 1920 },
  { id: "wide", label: "Wide — 3000 × 1000", width: 3000, height: 1000 },
  { id: "a4", label: "A4 portrait — 2480 × 3508", width: 2480, height: 3508 },
  { id: "letter", label: "Letter portrait — 2550 × 3300", width: 2550, height: 3300 },
  { id: "custom", label: "Custom", width: null, height: null },
];

interface ExportResult {
  name: string;
  size: number;
  width: number;
  height: number;
  quality: number;
  targetMet: boolean | null;
}

export function CollagePage() {
  const assets = useSession((state) => state.assets);
  const activeAsset = useSession(activeAssetOf);
  const operations = useSession((state) =>
    state.activeId
      ? (state.operationsByAsset[state.activeId] ?? EMPTY_OPERATIONS)
      : EMPTY_OPERATIONS,
  );
  const watermarkImage = useSession((state) => state.watermarkImage);
  const exportSettings = useSession((state) => state.exportSettings);
  const preview = usePreview(activeAsset, operations, watermarkImage);

  const [mode, setMode] = useState<CollageMode>("images");
  const [layoutId, setLayoutId] = useState<CollageLayoutId>("2x1");
  const [sizePreset, setSizePreset] = useState("layout");
  const [width, setWidth] = useState(COLLAGE_LAYOUTS["2x1"].defaultWidth);
  const [height, setHeight] = useState(COLLAGE_LAYOUTS["2x1"].defaultHeight);
  const [gap, setGap] = useState(16);
  const [background, setBackground] = useState("#ffffff");
  const [fit, setFit] = useState<"cover" | "contain">("cover");
  const [labels, setLabels] = useState(true);
  const [contactColumns, setContactColumns] = useState(3);
  const [mergeDirection, setMergeDirection] = useState<"horizontal" | "vertical">("horizontal");

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewDims, setPreviewDims] = useState<{ width: number; height: number } | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<ReturnType<typeof asPixelForgeError> | null>(null);
  const [result, setResult] = useState<ExportResult | null>(null);

  const layout = COLLAGE_LAYOUTS[mode === "before-after" ? "before-after" : layoutId];
  const requestLayoutId: CollageLayoutId = mode === "before-after" ? "before-after" : layoutId;
  const cellsForRequest = useMemo<CollageCell[] | undefined>(() => {
    if (mode === "contact-sheet") {
      return contactSheetCells(assets.length, contactColumns).map((cell, index) => ({
        ...cell,
        label: assets[index]?.name,
      }));
    }
    if (mode === "merge") return mergeCells(assets.length, mergeDirection);
    return undefined;
  }, [mode, assets, contactColumns, mergeDirection]);
  const cells = cellsForRequest ?? layout.cells;
  const cellCount = cells.length;
  const labelsEnabled = (mode === "before-after" || mode === "contact-sheet") && labels;
  const modeLabel =
    mode === "before-after"
      ? "Before / after"
      : mode === "contact-sheet"
        ? `Contact sheet · ${contactColumns} columns`
        : mode === "merge"
          ? `Merge · ${mergeDirection}`
          : layout.label;

  useEffect(() => {
    if (sizePreset !== "layout") return;
    if (mode === "contact-sheet") {
      setWidth(2480);
      return;
    }
    if (mode === "merge") {
      if (mergeDirection === "horizontal") {
        setWidth(2400);
        setHeight(1200);
      } else {
        setWidth(1200);
        setHeight(2400);
      }
      return;
    }
    setWidth(layout.defaultWidth);
    setHeight(layout.defaultHeight);
  }, [mode, layout, sizePreset, mergeDirection]);

  useEffect(() => {
    if (mode !== "contact-sheet" || sizePreset !== "layout") return;
    const rows = Math.max(1, Math.ceil(assets.length / Math.max(1, contactColumns)));
    setHeight(Math.max(100, Math.round((width * rows) / Math.max(1, contactColumns))));
  }, [mode, sizePreset, assets.length, contactColumns, width]);

  const previewSources = useMemo(() => {
    if (mode === "before-after") return activeAsset ? [activeAsset] : [];
    if (mode === "contact-sheet" || mode === "merge") return assets;
    return assets.slice(0, layout.cells.length);
  }, [mode, activeAsset, assets, layout]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (previewSources.length === 0) {
        if (previewUrlRef.current) {
          URL.revokeObjectURL(previewUrlRef.current);
          previewUrlRef.current = null;
        }
        setPreviewUrl(null);
        setPreviewDims(null);
        setPreviewError(null);
        return;
      }
      setPreviewBusy(true);
      setPreviewError(null);
      try {
        let sources: Blob[];
        if (mode === "before-after") {
          const asset = previewSources[0];
          if (!asset) throw new Error("Select an image to build a before/after layout.");
          sources = [asset.blob];
          if (preview.url) {
            const response = await fetch(preview.url);
            sources.push(await response.blob());
          } else {
            sources.push(asset.blob);
          }
        } else {
          sources = previewSources.map((asset) => asset.blob);
        }

        const rendered = await collageProcessor.render(
          {
            layout: requestLayoutId,
            width,
            height,
            gap,
            background,
            fit,
            sources,
            labels: labelsEnabled,
            cells: cellsForRequest,
            format: "png",
            quality: 1,
            targetSizeBytes: null,
          },
          Math.min(1, 900 / Math.max(width, height)),
        );
        if (cancelled) return;
        const url = URL.createObjectURL(rendered.blob);
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = url;
        setPreviewUrl(url);
        setPreviewDims({ width: rendered.width, height: rendered.height });
      } catch (error) {
        if (!cancelled) setPreviewError(error instanceof Error ? error.message : String(error));
      } finally {
        if (!cancelled) setPreviewBusy(false);
      }
    }, 260);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    previewSources,
    mode,
    requestLayoutId,
    cellsForRequest,
    labelsEnabled,
    width,
    height,
    gap,
    background,
    fit,
    preview.url,
  ]);

  useEffect(
    () => () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    },
    [],
  );

  const available = mode === "before-after" ? (activeAsset ? 2 : 0) : assets.length;

  const exportCollage = async () => {
    if (exporting) return;
    setExporting(true);
    setExportError(null);
    try {
      let sources: Blob[];
      if (mode === "before-after") {
        if (!activeAsset) throw new Error("Select an image for the before/after layout.");
        const processed = await imageProcessor.process({
          jobId: newId("collage-before-after"),
          source: {
            blob: activeAsset.blob,
            name: activeAsset.name,
            width: activeAsset.width,
            height: activeAsset.height,
            mimeType: activeAsset.mimeType,
          },
          operations: operations.map((operation) => structuredClone(operation)),
          export: { ...exportSettings, format: "png", quality: 1, targetSizeBytes: null },
          watermarkImage: watermarkImage?.blob ?? null,
        });
        sources = [activeAsset.blob, processed.blob];
      } else {
        sources = previewSources.map((asset) => asset.blob);
      }

      const rendered = await collageProcessor.render(
        {
          layout: requestLayoutId,
          width,
          height,
          gap,
          background,
          fit,
          sources,
          labels: labelsEnabled,
          cells: cellsForRequest,
          format: exportSettings.format,
          quality: exportSettings.quality,
          targetSizeBytes: exportSettings.targetSizeBytes,
        },
        1,
      );
      const baseName =
        mode === "before-after"
          ? "before-after"
          : mode === "contact-sheet"
            ? "contact-sheet"
            : mode === "merge"
              ? "merge"
              : "collage";
      const name = formatFilename(exportSettings.filenameTemplate, {
        name: baseName,
        width: rendered.width,
        height: rendered.height,
        format: exportSettings.format,
        index: 1,
      });
      downloadBlob(rendered.blob, name);
      setResult({
        name,
        size: rendered.blob.size,
        width: rendered.width,
        height: rendered.height,
        quality: rendered.quality,
        targetMet: rendered.targetMet,
      });
    } catch (error) {
      setExportError(asPixelForgeError(error));
    } finally {
      setExporting(false);
    }
  };

  const sizeOptions = SIZE_PRESETS.map((preset) => ({
    value: preset.id,
    label: preset.label,
  }));

  return (
    <Workbench
      title="Collage"
      description="Compose a grid or before/after layout from the session queue."
      stage={
        <div className="stage">
          {previewUrl ? (
            <img className="stage__image" src={previewUrl} alt="Collage preview" />
          ) : (
            <div className="stage__empty">
              {previewBusy ? <Spinner label="Rendering collage" /> : null}
              <strong>
                {previewBusy
                  ? "Rendering collage…"
                  : assets.length === 0
                    ? "Add images to compose"
                    : "Collage preview unavailable"}
              </strong>
              <span>
                {previewError ??
                  (assets.length === 0
                    ? "Import two or more images, then choose a layout."
                    : "Adjust the layout or size to generate a preview.")}
              </span>
            </div>
          )}
          {previewError && previewUrl ? (
            <div className="stage__alert">
              <Alert tone="danger" title="Collage preview problem">
                {previewError}
              </Alert>
            </div>
          ) : null}
          <div className="stage__status" aria-live="polite">
            {previewBusy
              ? "Rendering collage…"
              : previewDims
                ? `Preview ${previewDims.width}×${previewDims.height}`
                : "No preview"}
          </div>
        </div>
      }
      canvasbarExtra={
        <span className="mono muted">
          {modeLabel} · {FORMATS[exportSettings.format].label}
        </span>
      }
      footer={
        <>
          <div className="workbench__footer-info">
            <span className="muted">Collage output</span>
            <strong>
              {width} × {height} · {FORMATS[exportSettings.format].label}
            </strong>
            <span className="muted">
              {mode === "before-after"
                ? "Original and processed pair"
                : `${Math.min(available, cellCount)} of ${cellCount} cells filled`}
            </span>
          </div>
          <div className="row">
            <Button
              variant="primary"
              icon={<Download size={15} aria-hidden="true" />}
              loading={exporting}
              disabled={available === 0}
              onClick={() => void exportCollage()}
            >
              Render &amp; download
            </Button>
          </div>
        </>
      }
      inspector={
        <div className="inspector-scroll">
          <section className="inspector-section">
            <span className="eyebrow">Compose</span>
            <h2 className="inspector-title">Build a layout</h2>
            <p className="field__hint">
              {mode === "before-after"
                ? "Before/after uses the selected image and its current operation pipeline."
                : mode === "contact-sheet"
                  ? "Contact sheet places every queue image in a labelled grid."
                  : mode === "merge"
                    ? "Merge stitches every queue image edge to edge."
                    : `Collage uses the first ${cellCount} images in the queue.`}
            </p>
            <SegmentedControl
              label="Collage mode"
              value={mode}
              options={[
                { value: "images", label: "Images" },
                { value: "before-after", label: "Before / after" },
                { value: "contact-sheet", label: "Contact sheet" },
                { value: "merge", label: "Merge" },
              ]}
              onChange={(value) => setMode(value as CollageMode)}
            />
            {available > 0 && available < cellCount ? (
              <Alert tone="warn" title="Not enough images">
                This layout has {cellCount} cells but only {available} image
                {available === 1 ? "" : "s"} are available. Empty cells keep the background colour.
              </Alert>
            ) : null}
          </section>

          <section className="inspector-section">
            <h2 className="inspector-section__title">Layout</h2>
            {mode === "images" ? (
              <SelectField
                id="collage-layout"
                label="Layout"
                value={layoutId}
                options={COLLAGE_LAYOUT_IDS.map((id) => ({
                  value: id,
                  label: COLLAGE_LAYOUTS[id].label,
                }))}
                onChange={(value) => setLayoutId(value as CollageLayoutId)}
              />
            ) : mode === "contact-sheet" ? (
              <RangeField
                id="collage-columns"
                label="Columns"
                value={contactColumns}
                min={1}
                max={6}
                onChange={setContactColumns}
                hint="Rows are calculated from the number of images."
              />
            ) : mode === "merge" ? (
              <Field label="Merge direction">
                <SegmentedControl
                  label="Merge direction"
                  value={mergeDirection}
                  options={[
                    { value: "horizontal", label: "Horizontal" },
                    { value: "vertical", label: "Vertical" },
                  ]}
                  onChange={(value) => setMergeDirection(value as "horizontal" | "vertical")}
                />
              </Field>
            ) : (
              <p className="field__hint">Side-by-side before and after with optional labels.</p>
            )}
            <SelectField
              id="collage-size"
              label="Output size"
              value={sizePreset}
              options={sizeOptions}
              onChange={(value) => {
                setSizePreset(value);
                const preset = SIZE_PRESETS.find((candidate) => candidate.id === value);
                if (preset?.width && preset.height) {
                  setWidth(preset.width);
                  setHeight(preset.height);
                }
              }}
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
              <NumberField
                id="collage-width"
                label="Width"
                value={width}
                min={100}
                max={6000}
                suffix="px"
                onChange={(value) => {
                  setWidth(value);
                  setSizePreset("custom");
                }}
              />
              <NumberField
                id="collage-height"
                label="Height"
                value={height}
                min={100}
                max={6000}
                suffix="px"
                onChange={(value) => {
                  setHeight(value);
                  setSizePreset("custom");
                }}
              />
            </div>
            <RangeField
              id="collage-gap"
              label="Gap"
              value={gap}
              min={0}
              max={80}
              format={(value) => `${value} px`}
              onChange={setGap}
            />
            <ColorField
              id="collage-background"
              label="Background"
              value={background}
              onChange={setBackground}
            />
            <Field label="Image fit">
              <SegmentedControl
                label="Image fit"
                value={fit}
                options={[
                  { value: "cover", label: "Cover" },
                  { value: "contain", label: "Contain" },
                ]}
                onChange={(value) => setFit(value as "cover" | "contain")}
              />
            </Field>
            {mode === "before-after" || mode === "contact-sheet" ? (
              <SwitchRow
                id="collage-labels"
                label={mode === "before-after" ? "Before / after labels" : "File name labels"}
                checked={labels}
                onChange={setLabels}
              />
            ) : null}
          </section>

          <ExportSettingsFields />

          <section className="inspector-section">
            <h2 className="inspector-section__title">Export</h2>
            {mode === "before-after" && !activeAsset ? (
              <Alert tone="info" title="Select an image">
                Choose an image in the queue to build a before/after layout.
              </Alert>
            ) : null}
            <Button
              variant="primary"
              block
              loading={exporting}
              disabled={available === 0}
              onClick={() => void exportCollage()}
            >
              Render &amp; download collage
            </Button>
            {exportError ? (
              <Alert tone="danger" title="Collage export failed">
                {exportError.message} {exportError.hint}
              </Alert>
            ) : null}
            {result ? (
              <dl className="summary">
                <div className="summary__row">
                  <dt className="summary__label">File</dt>
                  <dd
                    className="summary__value"
                    style={{ maxWidth: "62%", overflow: "hidden", textOverflow: "ellipsis" }}
                  >
                    {result.name}
                  </dd>
                </div>
                <div className="summary__row">
                  <dt className="summary__label">Dimensions</dt>
                  <dd className="summary__value">
                    {result.width} × {result.height}
                  </dd>
                </div>
                <div className="summary__row">
                  <dt className="summary__label">Size</dt>
                  <dd className="summary__value">{formatBytes(result.size)}</dd>
                </div>
                <div className="summary__row">
                  <dt className="summary__label">Quality</dt>
                  <dd className="summary__value">{Math.round(result.quality * 100)}%</dd>
                </div>
              </dl>
            ) : null}
            {result ? (
              <Badge tone={result.targetMet === false ? "warn" : "ok"}>
                {result.targetMet === false ? "Best effort" : "Ready"}
              </Badge>
            ) : null}
            <p className="field__hint">
              {mode === "before-after"
                ? "The after image is rendered at full resolution through the current operation stack, then composed with the original."
                : mode === "contact-sheet"
                  ? "Every queue image is decoded in order and labelled with its file name."
                  : mode === "merge"
                    ? "Every queue image is stitched in queue order with the configured gap."
                    : "Each cell decodes and draws one source image in order. Processing stays on this device."}
            </p>
          </section>
        </div>
      }
    />
  );
}
