import { FORMATS } from "@pixelforge/image-contracts";
import type { Operation } from "@pixelforge/image-contracts";
import { createOperation } from "@pixelforge/operation-model";
import { Columns2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ExportPanel } from "../../components/ExportPanel";
import { OperationFields } from "../../components/OperationFields";
import { OutputFooter } from "../../components/OutputFooter";
import { PreviewStage } from "../../components/PreviewStage";
import { Workbench } from "../../components/Workbench";
import { Alert, Button, IconButton, SegmentedControl } from "../../components/ui";
import { usePreview } from "../../hooks/usePreview";
import { safeOutputDimensions, sourceDimensionsFor } from "../../lib/operations";
import { activeAssetOf, useSession } from "../../state/session";
import { type ToolDefinition, getTool } from "./tools";

const EMPTY_OPERATIONS: Operation[] = [];

type ResizeOperation = Extract<Operation, { type: "resize" }>;
type CropOperation = Extract<Operation, { type: "crop" }>;
type RotateOperation = Extract<Operation, { type: "rotate" }>;
type FlipOperation = Extract<Operation, { type: "flip" }>;
type TextOperation = Extract<Operation, { type: "watermark-text" }>;
type ImageOperation = Extract<Operation, { type: "watermark-image" }>;

function SingleOperationSection({
  label,
  asset,
  operations,
  operation,
  onUpdate,
}: {
  label: string;
  asset: { width: number; height: number };
  operations: Operation[];
  operation: Operation | undefined;
  onUpdate: (operation: Operation) => void;
}) {
  return (
    <section className="inspector-section">
      <h2 className="inspector-section__title">{label}</h2>
      {operation ? (
        <OperationFields
          operation={operation}
          source={sourceDimensionsFor(asset, operations, operation.id)}
          onChange={onUpdate}
        />
      ) : (
        <p className="field__hint">Preparing the operation…</p>
      )}
    </section>
  );
}

function ToolControls({
  tool,
  asset,
  operations,
  watermarkMode,
  onChangeWatermarkMode,
}: {
  tool: ToolDefinition;
  asset: { id: string; width: number; height: number } | null;
  operations: Operation[];
  watermarkMode: "text" | "image";
  onChangeWatermarkMode: (mode: "text" | "image") => void;
}) {
  const updateOperation = useSession((state) => state.updateOperation);
  const addOperation = useSession((state) => state.addOperation);
  const setExport = useSession((state) => state.setExport);
  const exportSettings = useSession((state) => state.exportSettings);

  if (!asset) {
    return (
      <section className="inspector-section">
        <p className="field__hint">
          Add an image to the queue to use this tool. Processing never leaves your device.
        </p>
      </section>
    );
  }

  const resizeOperation = operations.find((op): op is ResizeOperation => op.type === "resize");
  const cropOperation = operations.find((op): op is CropOperation => op.type === "crop");
  const rotateOperation = operations.find((op): op is RotateOperation => op.type === "rotate");
  const flipOperation = operations.find((op): op is FlipOperation => op.type === "flip");
  const textOperation = operations.find((op): op is TextOperation => op.type === "watermark-text");
  const imageOperation = operations.find(
    (op): op is ImageOperation => op.type === "watermark-image",
  );

  switch (tool.id) {
    case "convert":
      return (
        <section className="inspector-section">
          <h2 className="inspector-section__title">Conversion</h2>
          <p className="field__hint">
            Choose an output format and quality below. The source file is never modified. If the
            source has transparency and you choose JPEG, transparent pixels are flattened onto the
            colour you pick.
          </p>
          <dl className="summary">
            <div className="summary__row">
              <dt className="summary__label">Source dimensions</dt>
              <dd className="summary__value">
                {asset.width} × {asset.height}
              </dd>
            </div>
            <div className="summary__row">
              <dt className="summary__label">Current format</dt>
              <dd className="summary__value">{FORMATS[exportSettings.format].label}</dd>
            </div>
          </dl>
        </section>
      );
    case "compress":
      return (
        <section className="inspector-section">
          <h2 className="inspector-section__title">Compression</h2>
          <p className="field__hint">
            Quality presets are a starting point. Set a target size below for a best-effort search;
            lossless PNG cannot guarantee a size target.
          </p>
          <div className="row">
            <Button size="sm" onClick={() => setExport({ quality: 0.75, targetSizeBytes: null })}>
              Web 75%
            </Button>
            <Button size="sm" onClick={() => setExport({ quality: 0.85, targetSizeBytes: null })}>
              Balanced 85%
            </Button>
            <Button size="sm" onClick={() => setExport({ quality: 0.92, targetSizeBytes: null })}>
              High 92%
            </Button>
          </div>
        </section>
      );
    case "resize":
      return (
        <SingleOperationSection
          label="Resize"
          asset={asset}
          operations={operations}
          operation={resizeOperation}
          onUpdate={(next) => updateOperation(asset.id, next.id, next)}
        />
      );
    case "crop":
      return (
        <SingleOperationSection
          label="Crop"
          asset={asset}
          operations={operations}
          operation={cropOperation}
          onUpdate={(next) => updateOperation(asset.id, next.id, next)}
        />
      );
    case "rotate":
      return (
        <>
          <SingleOperationSection
            label="Rotate"
            asset={asset}
            operations={operations}
            operation={rotateOperation}
            onUpdate={(next) => updateOperation(asset.id, next.id, next)}
          />
          <section className="inspector-section">
            <h2 className="inspector-section__title">Flip</h2>
            {flipOperation ? (
              <OperationFields
                operation={flipOperation}
                source={sourceDimensionsFor(asset, operations, flipOperation.id)}
                onChange={(next) => updateOperation(asset.id, next.id, next)}
              />
            ) : (
              <Button
                size="sm"
                onClick={() =>
                  addOperation(
                    asset.id,
                    createOperation("flip", { width: asset.width, height: asset.height }),
                  )
                }
              >
                Add flip
              </Button>
            )}
          </section>
        </>
      );
    case "watermark": {
      const operation = watermarkMode === "text" ? textOperation : imageOperation;
      return (
        <section className="inspector-section">
          <h2 className="inspector-section__title">Watermark</h2>
          <SegmentedControl
            label="Watermark type"
            value={watermarkMode}
            options={[
              { value: "text", label: "Text" },
              { value: "image", label: "Logo" },
            ]}
            onChange={(mode) => onChangeWatermarkMode(mode as "text" | "image")}
          />
          {operation ? (
            <OperationFields
              operation={operation}
              source={sourceDimensionsFor(asset, operations, operation.id)}
              onChange={(next) => updateOperation(asset.id, next.id, next)}
            />
          ) : (
            <p className="field__hint">Upload a logo or wait for the operation to be created.</p>
          )}
        </section>
      );
    }
  }
}

