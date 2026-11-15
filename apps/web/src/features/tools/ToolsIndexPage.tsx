import { ArrowRight, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button, EmptyState } from "../../components/ui";
import { EXTRA_WORKSPACES, TOOLS } from "./tools";

const CATEGORIES = ["Essentials", "Overlay"] as const;

export function ToolsIndexPage() {
  const [query, setQuery] = useState("");
  const normalised = query.trim().toLowerCase();

  const filtered = useMemo(
    () =>
      TOOLS.filter((tool) =>
        `${tool.title} ${tool.short} ${tool.description} ${tool.category}`
          .toLowerCase()
          .includes(normalised),
      ),
    [normalised],
  );

  return (
    <div className="page">
      <header className="page-header">
        <span className="eyebrow">Tool directory</span>
        <h1>Pick the job. PixelForge handles the pixels.</h1>
        <p className="lede">
          Focused tools for common image jobs, all sharing the same non-destructive processing
          engine. Images are processed in this browser tab.
        </p>
      </header>

      <div className="row" style={{ marginBottom: "var(--space-5)" }}>
        <label className="visually-hidden" htmlFor="tool-search">
          Search tools
        </label>
        <div className="input-group" style={{ maxWidth: 440, flex: "1 1 280px" }}>
          <input
            id="tool-search"
            className="input"
            type="search"
            value={query}
            placeholder="Search tools — resize, compress, watermark…"
            onChange={(event) => setQuery(event.target.value)}
          />
          <span className="input-affix" aria-hidden="true">
            <Search size={15} />
          </span>
        </div>
        {query ? (
          <Button variant="ghost" onClick={() => setQuery("")}>
            Clear
          </Button>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No tools match that search"
          action={
            <Button onClick={() => setQuery("")} variant="primary">
              Clear search
            </Button>
          }
        >
          Try a broader term such as “resize” or “watermark”.
        </EmptyState>
      ) : (
        <div className="stack stack--lg">
          {CATEGORIES.map((category) => {
            const tools = filtered.filter((tool) => tool.category === category);
            if (tools.length === 0) return null;
            return (
              <section key={category}>
                <div className="section-heading">
                  <h2>{category}</h2>
                  <p>
                    {tools.length} tool{tools.length === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="tool-grid tool-grid--cards">
                  {tools.map((tool) => {
                    const Icon = tool.icon;
                    return (
                      <Link className="tool-card" to={tool.path} key={tool.id}>
                        <Icon
                          className="tool-card__icon"
                          size={22}
                          strokeWidth={1.7}
                          aria-hidden="true"
                        />
                        <span className="tool-card__title">{tool.title}</span>
                        <span className="tool-card__desc">{tool.description}</span>
                        <span className="tool-card__meta row" style={{ gap: 4 }}>
                          Open tool <ArrowRight size={12} aria-hidden="true" />
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}

          {normalised.length === 0 ? (
            <section>
              <div className="section-heading">
                <h2>Workspaces</h2>
                <p>Multi-step and multi-image work</p>
              </div>
              <div className="tool-grid tool-grid--cards">
                {EXTRA_WORKSPACES.map((workspace) => {
                  const Icon = workspace.icon;
                  return (
                    <Link className="tool-card" to={workspace.path} key={workspace.path}>
                      <Icon
                        className="tool-card__icon"
                        size={22}
                        strokeWidth={1.7}
                        aria-hidden="true"
                      />
                      <span className="tool-card__title">{workspace.title}</span>
                      <span className="tool-card__desc">{workspace.description}</span>
                      <span className="tool-card__meta">{workspace.meta}</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
