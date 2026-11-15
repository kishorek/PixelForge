import type { Operation } from "@pixelforge/image-contracts";
import { Check, Copy, Palette, Pipette } from "lucide-react";
import { type PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { OutputFooter } from "../../components/OutputFooter";
import { Workbench } from "../../components/Workbench";
import { Alert, Badge, Field, NumberField, SegmentedControl, Spinner } from "../../components/ui";
import { usePreview } from "../../hooks/usePreview";
import { safeOutputDimensions } from "../../lib/operations";
import { activeAssetOf, useSession } from "../../state/session";
import type { HistogramData } from "../../wasm/loader";
import { loadPixelforgeWasm } from "../../wasm/loader";
import {
  type PaletteColor,
  type SampleColor,
  type TransparencyStats,
  histogramFromPixels,
  paletteFromPixels,
  rgbToHsl,
  samplePixel,
  transparencyFromPixels,
} from "./analysis";

function ColourStage({
  previewUrl,
  busy,
  onAnalysis,
  onSample,
}: {
  previewUrl: string | null;
  busy: boolean;
  onAnalysis: (image: ImageData | null) => void;
  onSample: (sample: SampleColor | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageDataRef = useRef<ImageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const onAnalysisRef = useRef(onAnalysis);
  onAnalysisRef.current = onAnalysis;
  const onSampleRef = useRef(onSample);
  onSampleRef.current = onSample;

  useEffect(() => {
    imageDataRef.current = null;
    onAnalysisRef.current(null);
    onSampleRef.current(null);
    if (!previewUrl) return;

    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const maxEdge = 1200;
      const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) {
        setError("A canvas context could not be created.");
        return;
      }
      context.drawImage(image, 0, 0, width, height);
      const data = context.getImageData(0, 0, width, height);
      imageDataRef.current = data;
      setError(null);
      onAnalysisRef.current(data);
    };
    image.onerror = () => {
      if (!cancelled) setError("The preview image could not be loaded for analysis.");
    };
    image.src = previewUrl;

    return () => {
      cancelled = true;
      image.onload = null;
      image.onerror = null;
    };
  }, [previewUrl]);

  const handleMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const data = imageDataRef.current;
    if (!canvas || !data) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((event.clientX - rect.left) / rect.width) * canvas.width);
    const y = Math.floor(((event.clientY - rect.top) / rect.height) * canvas.height);
    onSampleRef.current(samplePixel(data.data, canvas.width, x, y));
  };

  return (
    <div className="stage colour-stage">
      {previewUrl ? (
        <div className="colour-stage__inner">
          <canvas
            ref={canvasRef}
            className="colour-canvas"
            role="img"
            aria-label="Colour analysis preview. Move the pointer over the image to sample a pixel."
            onPointerMove={handleMove}
            onPointerLeave={() => onSampleRef.current(null)}
          />
        </div>
      ) : (
        <div className="stage__empty">
          {busy ? <Spinner label="Rendering preview" /> : null}
          <strong>
            {error ? "Preview unavailable" : busy ? "Rendering preview…" : "No image selected"}
          </strong>
          <span>{error ?? "Add an image to inspect its colours."}</span>
        </div>
      )}
      {error && previewUrl ? (
        <div className="stage__alert">
          <Alert tone="danger" title="Analysis problem">
            {error}
          </Alert>
        </div>
      ) : null}
      <div className="stage__status" aria-live="polite">
        {previewUrl ? "Move over the image to sample · preview analysis" : "No preview"}
      </div>
    </div>
  );
}

function smoothValues(values: Uint32Array): Uint32Array {
  const result = new Uint32Array(values.length);
  for (let index = 0; index < values.length; index += 1) {
    let total = 0;
    let count = 0;
    for (let offset = -2; offset <= 2; offset += 1) {
      const sample = values[index + offset];
      if (sample === undefined) continue;
      total += sample;
      count += 1;
    }
    result[index] = count > 0 ? Math.round(total / count) : 0;
  }
  return result;
}

