import type { Operation } from "@pixelforge/image-contracts";
import { Columns2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ExportPanel } from "../../components/ExportPanel";
import { OperationFields } from "../../components/OperationFields";
import { OperationStack } from "../../components/OperationStack";
import { OutputFooter } from "../../components/OutputFooter";
import { PreviewStage } from "../../components/PreviewStage";
import { Workbench } from "../../components/Workbench";
import { Alert, IconButton } from "../../components/ui";
import { usePreview } from "../../hooks/usePreview";
import { safeOutputDimensions, sourceDimensionsFor } from "../../lib/operations";
import { activeAssetOf, useSession } from "../../state/session";

const EMPTY_OPERATIONS: Operation[] = [];

export function EditorPage() {
  const asset = useSession(activeAssetOf);
  const operations = useSession((state) =>
    state.activeId
      ? (state.operationsByAsset[state.activeId] ?? EMPTY_OPERATIONS)
      : EMPTY_OPERATIONS,
  );
  const watermarkImage = useSession((state) => state.watermarkImage);
  const updateOperation = useSession((state) => state.updateOperation);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compare, setCompare] = useState(false);

  useEffect(() => {
    if (!selectedId || !operations.some((operation) => operation.id === selectedId)) {
      setSelectedId(operations[0]?.id ?? null);
    }
  }, [operations, selectedId]);

  const selected =
    operations.find((operation) => operation.id === selectedId) ?? operations[0] ?? null;
  const dimensions = useMemo(
    () => (asset ? safeOutputDimensions(asset, operations) : null),
    [asset, operations],
  );
  const preview = usePreview(asset, operations, watermarkImage);

  return (
    <Workbench
      title="Editor"
      description="Ordered, non-destructive operations with before/after comparison."
      stage={
        <PreviewStage
          asset={asset}
          preview={preview}
          compare={compare}
          zoomable
          emptyTitle="Open an image in the editor"
          emptyHint="Add an image from the queue on the left. Quick-tool edits carry over automatically."
        />
      }
      canvasbarExtra={
        <IconButton
          label={compare ? "Hide original comparison" : "Compare with original"}
          active={compare}
          onClick={() => setCompare((value) => !value)}
        >
          <Columns2 size={16} />
        </IconButton>
      }
      footer={<OutputFooter asset={asset} dimensions={dimensions} />}
      inspector={
        <div className="inspector-scroll">
          <section className="inspector-section">
            <span className="eyebrow">Editor</span>
            <h2 className="inspector-title">Build the pipeline</h2>
            <p className="field__hint">
              Operations run top to bottom. Reorder, disable or remove them without touching the
              original file.
            </p>
            {asset?.warning ? (
              <Alert tone="warn" title="Heads up">
                {asset.warning}
              </Alert>
            ) : null}
          </section>

          {asset ? (
            <section className="inspector-section">
              <OperationStack
                assetId={asset.id}
                source={dimensions ?? { width: asset.width, height: asset.height }}
                operations={operations}
                selectedId={selected?.id ?? null}
                onSelect={setSelectedId}
              />
            </section>
          ) : null}

          <section className="inspector-section">
            <h2 className="inspector-section__title">Selected operation</h2>
            {selected && asset ? (
              <OperationFields
                operation={selected}
                source={sourceDimensionsFor(asset, operations, selected.id)}
                onChange={(next) => updateOperation(asset.id, next.id, next)}
              />
            ) : (
              <p className="field__hint">
                Select an operation in the stack, or add one, to edit its settings.
              </p>
            )}
          </section>

          <ExportPanel asset={asset} operations={operations} watermarkImage={watermarkImage} />
        </div>
      }
    />
  );
}
