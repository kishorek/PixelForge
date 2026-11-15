import { downloadBlob, zipFiles } from "@pixelforge/browser-image-io";
import { FORMATS } from "@pixelforge/image-contracts";
import type { Operation } from "@pixelforge/image-contracts";
import {
  assertValidOperations,
  buildOutputNames,
  describeOperation,
  formatBytes,
  operationLabel,
  outputDimensions,
} from "@pixelforge/operation-model";
import { Download, FileArchive, Play } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { ExportSettingsFields } from "../../components/ExportPanel";
import { OperationFields } from "../../components/OperationFields";
import { AddOperationMenu } from "../../components/OperationStack";
import { PreviewStage } from "../../components/PreviewStage";
import { Workbench } from "../../components/Workbench";
import { Alert, Badge, Button, ProgressBar } from "../../components/ui";
import { usePreview } from "../../hooks/usePreview";
import { asPixelForgeError, newId } from "../../lib/errors";
import { safeOutputDimensions, sourceDimensionsFor } from "../../lib/operations";
import { activeAssetOf, useSession } from "../../state/session";
import { imageProcessor } from "../../workers/client";

type BatchStatus = "queued" | "processing" | "done" | "error";

interface BatchOutput {
  assetId: string;
  name: string;
  blob: Blob;
  size: number;
  width: number;
  height: number;
}

