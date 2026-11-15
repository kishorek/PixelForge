import { downloadBlob } from "@pixelforge/browser-image-io";
import { FORMATS, type PixelForgeError } from "@pixelforge/image-contracts";
import type {
  Dimensions,
  ExportSettings,
  ImageFormat,
  Operation,
} from "@pixelforge/image-contracts";
import {
  assertValidOperations,
  formatBytes,
  formatFilename,
  outputDimensions,
} from "@pixelforge/operation-model";
import { Download } from "lucide-react";
import { useMemo, useState } from "react";
import { useCapabilities } from "../app/capabilities";
import { asPixelForgeError, newId } from "../lib/errors";
import { type SessionAsset, type WatermarkImage, useSession } from "../state/session";
import { imageProcessor } from "../workers/client";
import {
  Alert,
  Badge,
  Button,
  ColorField,
  Field,
  NumberField,
  ProgressBar,
  RangeField,
  SelectField,
  TextField,
} from "./ui";

interface RenderedOutput {
  key: string;
  blob: Blob;
  filename: string;
  size: number;
  width: number;
  height: number;
  format: ImageFormat;
  quality: number;
  targetMet: boolean | null;
}

export function ExportSettingsFields() {
  const capabilities = useCapabilities();
  const exportSettings = useSession((state) => state.exportSettings);
  const setExport = useSession((state) => state.setExport);
  const format = exportSettings.format;
  const lossy = FORMATS[format].lossy;
  const isPng = format === "png";
  const update = (patch: Partial<ExportSettings>) => setExport(patch);

  const formatOptions = (["webp", "jpeg", "png", "avif"] as ImageFormat[]).map((candidate) => {
    const supported = capabilities?.encode[candidate] ?? true;
    const info = FORMATS[candidate];
    return {
      value: candidate,
      label: `${info.label} — ${info.lossy ? "lossy" : "lossless"}${info.alpha ? ", alpha" : ""}${supported ? "" : " (unsupported)"}`,
      disabled: !supported,
    };
  });

  return (
    <section className="inspector-section">
      <h2 className="inspector-section__title">Output</h2>

      <SelectField
        id="export-format"
        label="Format"
        value={format}
        options={formatOptions}
        onChange={(value) => update({ format: value })}
        hint={
          capabilities
            ? "Unsupported formats are disabled for this browser."
            : "Checking which encoders this browser supports…"
        }
      />

      {lossy ? (
        <RangeField
          id="export-quality"
          label="Quality"
          value={Math.round(exportSettings.quality * 100)}
          min={30}
          max={100}
          format={(value) => `${value}%`}
          onChange={(value) => update({ quality: value / 100 })}
          hint="Lower quality reduces file size."
        />
      ) : null}

      <NumberField
        id="export-target"
        label="Target size"
        value={
          exportSettings.targetSizeBytes ? Math.round(exportSettings.targetSizeBytes / 1024) : 0
        }
        min={0}
        max={200000}
        suffix="KB"
        onChange={(value) =>
          update({ targetSizeBytes: value > 0 ? Math.round(value * 1024) : null })
        }
        hint={
          isPng
            ? "PNG is lossless; a target size is best-effort only."
            : "Set 0 for no target. Compression is best-effort."
        }
      />

      {format === "jpeg" ? (
        <ColorField
          id="export-background"
          label="Transparency background"
          value={exportSettings.background}
          onChange={(background) => update({ background })}
          hint="JPEG has no alpha channel, so transparent areas are flattened."
        />
      ) : null}

      <TextField
        id="export-filename"
        label="File name template"
        value={exportSettings.filenameTemplate}
        onChange={(filenameTemplate) => update({ filenameTemplate })}
        mono
        hint={
          <>
            Tokens: <code>{"{name}"}</code> <code>{"{width}"}</code> <code>{"{height}"}</code>{" "}
            <code>{"{format}"}</code> <code>{"{index}"}</code>
          </>
        }
      />
    </section>
  );
}

