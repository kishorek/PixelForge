import { downloadBlob } from "@pixelforge/browser-image-io";
import { FORMATS, type FitMode, type Operation } from "@pixelforge/image-contracts";
import { createOperation } from "@pixelforge/operation-model";
import type { Recipe } from "@pixelforge/recipe-schema";
import { ArrowRight, Download, Play, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Alert, Badge, Button, EmptyState } from "../../components/ui";
import { activeAssetOf, useSession } from "../../state/session";
import { useRecipes } from "../recipes/useRecipes";

interface Preset {
  name: string;
  width: number;
  height: number;
  category: "Social" | "Video" | "Print";
  fit: FitMode;
  note: string;
}

const PRESETS: readonly Preset[] = [
  {
    name: "Instagram square",
    width: 1080,
    height: 1080,
    category: "Social",
    fit: "cover",
    note: "Feed post",
  },
  {
    name: "Instagram portrait",
    width: 1080,
    height: 1350,
    category: "Social",
    fit: "cover",
    note: "4:5 feed post",
  },
  {
    name: "Story / Reel",
    width: 1080,
    height: 1920,
    category: "Social",
    fit: "cover",
    note: "9:16 vertical",
  },
  {
    name: "X / Twitter post",
    width: 1600,
    height: 900,
    category: "Social",
    fit: "cover",
    note: "16:9 in-feed",
  },
  {
    name: "LinkedIn share",
    width: 1200,
    height: 627,
    category: "Social",
    fit: "cover",
    note: "Link preview",
  },
  {
    name: "Profile avatar",
    width: 400,
    height: 400,
    category: "Social",
    fit: "cover",
    note: "Square profile",
  },
  {
    name: "YouTube thumbnail",
    width: 1280,
    height: 720,
    category: "Video",
    fit: "cover",
    note: "16:9 thumbnail",
  },
  {
    name: "Full HD frame",
    width: 1920,
    height: 1080,
    category: "Video",
    fit: "contain",
    note: "16:9 still",
  },
  {
    name: "4×6 inch print",
    width: 1800,
    height: 1200,
    category: "Print",
    fit: "contain",
    note: "300 DPI",
  },
  {
    name: "A4 print",
    width: 2480,
    height: 3508,
    category: "Print",
    fit: "contain",
    note: "300 DPI",
  },
  {
    name: "Letter print",
    width: 2550,
    height: 3300,
    category: "Print",
    fit: "contain",
    note: "300 DPI",
  },
] as const;

const CATEGORIES = ["Social", "Video", "Print"] as const;
const EMPTY_OPERATIONS: Operation[] = [];

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "recipe"
  );
}