function BatchRecipe({
  operations,
  source,
  selectedId,
  onSelect,
  onChange,
}: {
  operations: Operation[];
  source: { width: number; height: number };
  selectedId: string | null;
  onSelect: (id: string) => void;
  onChange: (operations: Operation[]) => void;
}) {
  return (
    <div className="stack">
      <div className="row row--between">
        <span className="field__label">Batch recipe</span>
        <AddOperationMenu
          source={source}
          onAdd={(operation) => onChange([...operations, operation])}
        />
      </div>
      {operations.length === 0 ? (
        <p className="field__hint">
          No operations yet. The batch will only convert or compress according to the output
          settings.
        </p>
      ) : (
        <ol className="op-list">
          {operations.map((operation, index) => (
            <li
              key={operation.id}
              className="op-item"
              aria-current={selectedId === operation.id ? "true" : undefined}
            >
              <span className="op-item__index">{index + 1}</span>
              <button
                type="button"
                className="op-item__text"
                style={{ border: 0, background: "transparent", padding: 0, textAlign: "left" }}
                aria-current={selectedId === operation.id ? "true" : undefined}
                onClick={() => onSelect(operation.id)}
              >
                <span className="op-item__label">{operationLabel(operation)}</span>
                <span className="op-item__detail">{describeOperation(operation)}</span>
              </button>
              <div className="op-item__actions" style={{ opacity: 1 }}>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onChange(operations.filter((item) => item.id !== operation.id))}
                >
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function BatchStudio() {
  const assets = useSession((state) => state.assets);
  const activeAsset = useSession(activeAssetOf);
  const batchOperations = useSession((state) => state.batchOperations);
  const setBatchOperations = useSession((state) => state.setBatchOperations);
  const exportSettings = useSession((state) => state.exportSettings);
  const watermarkImage = useSession((state) => state.watermarkImage);

  const [statuses, setStatuses] = useState<Record<string, BatchStatus>>({});
  const [outputs, setOutputs] = useState<BatchOutput[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<ReturnType<typeof asPixelForgeError> | null>(null);
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const stopRef = useRef(false);

  const preview = usePreview(activeAsset, batchOperations, watermarkImage);
  const dimensions = useMemo(
    () => (activeAsset ? safeOutputDimensions(activeAsset, batchOperations) : null),
    [activeAsset, batchOperations],
  );

  useEffect(() => {
    if (!selectedId || !batchOperations.some((operation) => operation.id === selectedId)) {
      setSelectedId(batchOperations[0]?.id ?? null);
    }
  }, [batchOperations, selectedId]);

  const recipeKey = useMemo(
    () =>
      JSON.stringify({
        operations: batchOperations,
        export: exportSettings,
        watermark: watermarkImage?.url ?? null,
      }),
    [batchOperations, exportSettings, watermarkImage?.url],
  );

  const runningRef = useRef(running);
  runningRef.current = running;

  useEffect(
    () => () => {
      stopRef.current = true;
    },
    [],
  );
  const lastRecipeKeyRef = useRef(recipeKey);

  useEffect(() => {
    if (runningRef.current) return;
    if (lastRecipeKeyRef.current === recipeKey) return;
    lastRecipeKeyRef.current = recipeKey;
    setOutputs([]);
    setStatuses({});
    setErrors({});
  }, [recipeKey]);

  const selectedOperation =
    batchOperations.find((operation) => operation.id === selectedId) ?? batchOperations[0] ?? null;

  const queueStatus = useMemo(() => {
    const map: Record<string, ReactNode> = {};
    for (const asset of assets) {
      const status = statuses[asset.id];
      if (!status) continue;
      map[asset.id] =
        status === "processing" ? (
          <Badge tone="accent">Processing</Badge>
        ) : status === "done" ? (
          <Badge tone="ok">Done</Badge>
        ) : status === "error" ? (
          <Badge tone="danger">Failed</Badge>
        ) : (
          <Badge>Queued</Badge>
        );
    }
    return map;
  }, [assets, statuses]);

  const totalBytes = outputs.reduce((total, output) => total + output.size, 0);
  const failed = Object.keys(errors).length;

  const processAll = async () => {
    if (assets.length === 0 || running) return;
    try {
      assertValidOperations(batchOperations);
    } catch (validationError) {
      setError(asPixelForgeError(validationError));
      return;
    }

    let names: string[];
    try {
      names = buildOutputNames(
        assets.map((asset, index) => {
          const target = outputDimensions(
            { width: asset.width, height: asset.height },
            batchOperations,
          );
          return {
            name: asset.name,
            width: target.width,
            height: target.height,
            format: exportSettings.format,
            index: index + 1,
          };
        }),
        exportSettings.filenameTemplate,
      );
    } catch (nameError) {
      setError(asPixelForgeError(nameError));
      return;
    }

    const queued: Record<string, BatchStatus> = {};
    for (const asset of assets) queued[asset.id] = "queued";
    setStatuses(queued);
    setOutputs([]);
    setErrors({});
    setError(null);
    setCompleted(0);
    setRunning(true);
    stopRef.current = false;

    const collected: BatchOutput[] = [];
    for (let index = 0; index < assets.length; index += 1) {
      if (stopRef.current) break;
      const asset = assets[index];
      if (!asset) continue;
      setStatuses((current) => ({ ...current, [asset.id]: "processing" }));
      try {
        const result = await imageProcessor.process({
          jobId: newId("batch"),
          source: {
            blob: asset.blob,
            name: asset.name,
            width: asset.width,
            height: asset.height,
            mimeType: asset.mimeType,
          },
          operations: batchOperations.map((operation) => structuredClone(operation)),
          export: exportSettings,
          watermarkImage: watermarkImage?.blob ?? null,
        });
        const output: BatchOutput = {
          assetId: asset.id,
          name: names[index] ?? asset.name,
          blob: result.blob,
          size: result.blob.size,
          width: result.width,
          height: result.height,
        };
        collected.push(output);
        setOutputs([...collected]);
        setStatuses((current) => ({ ...current, [asset.id]: "done" }));
      } catch (processError) {
        const pixelError = asPixelForgeError(processError);
        setStatuses((current) => ({ ...current, [asset.id]: "error" }));
        if (pixelError.code !== "CANCELLED") {
          setErrors((current) => ({ ...current, [asset.id]: pixelError.message }));
        }
      }
      setCompleted(index + 1);
    }

    setRunning(false);
  };

  const cancel = () => {
    stopRef.current = true;
    imageProcessor.cancelAll();
  };

  const downloadZip = async () => {
    if (outputs.length === 0) return;
    try {
      const archive = await zipFiles(
        outputs.map((output) => ({ name: output.name, blob: output.blob })),
      );
      downloadBlob(archive, "pixelforge-batch.zip");
    } catch (zipError) {
      setError(asPixelForgeError(zipError));
    }
  };

  return (
    <Workbench
      title="Batch Studio"
      description="Apply one recipe to a queue, then download individually or as a ZIP."
      queueStatus={queueStatus}
      stage={
        <PreviewStage
          asset={activeAsset}
          preview={preview}
          emptyTitle="Add images for the batch"
          emptyHint="The batch recipe is previewed on the selected image. Processing runs sequentially."
        />
      }
      canvasbarExtra={
        <span className="mono muted">
          {FORMATS[exportSettings.format].label} · {outputs.length} output
          {outputs.length === 1 ? "" : "s"}
        </span>
      }
      footer={
        <>
          <div className="workbench__footer-info">
            <span className="muted">Batch progress</span>
            <strong>
              {completed}/{assets.length} processed · {formatBytes(totalBytes)}
            </strong>
            <span className="muted">
              {outputs.length} succeeded{failed > 0 ? ` · ${failed} failed` : ""}
            </span>
          </div>
          <div className="row">
            <Button
              variant="primary"
              icon={<Play size={15} aria-hidden="true" />}
              loading={running}
              disabled={assets.length === 0}
              onClick={() => void processAll()}
            >
              Process all
            </Button>
            {running ? <Button onClick={cancel}>Cancel</Button> : null}
            <Button
              icon={<FileArchive size={15} aria-hidden="true" />}
              disabled={outputs.length === 0 || running}
              onClick={() => void downloadZip()}
            >
              Download ZIP
            </Button>
          </div>
        </>
      }
      inspector={
        <div className="inspector-scroll">
          <section className="inspector-section">
            <span className="eyebrow">Batch Studio</span>
            <h2 className="inspector-title">One recipe, many images</h2>
            <p className="field__hint">
              Operations run in order for every valid image. One failure does not discard the
              successful outputs.
            </p>
            <dl className="batch-summary">
              <div>
                <dt>Images</dt>
                <dd>{assets.length}</dd>
              </div>
              <div>
                <dt>Outputs</dt>
                <dd>{outputs.length}</dd>
              </div>
              <div>
                <dt>Failed</dt>
                <dd>{failed}</dd>
              </div>
            </dl>
          </section>

          <section className="inspector-section">
            <BatchRecipe
              operations={batchOperations}
              source={
                activeAsset
                  ? (dimensions ?? { width: activeAsset.width, height: activeAsset.height })
                  : { width: 1200, height: 800 }
              }
              selectedId={selectedOperation?.id ?? null}
              onSelect={setSelectedId}
              onChange={setBatchOperations}
            />
            {selectedOperation && activeAsset ? <div className="divider" /> : null}
            {selectedOperation && activeAsset ? (
              <OperationFields
                operation={selectedOperation}
                source={sourceDimensionsFor(activeAsset, batchOperations, selectedOperation.id)}
                onChange={(next) =>
                  setBatchOperations(
                    batchOperations.map((operation) =>
                      operation.id === next.id ? next : operation,
                    ),
                  )
                }
              />
            ) : null}
          </section>

          <ExportSettingsFields />

          <section className="inspector-section">
            <h2 className="inspector-section__title">Processing</h2>
            {running ? (
              <ProgressBar
                value={assets.length > 0 ? Math.round((completed / assets.length) * 100) : 0}
                label="Batch progress"
              />
            ) : null}
            <Button
              variant="primary"
              block
              loading={running}
              disabled={assets.length === 0}
              onClick={() => void processAll()}
            >
              Process all images
            </Button>
            <div className="row">
              {running ? <Button onClick={cancel}>Cancel</Button> : null}
              <Button disabled={outputs.length === 0 || running} onClick={() => void downloadZip()}>
                Download ZIP
              </Button>
            </div>
            {error ? (
              <Alert tone="danger" title="Batch error">
                {error.message} {error.hint}
              </Alert>
            ) : null}
            {Object.keys(errors).length > 0 ? (
              <Alert tone="warn" title="Some files failed">
                <ul className="stack" style={{ gap: 2 }}>
                  {Object.entries(errors).map(([assetId, message]) => {
                    const asset = assets.find((candidate) => candidate.id === assetId);
                    return (
                      <li key={assetId}>
                        <strong>{asset?.name ?? assetId}</strong>: {message}
                      </li>
                    );
                  })}
                </ul>
              </Alert>
            ) : null}
          </section>

          {outputs.length > 0 ? (
            <section className="inspector-section">
              <h2 className="inspector-section__title">Outputs</h2>
              <div className="output-list">
                {outputs.map((output) => (
                  <div className="output-item" key={output.assetId}>
                    <div>
                      <div className="output-item__name" title={output.name}>
                        {output.name}
                      </div>
                      <div className="output-item__meta">
                        {output.width}×{output.height} · {formatBytes(output.size)}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      icon={<Download size={14} aria-hidden="true" />}
                      onClick={() => downloadBlob(output.blob, output.name)}
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