export function ExportPanel({
  asset,
  operations,
  watermarkImage,
}: {
  asset: SessionAsset | null;
  operations: Operation[];
  watermarkImage: WatermarkImage | null;
}) {
  const exportSettings = useSession((state) => state.exportSettings);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("");
  const [result, setResult] = useState<RenderedOutput | null>(null);
  const [error, setError] = useState<PixelForgeError | null>(null);

  const format = exportSettings.format;

  const settingsKey = useMemo(
    () =>
      JSON.stringify({
        asset: asset?.id ?? null,
        operations,
        export: exportSettings,
        watermark: watermarkImage?.url ?? null,
      }),
    [asset?.id, operations, exportSettings, watermarkImage?.url],
  );

  const dimensions = useMemo<Dimensions | null>(() => {
    if (!asset) return null;
    try {
      return outputDimensions({ width: asset.width, height: asset.height }, operations);
    } catch {
      return null;
    }
  }, [asset, operations]);

  const filenamePreview =
    asset && dimensions
      ? formatFilename(exportSettings.filenameTemplate, {
          name: asset.name,
          width: dimensions.width,
          height: dimensions.height,
          format,
          index: 1,
        })
      : "—";

  const render = async (download: boolean) => {
    if (!asset) return;
    try {
      assertValidOperations(operations);
    } catch (validationError) {
      setError(asPixelForgeError(validationError));
      return;
    }

    setRunning(true);
    setError(null);
    setProgress(0);
    try {
      const output = await imageProcessor.process(
        {
          jobId: newId("export"),
          source: {
            blob: asset.blob,
            name: asset.name,
            width: asset.width,
            height: asset.height,
            mimeType: asset.mimeType,
          },
          operations: operations.map((operation) => structuredClone(operation)),
          export: exportSettings,
          watermarkImage: watermarkImage?.blob ?? null,
        },
        (update) => {
          setProgress(update.progress);
          setStage(update.stage);
        },
      );
      const filename = formatFilename(exportSettings.filenameTemplate, {
        name: asset.name,
        width: output.width,
        height: output.height,
        format: exportSettings.format,
        index: 1,
      });
      const rendered: RenderedOutput = {
        key: settingsKey,
        blob: output.blob,
        filename,
        size: output.blob.size,
        width: output.width,
        height: output.height,
        format: output.format,
        quality: output.quality,
        targetMet: output.targetMet,
      };
      setResult(rendered);
      if (download) downloadBlob(output.blob, filename);
    } catch (renderError) {
      const pixelError = asPixelForgeError(renderError);
      if (pixelError.code !== "CANCELLED") setError(pixelError);
    } finally {
      setRunning(false);
    }
  };

  const validResult = result && result.key === settingsKey ? result : null;

  const reduction =
    validResult && asset && asset.size > 0
      ? Math.round(((asset.size - validResult.size) / asset.size) * 100)
      : null;

  return (
    <>
      <ExportSettingsFields />

      <section className="inspector-section">
        <h2 className="inspector-section__title">Summary</h2>
        <dl className="summary">
          <div className="summary__row">
            <dt className="summary__label">Original</dt>
            <dd className="summary__value">{asset ? formatBytes(asset.size) : "—"}</dd>
          </div>
          <div className="summary__row">
            <dt className="summary__label">Output size</dt>
            <dd className="summary__value">
              {dimensions ? `${dimensions.width} × ${dimensions.height}` : "—"}
            </dd>
          </div>
          <div className="summary__row">
            <dt className="summary__label">File</dt>
            <dd
              className="summary__value"
              style={{ maxWidth: "60%", overflow: "hidden", textOverflow: "ellipsis" }}
            >
              {filenamePreview}
            </dd>
          </div>
          {validResult ? (
            <>
              <div className="summary__row">
                <dt className="summary__label">Encoded size</dt>
                <dd className="summary__value">{formatBytes(validResult.size)}</dd>
              </div>
              <div className="summary__row">
                <dt className="summary__label">Difference</dt>
                <dd className="summary__value">
                  {reduction === null
                    ? "—"
                    : reduction >= 0
                      ? `−${reduction}%`
                      : `+${Math.abs(reduction)}%`}
                </dd>
              </div>
              <div className="summary__row">
                <dt className="summary__label">Quality used</dt>
                <dd className="summary__value">{Math.round(validResult.quality * 100)}%</dd>
              </div>
            </>
          ) : null}
        </dl>

        {validResult?.targetMet === true ? <Badge tone="ok">Target size met</Badge> : null}
        {validResult?.targetMet === false ? (
          <Alert tone="warn" title="Target not met">
            The image could not reach the requested size without changing the format or dimensions.
            The smallest best-effort result was kept.
          </Alert>
        ) : null}

        {running ? (
          <div className="stack" style={{ gap: 6 }}>
            <ProgressBar value={Math.round(progress * 100)} label="Rendering output" />
            <span className="field__hint">
              Rendering full-resolution output{stage ? ` · ${stage}` : ""}…
            </span>
          </div>
        ) : null}

        {error ? (
          <Alert tone="danger" title="Export failed">
            {error.message} {error.hint}
          </Alert>
        ) : null}

        <Button
          variant="primary"
          block
          loading={running}
          icon={<Download size={16} aria-hidden="true" />}
          disabled={!asset}
          onClick={() => void render(true)}
        >
          Render &amp; download
        </Button>
        <div className="row">
          <Button size="sm" disabled={!asset || running} onClick={() => void render(false)}>
            Check size
          </Button>
          {running ? (
            <Button size="sm" variant="ghost" onClick={() => imageProcessor.cancelAll()}>
              Cancel
            </Button>
          ) : null}
          {validResult ? (
            <Button size="sm" onClick={() => downloadBlob(validResult.blob, validResult.filename)}>
              Download again
            </Button>
          ) : null}
        </div>
        <Field
          label="Privacy"
          hint="Rendering happens in a worker on this device. Nothing is uploaded."
        >
          <span className="badge badge--ok">Local processing</span>
        </Field>
      </section>
    </>
  );
}