function channelPath(values: Uint32Array, maximum: number): { line: string; area: string } {
  const points: string[] = [];
  for (let index = 0; index < 256; index += 1) {
    const value = values[index] ?? 0;
    const height = maximum > 0 ? value / maximum : 0;
    const x = (index / 255) * 100;
    const y = 100 - height * 100;
    points.push(`${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`);
  }
  const line = points.join(" ");
  return { line, area: `M0,100 ${line.replace(/^M/, "L")} L100,100 Z` };
}

function HistogramPanel({ histogram }: { histogram: HistogramData | null }) {
  const [mode, setMode] = useState<"rgb" | "luma">("rgb");

  const channels = useMemo(() => {
    if (!histogram) return [];
    if (mode === "luma") {
      return [{ key: "luma", values: histogram.luma, colour: "var(--ink-2)" }];
    }
    return [
      { key: "r", values: histogram.r, colour: "#e0553a" },
      { key: "g", values: histogram.g, colour: "#3a9b6e" },
      { key: "b", values: histogram.b, colour: "#3f7ed6" },
    ];
  }, [histogram, mode]);

  const smoothedChannels = useMemo(
    () => channels.map((channel) => ({ ...channel, values: smoothValues(channel.values) })),
    [channels],
  );

  const maximum = useMemo(() => {
    let max = 0;
    for (const channel of smoothedChannels) {
      for (const value of channel.values) max = Math.max(max, value);
    }
    return max;
  }, [smoothedChannels]);

  return (
    <section className="inspector-section">
      <div className="spread">
        <h2 className="inspector-section__title">Histogram</h2>
        <SegmentedControl
          label="Histogram channel"
          value={mode}
          options={[
            { value: "rgb", label: "RGB" },
            { value: "luma", label: "Luma" },
          ]}
          onChange={(value) => setMode(value as "rgb" | "luma")}
        />
      </div>
      {histogram ? (
        <>
          <svg
            className="histogram-chart"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            role="img"
            aria-label={`${mode === "rgb" ? "RGB" : "Luminance"} histogram of the preview`}
          >
            {[25, 50, 75].map((position) => (
              <line
                key={position}
                x1="0"
                y1={position}
                x2="100"
                y2={position}
                className="histogram-grid"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {smoothedChannels.map((channel) => {
              const path = channelPath(channel.values, maximum);
              return (
                <g key={channel.key}>
                  <path
                    d={path.area}
                    fill={channel.colour}
                    opacity={mode === "rgb" ? 0.16 : 0.24}
                  />
                  <path
                    d={path.line}
                    fill="none"
                    stroke={channel.colour}
                    strokeWidth={1.2}
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              );
            })}
          </svg>
          <div className="histogram-axis mono">
            <span>0</span>
            <span>128</span>
            <span>255</span>
          </div>
          <p className="field__hint">Computed from the processed preview by the WASM histogram.</p>
        </>
      ) : (
        <p className="field__hint">Waiting for a preview to analyse.</p>
      )}
    </section>
  );
}

function PalettePanel({ palette }: { palette: PaletteColor[] }) {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (hex: string) => {
    void navigator.clipboard?.writeText(hex).catch(() => {});
    setCopied(hex);
    window.setTimeout(() => setCopied((current) => (current === hex ? null : current)), 1400);
  };

  return (
    <section className="inspector-section">
      <h2 className="inspector-section__title">Dominant palette</h2>
      {palette.length === 0 ? (
        <p className="field__hint">No colours available yet.</p>
      ) : (
        <div className="palette-grid">
          {palette.map((colour) => (
            <button
              key={colour.hex}
              type="button"
              className="palette-swatch"
              onClick={() => copy(colour.hex)}
              aria-label={`Copy ${colour.hex}`}
            >
              <span className="palette-swatch__chip" style={{ background: colour.hex }} />
              <span className="palette-swatch__hex mono">{colour.hex}</span>
              <span className="palette-swatch__share">{Math.round(colour.share * 100)}%</span>
              {copied === colour.hex ? (
                <Check size={12} aria-hidden="true" />
              ) : (
                <Copy size={12} aria-hidden="true" />
              )}
            </button>
          ))}
        </div>
      )}
      <p className="field__hint">Click a swatch to copy its hex value.</p>
    </section>
  );
}

function TransparencyPanel({ stats }: { stats: TransparencyStats | null }) {
  return (
    <section className="inspector-section">
      <h2 className="inspector-section__title">Transparency</h2>
      {stats ? (
        <>
          <div className="row">
            <span className="checker-chip" aria-hidden="true" />
            <Badge tone={stats.maxAlpha < 255 ? "warn" : "ok"}>
              {stats.maxAlpha < 255 ? "Alpha channel present" : "Fully opaque"}
            </Badge>
          </div>
          <dl className="summary">
            <div className="summary__row">
              <dt className="summary__label">Fully transparent</dt>
              <dd className="summary__value">{Math.round(stats.transparentFraction * 100)}%</dd>
            </div>
            <div className="summary__row">
              <dt className="summary__label">Partial alpha</dt>
              <dd className="summary__value">{Math.round(stats.partialFraction * 100)}%</dd>
            </div>
            <div className="summary__row">
              <dt className="summary__label">Opaque</dt>
              <dd className="summary__value">{Math.round(stats.opaqueFraction * 100)}%</dd>
            </div>
            <div className="summary__row">
              <dt className="summary__label">Alpha range</dt>
              <dd className="summary__value">
                {stats.minAlpha}–{stats.maxAlpha}
              </dd>
            </div>
            <div className="summary__row">
              <dt className="summary__label">Content bounds</dt>
              <dd className="summary__value">
                {stats.bounds
                  ? `${stats.bounds.width} × ${stats.bounds.height} at ${stats.bounds.x}, ${stats.bounds.y}`
                  : "Empty"}
              </dd>
            </div>
          </dl>
        </>
      ) : (
        <p className="field__hint">Waiting for a preview to analyse alpha.</p>
      )}
    </section>
  );
}

function PixelPanel({
  analysis,
  sample,
  onSampleAt,
}: {
  analysis: ImageData | null;
  sample: SampleColor | null;
  onSampleAt: (x: number, y: number) => void;
}) {
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const [copied, setCopied] = useState(false);
  const onSampleAtRef = useRef(onSampleAt);
  onSampleAtRef.current = onSampleAt;

  useEffect(() => {
    if (!analysis) return;
    const centreX = Math.floor(analysis.width / 2);
    const centreY = Math.floor(analysis.height / 2);
    setX(centreX);
    setY(centreY);
    onSampleAtRef.current(centreX, centreY);
  }, [analysis]);

  const hsl = sample ? rgbToHsl(sample.r, sample.g, sample.b) : null;

  return (
    <section className="inspector-section">
      <h2 className="inspector-section__title">Pixel inspector</h2>
      {sample ? (
        <>
          <div className="pixel-readout">
            <span
              className="pixel-swatch"
              style={{
                background: `rgba(${sample.r}, ${sample.g}, ${sample.b}, ${sample.a / 255})`,
              }}
              aria-hidden="true"
            />
            <div className="stack" style={{ gap: 2 }}>
              <span className="pixel-value mono">{sample.hex.toUpperCase()}</span>
              <span className="field__hint mono">
                RGB {sample.r}, {sample.g}, {sample.b} · A {sample.a}
              </span>
              <span className="field__hint mono">
                HSL {hsl?.h}°, {hsl?.s}%, {hsl?.l}%
              </span>
            </div>
          </div>
          <button
            type="button"
            className="btn btn--sm"
            onClick={() => {
              void navigator.clipboard?.writeText(sample.hex).catch(() => {});
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1400);
            }}
          >
            {copied ? (
              <Check size={14} aria-hidden="true" />
            ) : (
              <Copy size={14} aria-hidden="true" />
            )}
            {copied ? "Copied" : "Copy hex"}
          </button>
        </>
      ) : (
        <p className="field__hint">
          Move over the preview, or enter coordinates below, to inspect a pixel.
        </p>
      )}
      {analysis ? (
        <div className="row" style={{ alignItems: "flex-end" }}>
          <NumberField
            id="colour-sample-x"
            label="Sample X"
            value={x}
            min={0}
            max={analysis.width - 1}
            onChange={(value) => {
              setX(value);
              onSampleAt(value, y);
            }}
          />
          <NumberField
            id="colour-sample-y"
            label="Sample Y"
            value={y}
            min={0}
            max={analysis.height - 1}
            onChange={(value) => {
              setY(value);
              onSampleAt(x, value);
            }}
          />
        </div>
      ) : null}
      <p className="field__hint">
        Values are sampled from the processed preview at analysis resolution.
      </p>
    </section>
  );
}

const EMPTY_OPERATIONS: Operation[] = [];

export function ColourPage() {
  const asset = useSession(activeAssetOf);
  const operations = useSession((state) =>
    state.activeId
      ? (state.operationsByAsset[state.activeId] ?? EMPTY_OPERATIONS)
      : EMPTY_OPERATIONS,
  );
  const watermarkImage = useSession((state) => state.watermarkImage);
  const preview = usePreview(asset, operations, watermarkImage);
  const [analysis, setAnalysis] = useState<ImageData | null>(null);
  const [sample, setSample] = useState<SampleColor | null>(null);
  const [histogram, setHistogram] = useState<HistogramData | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const handleAnalysis = (image: ImageData | null) => {
    setAnalysis(image);
    setSample(null);
    setHistogram(null);
    setAnalysisError(null);
    if (!image) return;
    const pixels = new Uint8Array(image.data.buffer, image.data.byteOffset, image.data.byteLength);
    setHistogram(histogramFromPixels(pixels, image.width, image.height));
    loadPixelforgeWasm()
      .then((wasm) => setHistogram(wasm.histogram(pixels, image.width, image.height)))
      .catch((error: unknown) =>
        setAnalysisError(error instanceof Error ? error.message : "WASM histogram failed."),
      );
  };

  const palette = useMemo(
    () => (analysis ? paletteFromPixels(analysis.data, analysis.width, analysis.height) : []),
    [analysis],
  );

  const transparency = useMemo(
    () =>
      analysis ? transparencyFromPixels(analysis.data, analysis.width, analysis.height) : null,
    [analysis],
  );

  const sampleAt = (x: number, y: number) => {
    if (!analysis) return;
    setSample(samplePixel(analysis.data, analysis.width, x, y));
  };

  const dimensions = asset ? safeOutputDimensions(asset, operations) : null;

  return (
    <Workbench
      title="Colour"
      description="Inspect pixels, histograms and dominant colours in the processed preview."
      stage={
        <ColourStage
          previewUrl={preview.url}
          busy={preview.busy}
          onAnalysis={handleAnalysis}
          onSample={setSample}
        />
      }
      canvasbarExtra={
        analysis ? (
          <span className="mono muted">
            {analysis.width}×{analysis.height} analysis
          </span>
        ) : null
      }
      footer={<OutputFooter asset={asset} dimensions={dimensions} />}
      inspector={
        <div className="inspector-scroll">
          <section className="inspector-section">
            <span className="eyebrow">Inspect</span>
            <h2 className="inspector-title">Read the pixels</h2>
            <p className="field__hint">
              Analysis uses the current operation pipeline at preview resolution. Export output is
              rendered at full resolution.
            </p>
            <div className="row">
              <Badge>
                <Pipette size={12} aria-hidden="true" /> {sample ? "Sampling" : "Move to sample"}
              </Badge>
              <Badge>
                <Palette size={12} aria-hidden="true" /> {palette.length} colours
              </Badge>
            </div>
            {analysisError ? (
              <Alert tone="warn" title="Histogram fallback">
                {analysisError} The JavaScript fallback was used.
              </Alert>
            ) : null}
          </section>

          <HistogramPanel histogram={histogram} />
          <PalettePanel palette={palette} />
          <TransparencyPanel stats={transparency} />
          <PixelPanel analysis={analysis} sample={sample} onSampleAt={sampleAt} />

          <section className="inspector-section">
            <Field label="Privacy" hint="Sampling and histogram analysis happen on this device.">
              <span className="badge badge--ok">Local processing</span>
            </Field>
          </section>
        </div>
      }
    />
  );
}
