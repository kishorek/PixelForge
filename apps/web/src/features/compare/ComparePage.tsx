import { downloadBlob } from "@pixelforge/browser-image-io";
import { Download, GitCompare, Shuffle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Workbench } from "../../components/Workbench";
import {
  Alert,
  Badge,
  Button,
  RangeField,
  SegmentedControl,
  SelectField,
  Spinner,
} from "../../components/ui";
import { asPixelForgeError } from "../../lib/errors";
import { useSession } from "../../state/session";
import { type CompareResult, compareImages } from "./compare";

type CompareView = "side" | "diff";

interface ComparisonState extends CompareResult {
  diffUrl: string;
}

export function ComparePage() {
  const assets = useSession((state) => state.assets);
  const [aId, setAId] = useState<string | null>(null);
  const [bId, setBId] = useState<string | null>(null);
  const [view, setView] = useState<CompareView>("side");
  const [amplify, setAmplify] = useState(4);
  const [result, setResult] = useState<ComparisonState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ReturnType<typeof asPixelForgeError> | null>(null);
  const resultUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (assets.length === 0) {
      setAId(null);
      setBId(null);
      return;
    }
    const currentA = assets.find((asset) => asset.id === aId) ?? assets[0] ?? null;
    const currentB =
      assets.find((asset) => asset.id === bId && asset.id !== currentA?.id) ??
      assets.find((asset) => asset.id !== currentA?.id) ??
      null;
    setAId(currentA?.id ?? null);
    setBId(currentB?.id ?? null);
  }, [assets, aId, bId]);

  const a = assets.find((asset) => asset.id === aId) ?? null;
  const b = assets.find((asset) => asset.id === bId) ?? null;

  useEffect(() => {
    if (!a || !b) {
      if (resultUrlRef.current) {
        URL.revokeObjectURL(resultUrlRef.current);
        resultUrlRef.current = null;
      }
      setResult(null);
      setError(null);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setBusy(true);
      setError(null);
      try {
        const comparison = await compareImages(a.blob, b.blob, amplify);
        if (cancelled) return;
        const url = URL.createObjectURL(comparison.diffBlob);
        if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
        resultUrlRef.current = url;
        setResult({ ...comparison, diffUrl: url });
      } catch (compareError) {
        if (!cancelled) setError(asPixelForgeError(compareError));
      } finally {
        if (!cancelled) setBusy(false);
      }
    }, 260);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [a, b, amplify]);

  useEffect(
    () => () => {
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    },
    [],
  );

  const options =
    assets.length > 0
      ? assets.map((asset) => ({
          value: asset.id,
          label: `${asset.name} · ${asset.width}×${asset.height}`,
        }))
      : [{ value: "", label: "No images in the queue" }];

  const swap = () => {
    setAId(bId);
    setBId(aId);
  };

  return (
    <Workbench
      title="Compare"
      description="Pixel differences and perceptual similarity between two session images."
      stage={
        <div className="stage">
          {!a || !b ? (
            <div className="stage__empty">
              <strong>Add at least two images</strong>
              <span>Import two images into the queue, then choose them below.</span>
            </div>
          ) : view === "side" ? (
            <div className="compare-panels">
              <figure className="compare-panel">
                <img src={a.previewUrl} alt={`A: ${a.name}`} />
                <figcaption>
                  A · {a.name} · {a.width}×{a.height}
                </figcaption>
              </figure>
              <figure className="compare-panel">
                <img src={b.previewUrl} alt={`B: ${b.name}`} />
                <figcaption>
                  B · {b.name} · {b.width}×{b.height}
                </figcaption>
              </figure>
            </div>
          ) : result?.diffUrl ? (
            <img className="stage__image" src={result.diffUrl} alt="Difference map" />
          ) : (
            <div className="stage__empty">
              {busy ? <Spinner label="Comparing images" /> : null}
              <strong>{busy ? "Comparing images…" : "Difference map unavailable"}</strong>
              <span>Choose two images to compare.</span>
            </div>
          )}
          {error ? (
            <div className="stage__alert">
              <Alert tone="danger" title="Comparison failed">
                {error.message} {error.hint}
              </Alert>
            </div>
          ) : null}
          <div className="stage__status" aria-live="polite">
            {busy
              ? "Comparing images…"
              : result
                ? `Diff ${result.width}×${result.height} · MAE ${result.mae.toFixed(2)}`
                : "No comparison"}
          </div>
        </div>
      }
      canvasbarExtra={
        <span className="mono muted">{view === "side" ? "Side by side" : "Difference map"}</span>
      }
      footer={
        <>
          <div className="workbench__footer-info">
            <span className="muted">Comparison</span>
            <strong>
              {result
                ? `${Math.round(result.aHashSimilarity * 100)}% perceptual · MAE ${result.mae.toFixed(2)}`
                : "Waiting for two images"}
            </strong>
            <span className="muted">
              {a && b ? `${a.name} vs ${b.name}` : "Add two images to the queue"}
            </span>
          </div>
          <div className="row">
            {result ? (
              <Button
                size="sm"
                icon={<Download size={14} aria-hidden="true" />}
                onClick={() => downloadBlob(result.diffBlob, "pixelforge-diff.png")}
              >
                Download difference
              </Button>
            ) : null}
            <Badge tone="ok">Local only</Badge>
          </div>
        </>
      }
      inspector={
        <div className="inspector-scroll">
          <section className="inspector-section">
            <span className="eyebrow">Compare</span>
            <h2 className="inspector-title">Find the difference</h2>
            <p className="field__hint">
              Both images are cover-fitted to the same comparison size. The difference map amplifies
              channel changes; the metrics use unamplified pixel values.
            </p>
            <div className="row">
              <Badge>
                <GitCompare size={12} aria-hidden="true" /> {assets.length} images
              </Badge>
              {result ? (
                <Badge tone={result.aHashSimilarity > 0.9 ? "ok" : "warn"}>
                  {Math.round(result.aHashSimilarity * 100)}% similar
                </Badge>
              ) : null}
            </div>
          </section>

          <section className="inspector-section">
            <h2 className="inspector-section__title">Images</h2>
            <SelectField
              id="compare-a"
              label="Image A"
              value={aId ?? ""}
              options={options}
              onChange={(value) => setAId(value || null)}
              disabled={assets.length === 0}
            />
            <SelectField
              id="compare-b"
              label="Image B"
              value={bId ?? ""}
              options={options}
              onChange={(value) => setBId(value || null)}
              disabled={assets.length === 0}
            />
            <Button size="sm" icon={<Shuffle size={14} aria-hidden="true" />} onClick={swap}>
              Swap A / B
            </Button>
            {a && b && (a.width !== b.width || a.height !== b.height) ? (
              <Alert tone="info" title="Different dimensions">
                A is {a.width}×{a.height} and B is {b.width}×{b.height}. Both are cover-fitted to
                A's aspect ratio for a stable pixel comparison.
              </Alert>
            ) : null}
          </section>

          <section className="inspector-section">
            <h2 className="inspector-section__title">View</h2>
            <SegmentedControl
              label="Comparison view"
              value={view}
              options={[
                { value: "side", label: "Side by side" },
                { value: "diff", label: "Difference" },
              ]}
              onChange={(value) => setView(value as CompareView)}
            />
            {view === "diff" ? (
              <RangeField
                id="compare-amplify"
                label="Difference gain"
                value={amplify}
                min={1}
                max={16}
                format={(value) => `${value}×`}
                onChange={setAmplify}
              />
            ) : null}
          </section>

          <section className="inspector-section">
            <h2 className="inspector-section__title">Metrics</h2>
            {result ? (
              <>
                <dl className="summary">
                  <div className="summary__row">
                    <dt className="summary__label">Perceptual similarity</dt>
                    <dd className="summary__value">{Math.round(result.aHashSimilarity * 100)}%</dd>
                  </div>
                  <div className="summary__row">
                    <dt className="summary__label">Structural similarity</dt>
                    <dd className="summary__value">{Math.round(result.dHashSimilarity * 100)}%</dd>
                  </div>
                  <div className="summary__row">
                    <dt className="summary__label">Mean channel difference</dt>
                    <dd className="summary__value">{result.mae.toFixed(2)}</dd>
                  </div>
                  <div className="summary__row">
                    <dt className="summary__label">Maximum difference</dt>
                    <dd className="summary__value">{result.maxDifference}</dd>
                  </div>
                  <div className="summary__row">
                    <dt className="summary__label">Changed pixels</dt>
                    <dd className="summary__value">{(result.changedFraction * 100).toFixed(1)}%</dd>
                  </div>
                  <div className="summary__row">
                    <dt className="summary__label">Comparison size</dt>
                    <dd className="summary__value">
                      {result.width} × {result.height}
                    </dd>
                  </div>
                </dl>
                <Button
                  size="sm"
                  icon={<Download size={14} aria-hidden="true" />}
                  onClick={() => downloadBlob(result.diffBlob, "pixelforge-diff.png")}
                >
                  Download difference map
                </Button>
              </>
            ) : (
              <p className="field__hint">Choose two images to calculate metrics.</p>
            )}
            {error ? (
              <Alert tone="danger" title="Comparison error">
                {error.message}
              </Alert>
            ) : null}
          </section>

          <section className="inspector-section">
            <p className="field__hint">
              Comparison runs on this device. Decoding and analysis use a reduced comparison size;
              source files are unchanged.
            </p>
          </section>
        </div>
      }
    />
  );
}