export function QuickToolPage() {
  const { tool: toolId } = useParams<{ tool: string }>();
  const tool = getTool(toolId);
  const asset = useSession(activeAssetOf);
  const operations = useSession((state) =>
    state.activeId
      ? (state.operationsByAsset[state.activeId] ?? EMPTY_OPERATIONS)
      : EMPTY_OPERATIONS,
  );
  const watermarkImage = useSession((state) => state.watermarkImage);
  const addOperation = useSession((state) => state.addOperation);
  const removeOperation = useSession((state) => state.removeOperation);
  const updateOperation = useSession((state) => state.updateOperation);
  const recordTool = useSession((state) => state.recordTool);
  const [compare, setCompare] = useState(false);
  const [watermarkMode, setWatermarkMode] = useState<"text" | "image">("text");

  useEffect(() => {
    if (tool) recordTool(tool.id);
  }, [tool, recordTool]);

  useEffect(() => {
    if (!tool || !asset) return;
    const required: Operation["type"][] = [];
    if (tool.id === "resize") required.push("resize");
    if (tool.id === "crop") required.push("crop");
    if (tool.id === "rotate") required.push("rotate");
    if (tool.id === "watermark") {
      required.push(watermarkMode === "text" ? "watermark-text" : "watermark-image");
    }
    for (const type of required) {
      if (!operations.some((operation) => operation.type === type)) {
        addOperation(asset.id, createOperation(type, { width: asset.width, height: asset.height }));
      }
    }
  }, [tool, asset, operations, watermarkMode, addOperation]);

  const dimensions = useMemo(
    () => (asset ? safeOutputDimensions(asset, operations) : null),
    [asset, operations],
  );

  const preview = usePreview(asset, operations, watermarkImage, {
    enabled: tool?.id !== "crop",
  });

  if (!tool) return <Navigate to="/tools" replace />;

  const cropOperation =
    tool.id === "crop"
      ? operations.find((operation): operation is CropOperation => operation.type === "crop")
      : undefined;

  const changeWatermarkMode = (mode: "text" | "image") => {
    setWatermarkMode(mode);
    if (!asset) return;
    for (const operation of operations) {
      if (operation.type === "watermark-text" || operation.type === "watermark-image") {
        removeOperation(asset.id, operation.id);
      }
    }
    addOperation(
      asset.id,
      createOperation(mode === "text" ? "watermark-text" : "watermark-image", {
        width: asset.width,
        height: asset.height,
      }),
    );
  };

  return (
    <Workbench
      title={tool.title}
      description={tool.description}
      stage={
        <PreviewStage
          asset={asset}
          preview={preview}
          compare={compare}
          crop={cropOperation?.params}
          onCropChange={
            cropOperation && asset
              ? (crop) =>
                  updateOperation(asset.id, cropOperation.id, { ...cropOperation, params: crop })
              : undefined
          }
          emptyTitle="Add an image to start"
          emptyHint="Drop an image into the queue on the left. It never leaves this device."
        />
      }
      canvasbarExtra={
        tool.id !== "crop" ? (
          <IconButton
            label={compare ? "Hide original comparison" : "Compare with original"}
            active={compare}
            onClick={() => setCompare((value) => !value)}
          >
            <Columns2 size={16} />
          </IconButton>
        ) : null
      }
      footer={<OutputFooter asset={asset} dimensions={dimensions} />}
      inspector={
        <div className="inspector-scroll">
          <section className="inspector-section">
            <span className="eyebrow">Quick tool</span>
            <h2 className="inspector-title">{tool.title}</h2>
            <p className="field__hint">{tool.description}</p>
            <div className="row">
              <Link className="btn btn--sm" to="/editor">
                Open in Editor
              </Link>
            </div>
            {asset?.warning ? (
              <Alert tone="warn" title="Heads up">
                {asset.warning}
              </Alert>
            ) : null}
          </section>

          <ToolControls
            tool={tool}
            asset={asset}
            operations={operations}
            watermarkMode={watermarkMode}
            onChangeWatermarkMode={changeWatermarkMode}
          />

          <ExportPanel asset={asset} operations={operations} watermarkImage={watermarkImage} />
        </div>
      }
    />
  );
}
