import type { FitMode, Operation } from "@pixelforge/image-contracts";
import { createOperation } from "@pixelforge/operation-model";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge, Button, EmptyState } from "../../components/ui";
import { activeAssetOf, useSession } from "../../state/session";

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
        <span className="eyebrow">Presets</span>
        <h1>Common sizes, ready to apply</h1>
        <p className="lede">
          Applying a preset sets a resize operation on the selected image and opens the Resize tool.
          “Cover” fills the frame and centre-crops; “contain” fits the whole image inside it.
        </p>
      </header>

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
