import { createOperation } from "@pixelforge/operation-model";
import { Brush, Eraser, Shapes } from "lucide-react";
import { type PointerEvent, useCallback, useEffect, useRef, useState } from "react";
import { ExportPanel } from "../../components/ExportPanel";
import { OperationFields } from "../../components/OperationFields";
import { OutputFooter } from "../../components/OutputFooter";
import { Workbench } from "../../components/Workbench";
import { Alert, Badge, Button, RangeField, SwitchRow } from "../../components/ui";
import { usePreview } from "../../hooks/usePreview";
import { safeOutputDimensions } from "../../lib/operations";
import { type SessionAsset, activeAssetOf, useSession } from "../../state/session";

function MaskBrushStage({
  asset,
  previewUrl,
  previewWidth,
  previewHeight,
  maskDataUrl,
  brushSize,
  showOverlay,
  onCommit,
}: {
  asset: SessionAsset;
  previewUrl: string | null;
  previewWidth: number;
  previewHeight: number;
  maskDataUrl: string;
  brushSize: number;
  showOverlay: boolean;
  onCommit: (dataUrl: string) => void;
}) {
  const maskRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const lastLoadedRef = useRef("");
  const paintingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const maskDataUrlRef = useRef(maskDataUrl);
  maskDataUrlRef.current = maskDataUrl;

  const sourceWidth = previewWidth > 0 ? previewWidth : asset.width;
  const sourceHeight = previewHeight > 0 ? previewHeight : asset.height;
  const scale = Math.min(1, 1000 / Math.max(sourceWidth, sourceHeight));
  const canvasWidth = Math.max(1, Math.round(sourceWidth * scale));
  const canvasHeight = Math.max(1, Math.round(sourceHeight * scale));

  const loadMask = useCallback((dataUrl: string) => {
    const mask = maskRef.current;
    const overlay = overlayRef.current;
    if (!mask || !overlay) return;
    const maskContext = mask.getContext("2d");
    const overlayContext = overlay.getContext("2d");
    if (!maskContext || !overlayContext) return;
    const image = new Image();
    image.onload = () => {
      maskContext.clearRect(0, 0, mask.width, mask.height);
      overlayContext.clearRect(0, 0, overlay.width, overlay.height);
      maskContext.drawImage(image, 0, 0, mask.width, mask.height);
      overlayContext.drawImage(image, 0, 0, overlay.width, overlay.height);
      overlayContext.globalCompositeOperation = "source-in";
      overlayContext.globalAlpha = 0.55;
      overlayContext.fillStyle = "#f25b35";
      overlayContext.fillRect(0, 0, overlay.width, overlay.height);
      overlayContext.globalAlpha = 1;
      overlayContext.globalCompositeOperation = "source-over";
      lastLoadedRef.current = dataUrl;
    };
    image.src = dataUrl;
  }, []);

  useEffect(() => {
    const mask = maskRef.current;
    const overlay = overlayRef.current;
    if (!mask || !overlay) return;
    mask.width = canvasWidth;
    mask.height = canvasHeight;
    overlay.width = canvasWidth;
    overlay.height = canvasHeight;
    lastLoadedRef.current = "";
    const maskContext = mask.getContext("2d");
    const overlayContext = overlay.getContext("2d");
    maskContext?.clearRect(0, 0, canvasWidth, canvasHeight);
    overlayContext?.clearRect(0, 0, canvasWidth, canvasHeight);
    if (maskDataUrlRef.current) loadMask(maskDataUrlRef.current);
  }, [canvasWidth, canvasHeight, loadMask]);

  useEffect(() => {
    if (!maskDataUrl) return;
    if (maskDataUrl === lastLoadedRef.current) return;
    loadMask(maskDataUrl);
  }, [maskDataUrl, loadMask]);

  const pointFor = (event: PointerEvent<HTMLDivElement>) => {
    const overlay = overlayRef.current;
    if (!overlay) return { x: 0, y: 0 };
    const rect = overlay.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * overlay.width,
      y: ((event.clientY - rect.top) / rect.height) * overlay.height,
    };
  };

  const drawSegment = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const mask = maskRef.current;
    const overlay = overlayRef.current;
    if (!mask || !overlay) return;
    const maskContext = mask.getContext("2d");
    const overlayContext = overlay.getContext("2d");
    if (!maskContext || !overlayContext) return;
    const lineWidth = Math.max(1, (brushSize / 100) * Math.min(mask.width, mask.height));
    for (const [context, colour] of [
      [maskContext, "#ffffff"],
      [overlayContext, "rgba(242, 91, 53, 0.62)"],
    ] as const) {
      context.strokeStyle = colour;
      context.fillStyle = colour;
      context.lineWidth = lineWidth;
      context.lineCap = "round";
      context.lineJoin = "round";
      context.beginPath();
      context.moveTo(from.x, from.y);
      context.lineTo(to.x, to.y);
      context.stroke();
      context.beginPath();
      context.arc(to.x, to.y, lineWidth / 2, 0, Math.PI * 2);
      context.fill();
    }
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const point = pointFor(event);
    paintingRef.current = true;
    lastPointRef.current = point;
    drawSegment(point, point);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!paintingRef.current) return;
    const point = pointFor(event);
    const last = lastPointRef.current ?? point;
    drawSegment(last, point);
    lastPointRef.current = point;
  };

  const handlePointerUp = () => {
    if (!paintingRef.current) return;
    paintingRef.current = false;
    lastPointRef.current = null;
    const mask = maskRef.current;
    if (!mask) return;
    const dataUrl = mask.toDataURL("image/png");
    lastLoadedRef.current = dataUrl;
    onCommit(dataUrl);
  };

  return (
    <div className="stage mask-stage">
      <div className="mask-frame">
        <img
          className="stage__image"
          src={previewUrl ?? asset.previewUrl}
          alt={`Mask editing view: ${asset.name}`}
        />
        <canvas ref={maskRef} className="mask-canvas" />
        <div
          className="mask-overlay"
          role="application"
          aria-label="Mask painting surface. Paint with the pointer. Use the centre shape buttons for keyboard support."
          style={{ opacity: showOverlay ? 1 : 0 }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <canvas ref={overlayRef} />
        </div>
      </div>
      <div className="stage__status" aria-live="polite">
        Paint white areas · brush {brushSize}%
      </div>
    </div>
  );
}