function RecipesSection() {
  const navigate = useNavigate();
  const setBatchOperations = useSession((state) => state.setBatchOperations);
  const setExport = useSession((state) => state.setExport);
  const { recipes, removeRecipe, importRecipe, exportRecipe } = useRecipes();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const applyRecipe = (recipe: Recipe) => {
    setBatchOperations(recipe.operations.map((operation) => structuredClone(operation)));
    if (recipe.export) setExport(recipe.export);
    navigate("/batch");
  };

  const downloadRecipe = (recipe: Recipe) => {
    downloadBlob(
      new Blob([exportRecipe(recipe)], { type: "application/json" }),
      `${slugify(recipe.name)}.pixelforge-recipe.json`,
    );
  };

  return (
    <section>
      <div className="section-heading">
        <h2>Saved recipes</h2>
        <p>{recipes.length} saved</p>
      </div>
      <div className="row" style={{ marginBottom: "var(--space-3)" }}>
        <Button
          size="sm"
          icon={<Upload size={14} aria-hidden="true" />}
          onClick={() => inputRef.current?.click()}
        >
          Import recipe JSON
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            const result = importRecipe(await file.text());
            if (result.ok) {
              setError(null);
              setMessage(`Imported “${result.recipe.name}”.`);
            } else {
              setMessage(null);
              setError(result.errors.join(" "));
            }
          }}
        />
        <Link className="btn btn--sm btn--ghost" to="/batch">
          Open Batch Studio
        </Link>
      </div>

      {error ? (
        <Alert tone="danger" title="Recipe import failed">
          {error}
        </Alert>
      ) : null}
      {message ? <Alert tone="ok">{message}</Alert> : null}

      {recipes.length === 0 ? (
        <p className="field__hint">
          No saved recipes yet. Build a pipeline in Batch Studio and save it, or import a JSON
          recipe. Recipes are stored locally in this browser.
        </p>
      ) : (
        <div className="recipe-list">
          {recipes.map((recipe) => (
            <div className="recipe-item" key={recipe.name}>
              <div className="recipe-item__text">
                <span className="recipe-item__name">{recipe.name}</span>
                <span className="field__hint">
                  {recipe.operations.length} operation{recipe.operations.length === 1 ? "" : "s"}
                  {recipe.export?.format ? ` · ${FORMATS[recipe.export.format].label}` : ""}
                </span>
              </div>
              <div className="row">
                <Button
                  size="sm"
                  variant="primary"
                  icon={<Play size={13} aria-hidden="true" />}
                  onClick={() => applyRecipe(recipe)}
                >
                  Apply
                </Button>
                <Button
                  size="sm"
                  icon={<Download size={13} aria-hidden="true" />}
                  onClick={() => downloadRecipe(recipe)}
                >
                  JSON
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Trash2 size={13} aria-hidden="true" />}
                  aria-label={`Delete ${recipe.name}`}
                  onClick={() => removeRecipe(recipe.name)}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function PresetsPage() {
  const navigate = useNavigate();
  const asset = useSession(activeAssetOf);
  const operations = useSession((state) =>
    state.activeId
      ? (state.operationsByAsset[state.activeId] ?? EMPTY_OPERATIONS)
      : EMPTY_OPERATIONS,
  );
  const addOperation = useSession((state) => state.addOperation);
  const updateOperation = useSession((state) => state.updateOperation);

  const applyPreset = (preset: Preset) => {
    if (asset) {
      const existing = operations.find(
        (operation): operation is Extract<Operation, { type: "resize" }> =>
          operation.type === "resize",
      );
      const params = {
        width: preset.width,
        height: preset.height,
        percent: null,
        fit: preset.fit,
        resampling: "bilinear" as const,
        lockAspect: true,
      };
      if (existing) {
        updateOperation(asset.id, existing.id, { ...existing, params });
      } else {
        addOperation(
          asset.id,
          createOperation("resize", { width: asset.width, height: asset.height }, params),
        );
      }
    }
    navigate("/tools/resize");
  };

  return (
    <div className="page">
      <header className="page-header">
        <span className="eyebrow">Presets & recipes</span>
        <h1>Presets and reusable recipes</h1>
        <p className="lede">
          Reuse a saved batch pipeline, or apply a common output size to the selected image. “Cover”
          fills the frame and centre-crops; “contain” fits the whole image inside it.
        </p>
      </header>

      <div className="stack stack--lg" style={{ marginBottom: "var(--space-6)" }}>
        <RecipesSection />
      </div>

      {!asset ? (
        <div style={{ marginBottom: "var(--space-5)" }}>
          <EmptyState
            title="Add an image to apply a preset"
            action={
              <Button variant="primary" onClick={() => navigate("/tools")}>
                Browse tools
              </Button>
            }
          >
            Presets become available as soon as there is an image in the session queue.
          </EmptyState>
        </div>
      ) : null}

      <div className="stack stack--lg">
        {CATEGORIES.map((category) => {
          const presets = PRESETS.filter((preset) => preset.category === category);
          return (
            <section key={category}>
              <div className="section-heading">
                <h2>{category}</h2>
                <p>{presets.length} presets</p>
              </div>
              <div className="preset-grid">
                {presets.map((preset) => {
                  const scale = Math.min(120 / preset.width, 84 / preset.height);
                  const boxWidth = Math.round(preset.width * scale);
                  const boxHeight = Math.round(preset.height * scale);
                  return (
                    <div className="preset" key={preset.name}>
                      <div
                        className="preset__ratio"
                        style={{
                          width: boxWidth,
                          height: boxHeight,
                          maxHeight: "none",
                          margin: "0 auto",
                        }}
                        aria-hidden="true"
                      />
                      <div className="spread">
                        <span className="preset__name">{preset.name}</span>
                        <Badge>{preset.fit === "cover" ? "Cover" : "Contain"}</Badge>
                      </div>
                      <span className="preset__dims">
                        {preset.width} × {preset.height} px
                      </span>
                      <span className="field__hint">{preset.note}</span>
                      <Button
                        size="sm"
                        variant={asset ? "primary" : "default"}
                        onClick={() => applyPreset(preset)}
                      >
                        Use preset <ArrowRight size={14} aria-hidden="true" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
