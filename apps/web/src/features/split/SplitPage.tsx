import { downloadBlob, zipFiles } from "@pixelforge/browser-image-io";
import { FORMATS } from "@pixelforge/image-contracts";
import { formatBytes } from "@pixelforge/operation-model";
import { Download, FileArchive, Scissors } from "lucide-react";
import { useState } from "react";
import { ExportSettingsFields } from "../../components/ExportPanel";
import { Workbench } from "../../components/Workbench";
import { Alert, Badge, Button, NumberField, Spinner } from "../../components/ui";
import { usePreview } from "../../hooks/usePreview";
import { asPixelForgeError, newId } from "../../lib/errors";
import type { SplitResult } from "../../processing/split";
import { activeAssetOf, useSession } from "../../state/session";
import { imageProcessor } from "../../workers/client";
import { splitProcessor } from "../../workers/splitClient";

export function SplitPage() {
  const asset = useSession(activeAssetOf);
  const operations = useSession((state) =>
    state.activeId ? (state.operationsByAsset[state.activeId] ?? []) : [],
  );
  const watermarkImage = useSession((state) => state.watermarkImage);
  const exportSettings = useSession((state) => state.exportSettings);
  const preview = usePreview(asset, operations, watermarkImage);

  const [rows, setRows] = useState(2);
  const [columns, setColumns] = useState(2);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<ReturnType<typeof asPixelForgeError> | null>(null);
  const [result, setResult] = useState<SplitResult | null>(null);

  const hasEdits = operations.some((operation) => operation.enabled) || watermarkImage !== null;

  const splitImage = async () => {
    if (!asset || running) return;
    setRunning(true);
    setError(null);
    try {
      let source = asset.blob;
      if (hasEdits) {
        const processed = await imageProcessor.process({
          jobId: newId("split-source"),
          source: {
            blob: asset.blob,
            name: asset.name,
            width: asset.width,
            height: asset.height,
            mimeType: asset.mimeType,
          },
          operations: operations.map((operation) => structuredClone(operation)),
          export: { ...exportSettings, format: "png", quality: 1, targetSizeBytes: null },
          watermarkImage: watermarkImage?.blob ?? null,
        });
        source = processed.blob;
      }

      const split = await splitProcessor.split({
        source,
        rows,
        columns,
        format: exportSettings.format,
        quality: exportSettings.quality,
        filenameTemplate: exportSettings.filenameTemplate,
        baseName: asset.name,
      });
      setResult(split);
      const archive = await zipFiles(
        split.files.map((file) => ({ name: file.name, blob: file.blob })),
      );
      downloadBlob(archive, "pixelforge-split.zip");
    } catch (splitError) {
      setError(asPixelForgeError(splitError));
    } finally {
      setRunning(false);
    }
  };

  const totalBytes = result?.files.reduce((total, file) => total + file.blob.size, 0) ?? 0;
  const source = preview.url ?? asset?.previewUrl ?? null;
  const expectedWidth = asset && !hasEdits ? asset.width : null;
  const expectedHeight = asset && !hasEdits ? asset.height : null;
  const tileWidth = expectedWidth ? Math.floor(expectedWidth / columns) : null;
  const tileHeight = expectedHeight ? Math.floor(expectedHeight / rows) : null;

  return (
    <Workbench
      title="Split"
      description="Slice an image into a grid of tiles and download a ZIP."
      stage={
        <div className="stage">
          {source ? (
            <div className="split-frame">
              <img className="stage__image" src={source} alt="Split preview" />
              <div
                className="split-overlay"
                style={{
                  gridTemplateColumns: `repeat(${columns}, 1fr)`,
                  gridTemplateRows: `repeat(${rows}, 1fr)`,
                }}
                aria-hidden="true"
              >
                {Array.from({ length: rows * columns }, (_, index) => (
                  <span
                    className="split-cell"
                    key={`r${Math.floor(index / columns)}c${index % columns}`}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="stage__empty">
              {preview.busy ? <Spinner label="Rendering preview" /> : null}
              <strong>Add an image to split</strong>
              <span>Import an image, choose rows and columns, then split.</span>
            </div>
          )}
          <div className="stage__status" aria-live="polite">
            {preview.busy ? "Rendering preview…" : `${rows} × ${columns} tiles`}
          </div>
        </div>
      }
      canvasbarExtra={
        <span className="mono muted">
          {rows} × {columns} · {FORMATS[exportSettings.format].label}
        </span>
      }
      footer={
        <>
          <div className="workbench__footer-info">
            <span className="muted">Split output</span>
            <strong>
              {rows * columns} tiles · {FORMATS[exportSettings.format].label}
            </strong>
            <span className="muted">
              {result
                ? `${formatBytes(totalBytes)} across ${result.files.length} files`
                : tileWidth && tileHeight
                  ? `Approx. ${tileWidth} × ${tileHeight} px per tile`
                  : "Tiles follow the processed image size"}
            </span>
          </div>
          <div className="row">
            <Button
              variant="primary"
              icon={<Scissors size={15} aria-hidden="true" />}
              loading={running}
              disabled={!asset}
              onClick={() => void splitImage()}
            >
              Split &amp; download ZIP
            </Button>
          </div>
        </>
      }
      inspector={
        <div className="inspector-scroll">
          <section className="inspector-section">
            <span className="eyebrow">Compose</span>
            <h2 className="inspector-title">Slice into tiles</h2>
            <p className="field__hint">
              The processed image is divided into equal grid cells. The last row and column may be
              slightly smaller when dimensions do not divide evenly.
            </p>
            <div className="row">
              <Badge>
                <Scissors size={12} aria-hidden="true" /> {rows * columns} tiles
              </Badge>
              {result ? <Badge tone="ok">{formatBytes(totalBytes)}</Badge> : null}
            </div>
          </section>

          <section className="inspector-section">
            <h2 className="inspector-section__title">Grid</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
              <NumberField
                id="split-rows"
                label="Rows"
                value={rows}
                min={1}
                max={10}
                onChange={(value) => setRows(Math.max(1, Math.min(10, Math.round(value))))}
              />
              <NumberField
                id="split-columns"
                label="Columns"
                value={columns}
                min={1}
                max={10}
                onChange={(value) => setColumns(Math.max(1, Math.min(10, Math.round(value))))}
              />
            </div>
            <p className="field__hint">
              {tileWidth && tileHeight
                ? `Approximately ${tileWidth} × ${tileHeight} px per tile.`
                : "Tile size is based on the processed source image."}
            </p>
          </section>

          <ExportSettingsFields />

          <section className="inspector-section">
            <h2 className="inspector-section__title">Export</h2>
            <p className="field__hint">
              The target-size field is ignored for split tiles; each tile uses the selected quality.
              The filename template supports {"{row}"} and {"{column}"} tokens.
            </p>
            <Button
              variant="primary"
              block
              loading={running}
              disabled={!asset}
              onClick={() => void splitImage()}
            >
              Split &amp; download ZIP
            </Button>
            {error ? (
              <Alert tone="danger" title="Split failed">
                {error.message} {error.hint}
              </Alert>
            ) : null}
            {result ? (
              <dl className="summary">
                <div className="summary__row">
                  <dt className="summary__label">Source size</dt>
                  <dd className="summary__value">
                    {result.width} × {result.height}
                  </dd>
                </div>
                <div className="summary__row">
                  <dt className="summary__label">Tiles</dt>
                  <dd className="summary__value">
                    {result.rows} × {result.columns} = {result.files.length}
                  </dd>
                </div>
                <div className="summary__row">
                  <dt className="summary__label">Total size</dt>
                  <dd className="summary__value">{formatBytes(totalBytes)}</dd>
                </div>
              </dl>
            ) : null}
            {result ? (
              <Button
                size="sm"
                icon={<FileArchive size={14} aria-hidden="true" />}
                onClick={async () => {
                  try {
                    const archive = await zipFiles(
                      result.files.map((file) => ({ name: file.name, blob: file.blob })),
                    );
                    downloadBlob(archive, "pixelforge-split.zip");
                  } catch (zipError) {
                    setError(asPixelForgeError(zipError));
                  }
                }}
              >
                Download ZIP again
              </Button>
            ) : null}
          </section>

          {result ? (
            <section className="inspector-section">
              <h2 className="inspector-section__title">Tiles</h2>
              <div className="output-list">
                {result.files.map((file) => (
                  <div className="output-item" key={file.name}>
                    <div>
                      <div className="output-item__name" title={file.name}>
                        {file.name}
                      </div>
                      <div className="output-item__meta">
                        r{file.row} c{file.column} · {file.width}×{file.height} ·{" "}
                        {formatBytes(file.blob.size)}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      icon={<Download size={14} aria-hidden="true" />}
                      onClick={() => downloadBlob(file.blob, file.name)}
                    >
                      Download
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      }
    />
  );
}