export function MaskPage() {
  const asset = useSession(activeAssetOf);
  const operations = useSession((state) =>
    state.activeId ? (state.operationsByAsset[state.activeId] ?? []) : [],
  );
  const watermarkImage = useSession((state) => state.watermarkImage);
  const addOperation = useSession((state) => state.addOperation);
  const updateOperation = useSession((state) => state.updateOperation);
  const preview = usePreview(asset, operations, watermarkImage);
  const [brushSize, setBrushSize] = useState(6);
  const [showOverlay, setShowOverlay] = useState(true);

  const maskOperation = operations.find(
    (operation): operation is Extract<typeof operation, { type: "mask-effect" }> =>
      operation.type === "mask-effect",
  );

  useEffect(() => {
    if (!asset || maskOperation) return;
    addOperation(
      asset.id,
      createOperation("mask-effect", { width: asset.width, height: asset.height }),
    );
  }, [asset, maskOperation, addOperation]);

  const updateMask = (dataUrl: string) => {
    if (!asset || !maskOperation) return;
    updateOperation(asset.id, maskOperation.id, {
      ...maskOperation,
      params: { ...maskOperation.params, maskDataUrl: dataUrl },
    });
  };

  const applyMaskShape = (shape: "ellipse" | "rectangle") => {
    if (!asset || !maskOperation) return;
    const maxEdge = 1024;
    const scale = Math.min(1, maxEdge / Math.max(asset.width, asset.height));
    const width = Math.max(1, Math.round(asset.width * scale));
    const height = Math.max(1, Math.round(asset.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = "#ffffff";
    if (shape === "ellipse") {
      context.beginPath();
      context.ellipse(width / 2, height / 2, width * 0.35, height * 0.35, 0, 0, Math.PI * 2);
      context.fill();
    } else {
      context.fillRect(width * 0.2, height * 0.2, width * 0.6, height * 0.6);
    }
    updateMask(canvas.toDataURL("image/png"));
  };

  const clearMask = () => updateMask("");
  const dimensions = asset ? safeOutputDimensions(asset, operations) : null;

  return (
    <Workbench
      title="Mask"
      description="Paint a mask, feather it, then erase, blur or sharpen through it."
      stage={
        asset ? (
          <MaskBrushStage
            asset={asset}
            previewUrl={preview.url}
            previewWidth={preview.width}
            previewHeight={preview.height}
            maskDataUrl={maskOperation?.params.maskDataUrl ?? ""}
            brushSize={brushSize}
            showOverlay={showOverlay}
            onCommit={updateMask}
          />
        ) : (
          <div className="stage">
            <div className="stage__empty">
              <strong>No image selected</strong>
              <span>Add an image to paint a mask.</span>
            </div>
          </div>
        )
      }
      canvasbarExtra={
        <span className="mono muted">
          {maskOperation
            ? `${maskOperation.params.effect} · ${maskOperation.params.feather}% feather`
            : "Mask"}
        </span>
      }
      footer={<OutputFooter asset={asset} dimensions={dimensions} />}
      inspector={
        <div className="inspector-scroll">
          <section className="inspector-section">
            <span className="eyebrow">Mask</span>
            <h2 className="inspector-title">Paint selectively</h2>
            <p className="field__hint">
              Paint white areas on the image. The masked effect applies only where the mask is
              white; feather softens the boundary. Use the shape buttons for a keyboard-accessible
              starting mask.
            </p>
            <div className="row">
              <Badge>
                <Brush size={12} aria-hidden="true" /> Brush {brushSize}%
              </Badge>
              {maskOperation?.params.maskDataUrl ? (
                <Badge tone="ok">Mask painted</Badge>
              ) : (
                <Badge tone="warn">Empty mask</Badge>
              )}
            </div>
          </section>

          <section className="inspector-section">
            <h2 className="inspector-section__title">Brush</h2>
            <RangeField
              id="mask-brush-size"
              label="Brush size"
              value={brushSize}
              min={1}
              max={30}
              format={(value) => `${value}%`}
              onChange={setBrushSize}
            />
            <SwitchRow
              id="mask-show-overlay"
              label="Show mask overlay"
              description="Hide the red overlay to inspect the effect."
              checked={showOverlay}
              onChange={setShowOverlay}
            />
            <div className="row">
              <Button size="sm" onClick={() => applyMaskShape("ellipse")}>
                <Shapes size={14} aria-hidden="true" /> Centre ellipse
              </Button>
              <Button size="sm" onClick={() => applyMaskShape("rectangle")}>
                Centre rectangle
              </Button>
              <Button size="sm" variant="ghost" onClick={clearMask} disabled={!maskOperation}>
                <Eraser size={14} aria-hidden="true" /> Clear mask
              </Button>
            </div>
          </section>

          {maskOperation ? (
            <section className="inspector-section">
              <h2 className="inspector-section__title">Masked effect</h2>
              <OperationFields
                operation={maskOperation}
                source={{ width: asset?.width ?? 1, height: asset?.height ?? 1 }}
                onChange={(next) => {
                  if (asset) updateOperation(asset.id, next.id, next);
                }}
              />
            </section>
          ) : (
            <section className="inspector-section">
              <Alert tone="info" title="Preparing mask">
                Add an image to create the mask operation.
              </Alert>
            </section>
          )}

          <ExportPanel asset={asset} operations={operations} watermarkImage={watermarkImage} />

          <section className="inspector-section">
            <p className="field__hint">
              The mask is stored with the operation and applied to every image in batch processing.
              Preview effects use the reduced preview; exports render at full resolution.
            </p>
          </section>
        </div>
      }
    />
  );
}
