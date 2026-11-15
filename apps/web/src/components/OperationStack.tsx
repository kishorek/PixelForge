import type { Dimensions, Operation, OperationType } from "@pixelforge/image-contracts";
import { createOperation, describeOperation, operationLabel } from "@pixelforge/operation-model";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown, ChevronUp, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { useSession } from "../state/session";
import { Button, IconButton } from "./ui";

const ADDABLE: readonly { type: OperationType; label: string; hint: string }[] = [
  { type: "resize", label: "Resize", hint: "Fit, cover or stretch" },
  { type: "crop", label: "Crop", hint: "Freeform or preset ratio" },
  { type: "rotate", label: "Rotate", hint: "90°, 180° or 270°" },
  { type: "flip", label: "Flip", hint: "Horizontal or vertical" },
  { type: "watermark-text", label: "Text watermark", hint: "Text, size, opacity" },
  { type: "watermark-image", label: "Image watermark", hint: "Logo overlay" },
];

export function AddOperationMenu({
  source,
  onAdd,
  label = "Add operation",
}: {
  source: Dimensions;
  onAdd: (operation: Operation) => void;
  label?: string;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button type="button" className="btn btn--sm">
          <Plus size={14} aria-hidden="true" />
          {label}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="menu" sideOffset={6} align="start" collisionPadding={8}>
          <DropdownMenu.Label className="menu__label">Operations</DropdownMenu.Label>
          {ADDABLE.map((item) => (
            <DropdownMenu.Item
              key={item.type}
              className="menu__item"
              onSelect={() => onAdd(createOperation(item.type, source))}
            >
              <span>{item.label}</span>
              <span className="menu__hint">{item.hint}</span>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function OperationStack({
  assetId,
  source,
  operations,
  selectedId,
  onSelect,
}: {
  assetId: string;
  source: Dimensions;
  operations: Operation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const addOperation = useSession((state) => state.addOperation);
  const removeOperation = useSession((state) => state.removeOperation);
  const moveOperation = useSession((state) => state.moveOperation);
  const toggleOperation = useSession((state) => state.toggleOperation);
  const resetOperations = useSession((state) => state.resetOperations);
  const undo = useSession((state) => state.undo);
  const redo = useSession((state) => state.redo);
  const history = useSession((state) => state.historyByAsset[assetId]);

  return (
    <div className="stack">
      <div className="row row--between">
        <span className="field__label">Operation stack</span>
        <AddOperationMenu
          source={source}
          onAdd={(operation) => {
            addOperation(assetId, operation);
            onSelect(operation.id);
          }}
        />
      </div>

      {operations.length === 0 ? (
        <p className="field__hint">
          No operations yet. The original image is untouched until you add an operation and export.
        </p>
      ) : (
        <ol className="op-list">
          {operations.map((operation, index) => (
            <li
              key={operation.id}
              className="op-item"
              aria-current={selectedId === operation.id ? "true" : undefined}
              data-disabled={!operation.enabled || undefined}
            >
              <button
                type="button"
                className="op-item__index"
                aria-label={`Select ${operationLabel(operation)}`}
                onClick={() => onSelect(operation.id)}
              >
                {index + 1}
              </button>
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
              <div className="op-item__actions">
                <IconButton
                  label="Move operation up"
                  disabled={index === 0}
                  onClick={() => moveOperation(assetId, operation.id, -1)}
                >
                  <ChevronUp size={14} />
                </IconButton>
                <IconButton
                  label="Move operation down"
                  disabled={index === operations.length - 1}
                  onClick={() => moveOperation(assetId, operation.id, 1)}
                >
                  <ChevronDown size={14} />
                </IconButton>
                <IconButton
                  label={operation.enabled ? "Disable operation" : "Enable operation"}
                  onClick={() => toggleOperation(assetId, operation.id)}
                >
                  {operation.enabled ? <Eye size={14} /> : <EyeOff size={14} />}
                </IconButton>
                <IconButton
                  label="Remove operation"
                  onClick={() => removeOperation(assetId, operation.id)}
                >
                  <Trash2 size={14} />
                </IconButton>
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="row">
        <Button
          size="sm"
          onClick={() => undo(assetId)}
          disabled={(history?.past.length ?? 0) === 0}
        >
          Undo
        </Button>
        <Button
          size="sm"
          onClick={() => redo(assetId)}
          disabled={(history?.future.length ?? 0) === 0}
        >
          Redo
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => resetOperations(assetId)}
          disabled={operations.length === 0}
        >
          Reset all
        </Button>
      </div>
    </div>
  );
}
