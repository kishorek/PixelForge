import { readImageMetadata } from "@pixelforge/browser-image-io";
import type { ImageMetadata, MetadataField } from "@pixelforge/browser-image-io";
import { Copy, FileText, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Workbench } from "../../components/Workbench";
import { Alert, Badge, Button, Spinner } from "../../components/ui";
import { activeAssetOf, useSession } from "../../state/session";

export function MetadataPage() {
  const asset = useSession(activeAssetOf);
  const [metadata, setMetadata] = useState<ImageMetadata | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!asset) {
      setMetadata(null);
      return;
    }
    let cancelled = false;
    setBusy(true);
    setError(null);
    readImageMetadata(asset.blob, asset.name)
      .then((result) => {
        if (!cancelled) setMetadata(result);
      })
      .catch((readError) => {
        if (!cancelled)
          setError(readError instanceof Error ? readError.message : String(readError));
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [asset]);

  const groups = useMemo(() => {
    if (!metadata) return [] as { name: string; fields: MetadataField[] }[];
    const map = new Map<string, MetadataField[]>();
    for (const field of metadata.fields) {
      const list = map.get(field.group) ?? [];
      list.push(field);
      map.set(field.group, list);
    }
    return [...map.entries()].map(([name, fields]) => ({ name, fields }));
  }, [metadata]);

  const copy = () => {
    if (!metadata) return;
    void navigator.clipboard
      ?.writeText(JSON.stringify(metadata, null, 2))
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1400);
      })
      .catch(() => {});
  };

  return (
    <Workbench
      title="Metadata"
      description="Inspect container and EXIF metadata and understand what export removes."
      stage={
        <div className="stage">
          {asset ? (
            <img
              className="stage__image"
              src={asset.previewUrl}
              alt={`Metadata source: ${asset.name}`}
            />
          ) : (
            <div className="stage__empty">
              <strong>No source selected</strong>
              <span>Add an image to inspect its metadata.</span>
            </div>
          )}
          <div className="stage__status" aria-live="polite">
            {busy ? "Reading metadata…" : metadata ? `${metadata.fields.length} fields` : "Idle"}
          </div>
        </div>
      }
      canvasbarExtra={
        metadata ? (
          <span className="mono muted">
            {metadata.format?.toUpperCase() ?? "Unknown"} · {metadata.width}×{metadata.height}
          </span>
        ) : null
      }
      footer={
        <>
          <div className="workbench__footer-info">
            <span className="muted">Metadata</span>
            <strong>{asset?.name ?? "No image"}</strong>
            <span className="muted">
              {metadata
                ? `${metadata.fields.length} fields · header scan`
                : "Add an image from the queue"}
            </span>
          </div>
          <div className="row">
            <Badge tone="ok">Local only</Badge>
            {metadata ? (
              <Button size="sm" icon={<Copy size={14} aria-hidden="true" />} onClick={copy}>
                {copied ? "Copied" : "Copy JSON"}
              </Button>
            ) : null}
          </div>
        </>
      }
      inspector={
        <div className="inspector-scroll">
          <section className="inspector-section">
            <span className="eyebrow">Inspect</span>
            <h2 className="inspector-title">What is in the file?</h2>
            <p className="field__hint">
              PixelForge reads the first 4 MB of the file for PNG, JPEG and WebP container chunks,
              ICC profiles and EXIF tags. Values are shown without changing the source.
            </p>
            <div className="row">
              <Badge>
                <FileText size={12} aria-hidden="true" /> {metadata?.fields.length ?? 0} fields
              </Badge>
              {busy ? <Spinner label="Reading metadata" /> : null}
            </div>
            {error ? (
              <Alert tone="danger" title="Metadata could not be read">
                {error}
              </Alert>
            ) : null}
            {metadata?.warning ? (
              <Alert tone="warn" title="Limited metadata">
                {metadata.warning}
              </Alert>
            ) : null}
          </section>

          {groups.map((group) => (
            <section className="inspector-section" key={group.name}>
              <h2 className="inspector-section__title">{group.name}</h2>
              <dl className="summary">
                {group.fields.map((field, index) => (
                  <div className="summary__row" key={`${field.label}-${index}`}>
                    <dt className="summary__label">{field.label}</dt>
                    <dd
                      className="summary__value"
                      style={{ maxWidth: "62%", overflowWrap: "anywhere", textAlign: "right" }}
                    >
                      {field.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}

          <section className="inspector-section">
            <h2 className="inspector-section__title">Metadata on export</h2>
            <Alert tone="info" title="Exports are re-encoded">
              PixelForge renders through the browser canvas and re-encodes the output. Container
              chunks, EXIF and ICC profiles are removed by this path. This behaviour is the same for
              single downloads, batch outputs and ZIP archives.
            </Alert>
            <div className="row">
              <Badge tone="warn">
                <ShieldCheck size={12} aria-hidden="true" /> Metadata removal applied
              </Badge>
            </div>
            <p className="field__hint">
              Metadata preservation is not available in this build. Keep the original file if you
              need its metadata.
            </p>
          </section>
        </div>
      }
    />
  );
}
