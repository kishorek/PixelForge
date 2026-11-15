import { formatBytes } from "@pixelforge/operation-model";
import { ImagePlus, Trash2, X } from "lucide-react";
import { type ReactNode, useRef } from "react";
import { useImport } from "../hooks/useImport";
import { usePasteImport } from "../hooks/usePasteImport";
import { type SessionAsset, useSession } from "../state/session";
import { Dropzone } from "./Dropzone";
import { Alert, Badge, IconButton } from "./ui";

function ImportButton({
  onFiles,
  busy,
}: {
  onFiles: (files: FileList | File[]) => void;
  busy: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        multiple
        hidden
        onChange={(event) => {
          if (event.target.files?.length) void onFiles(event.target.files);
          event.target.value = "";
        }}
      />
      <button
        type="button"
        className="btn btn--sm"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
      >
        <ImagePlus size={14} aria-hidden="true" />
        {busy ? "Importing…" : "Add"}
      </button>
    </>
  );
}

function QueueItem({
  asset,
  active,
  status,
}: {
  asset: SessionAsset;
  active: boolean;
  status?: ReactNode;
}) {
  const setActive = useSession((state) => state.setActive);
  const removeAsset = useSession((state) => state.removeAsset);

  return (
    <li className="queue__item" aria-current={active ? "true" : undefined}>
      <button
        type="button"
        className="queue__select"
        onClick={() => setActive(asset.id)}
        aria-label={`Select ${asset.name}`}
        aria-pressed={active}
      >
        <img className="queue__thumb" src={asset.thumbnailUrl} alt="" width={52} height={52} />
        <span className="queue__meta">
          <span className="queue__name" title={asset.name}>
            {asset.name}
          </span>
          <span className="queue__sub">
            {asset.width}×{asset.height} · {formatBytes(asset.size)}
          </span>
          {status}
        </span>
      </button>
      <IconButton
        label={`Remove ${asset.name}`}
        className="queue__remove"
        onClick={() => removeAsset(asset.id)}
      >
        <X size={15} />
      </IconButton>
    </li>
  );
}

export function QueuePanel({ statusById }: { statusById?: Record<string, ReactNode> }) {
  const assets = useSession((state) => state.assets);
  const activeId = useSession((state) => state.activeId);
  const clearAssets = useSession((state) => state.clearAssets);
  const { importFiles, busy, errors, clearErrors } = useImport();
  usePasteImport(importFiles);

  return (
    <>
      <div className="queue-toolbar">
        <span className="queue-toolbar__title">
          Images <Badge>{assets.length}</Badge>
        </span>
        <div className="row">
          <ImportButton onFiles={importFiles} busy={busy} />
          {assets.length > 0 ? (
            <IconButton label="Remove all images" onClick={clearAssets}>
              <Trash2 size={15} />
            </IconButton>
          ) : null}
        </div>
      </div>

      {errors.length > 0 ? (
        <div style={{ padding: "var(--space-2)" }}>
          <Alert tone="danger" title="Some files were skipped" onDismiss={clearErrors}>
            <ul className="stack" style={{ gap: 2 }}>
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </Alert>
        </div>
      ) : null}

      {assets.length === 0 ? (
        <div className="queue-scroll">
          <Dropzone onFiles={importFiles} busy={busy} compact />
        </div>
      ) : (
        <div
          className="queue-scroll"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            if (event.dataTransfer.files.length > 0) void importFiles(event.dataTransfer.files);
          }}
        >
          <ul className="queue">
            {assets.map((asset) => (
              <QueueItem
                key={asset.id}
                asset={asset}
                active={asset.id === activeId}
                status={statusById?.[asset.id]}
              />
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

export function Workbench({
  title,
  description,
  stage,
  inspector,
  footer,
  canvasbarExtra,
  queueStatus,
}: {
  title: string;
  description: string;
  stage: ReactNode;
  inspector: ReactNode;
  footer: ReactNode;
  canvasbarExtra?: ReactNode;
  queueStatus?: Record<string, ReactNode>;
}) {
  return (
    <div className="workbench">
      <h1 className="visually-hidden">{title}</h1>
      <aside className="workbench__queue" aria-label="Image queue">
        <QueuePanel statusById={queueStatus} />
      </aside>
      <section className="workbench__main" aria-label={title}>
        <div className="workbench__canvasbar">
          <span>
            <strong>{title}</strong>
            <span className="muted"> — {description}</span>
          </span>
          {canvasbarExtra}
        </div>
        <div className="workbench__stage">{stage}</div>
        <div className="workbench__footer">{footer}</div>
      </section>
      <aside className="workbench__inspector" aria-label="Tool controls">
        {inspector}
      </aside>
    </div>
  );
}
