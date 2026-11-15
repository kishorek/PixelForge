import { ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { Dropzone } from "../../components/Dropzone";
import { Alert, Badge } from "../../components/ui";
import { useImport } from "../../hooks/useImport";
import { usePasteImport } from "../../hooks/usePasteImport";
import { useSession } from "../../state/session";
import { EXTRA_WORKSPACES, TOOLS, getTool } from "../tools/tools";

interface GridItem {
  title: string;
  description: string;
  path: string;
  icon: LucideIcon;
  meta?: string;
}

function ToolGrid({
  items,
  twoColumns = false,
  threeColumns = false,
}: {
  items: readonly GridItem[];
  twoColumns?: boolean;
  threeColumns?: boolean;
}) {
  return (
    <div
      className={`tool-grid${twoColumns ? " tool-grid--two" : ""}${threeColumns ? " tool-grid--three" : ""}`}
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Link className="tool-card" to={item.path} key={item.path}>
            <Icon className="tool-card__icon" size={22} strokeWidth={1.7} aria-hidden="true" />
            <span className="tool-card__title">{item.title}</span>
            <span className="tool-card__desc">{item.description}</span>
            {item.meta ? <span className="tool-card__meta">{item.meta}</span> : null}
          </Link>
        );
      })}
    </div>
  );
}

function RecentTools() {
  const recentTools = useSession((state) => state.recentTools);
  const tools = recentTools
    .map((id) => getTool(id))
    .filter((tool): tool is NonNullable<typeof tool> => tool !== undefined);

  if (tools.length === 0) return null;

  return (
    <div className="stack" style={{ marginTop: "var(--space-4)" }}>
      <span className="field__label">Recently used</span>
      <div className="recent-list">
        {tools.map((tool) => (
          <Link key={tool.id} to={tool.path}>
            <span className="row" style={{ gap: 8 }}>
              <tool.icon size={15} aria-hidden="true" />
              {tool.title}
            </span>
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        ))}
      </div>
    </div>
  );
}

export function HomePage() {
  const { importFiles, busy, errors, clearErrors } = useImport();
  const assets = useSession((state) => state.assets);
  usePasteImport(importFiles);

  return (
    <div className="page">
      <section className="home-hero">
        <div className="home-copy">
          <span className="eyebrow">Local-first image studio</span>
          <h1 className="home-title">
            Your images.
            <br />
            <em>Forged</em> on your device.
          </h1>
          <p className="home-lede">
            Convert, compress, resize, crop and watermark without an account. PixelForge runs the
            heavy pixel work in WebAssembly and never uploads your files.
          </p>
          <div className="home-actions">
            <Link className="btn btn--primary btn--lg" to="/tools">
              Browse tools <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link className="btn btn--lg" to="/editor">
              Open editor
            </Link>
            <Link className="btn btn--lg btn--ghost" to="/batch">
              Batch studio
            </Link>
          </div>
          <div className="home-facts">
            <span>
              <ShieldCheck size={15} aria-hidden="true" /> Local processing
            </span>
            <span>
              <CheckCircle2 size={15} aria-hidden="true" /> No account
            </span>
            <span>
              <CheckCircle2 size={15} aria-hidden="true" /> Original preserved
            </span>
          </div>
        </div>

        <div className="home-drop">
          <Dropzone
            onFiles={importFiles}
            busy={busy}
            title="Drop images to start"
            hint="JPEG, PNG, WebP and AVIF. Add several at once for batch work."
          />
          {assets.length > 0 ? (
            <div className="alert" data-tone="ok" style={{ marginTop: "var(--space-3)" }}>
              <div className="spread">
                <span className="alert__title">
                  {assets.length} image{assets.length === 1 ? "" : "s"} ready in this session
                </span>
                <Link className="btn btn--sm" to="/editor">
                  Open editor
                </Link>
              </div>
            </div>
          ) : null}
          {errors.length > 0 ? (
            <div style={{ marginTop: "var(--space-3)" }}>
              <Alert tone="danger" title="Some files were skipped" onDismiss={clearErrors}>
                <ul className="stack" style={{ gap: 2 }}>
                  {errors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </Alert>
            </div>
          ) : null}
          <RecentTools />
        </div>
      </section>

      <section className="home-grid">
        <div className="stack stack--lg">
          <div>
            <div className="section-heading">
              <h2>Popular tools</h2>
              <p>Start with a job, not a blank canvas.</p>
            </div>
            <ToolGrid
              threeColumns
              items={TOOLS.map((tool) => ({
                title: tool.title,
                description: tool.short,
                path: tool.path,
                icon: tool.icon,
                meta: tool.category,
              }))}
            />
          </div>

          <div>
            <div className="section-heading">
              <h2>Workspaces</h2>
              <p>For multi-step edits and multi-image jobs.</p>
            </div>
            <ToolGrid
              twoColumns
              items={EXTRA_WORKSPACES.map((workspace) => ({
                title: workspace.title,
                description: workspace.description,
                path: workspace.path,
                icon: workspace.icon,
                meta: workspace.meta,
              }))}
            />
          </div>
        </div>

        <aside className="stack stack--lg">
          <div className="privacy-strip">
            <ShieldCheck className="privacy-strip__icon" size={22} aria-hidden="true" />
            <div>
              <h3>Your files stay here</h3>
              <p>
                Images are decoded, processed and encoded in this browser tab. No PixelForge server
                receives your image data, file names or watermark text.
              </p>
            </div>
          </div>

          <div className="stack">
            <div className="section-heading">
              <h2>How it works</h2>
            </div>
            <ol className="stack" style={{ counterReset: "step" }}>
              {[
                "Import one or many images. Originals are kept untouched.",
                "Stack operations or use a focused quick tool.",
                "Preview at reduced resolution, then render the full-size export.",
                "Download one file or package a batch as a ZIP.",
              ].map((step, index) => (
                <li key={step} className="step">
                  <Badge tone="accent">{index + 1}</Badge>
                  <span className="field__hint" style={{ fontSize: "var(--step-0)" }}>
                    {step}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </section>
    </div>
  );
}
