import type { LucideIcon } from "lucide-react";
import {
  Crop,
  FileImage,
  Gauge,
  LayoutGrid,
  RotateCw,
  Scaling,
  SlidersHorizontal,
  Stamp,
} from "lucide-react";

export type ToolId = "convert" | "compress" | "resize" | "crop" | "rotate" | "watermark";

export interface ToolDefinition {
  id: ToolId;
  title: string;
  short: string;
  description: string;
  path: string;
  category: "Essentials" | "Overlay";
  icon: LucideIcon;
}

export const TOOLS: readonly ToolDefinition[] = [
  {
    id: "convert",
    title: "Convert",
    short: "Change format",
    description:
      "Convert between the formats this browser can encode, with quality and transparency controls.",
    path: "/tools/convert",
    category: "Essentials",
    icon: FileImage,
  },
  {
    id: "compress",
    title: "Compress",
    short: "Shrink files",
    description:
      "Reduce file size with quality control or a best-effort target size. Your original stays untouched.",
    path: "/tools/compress",
    category: "Essentials",
    icon: Gauge,
  },
  {
    id: "resize",
    title: "Resize",
    short: "Change dimensions",
    description:
      "Resize by pixels or percentage with aspect-ratio lock, fit modes and WASM resampling.",
    path: "/tools/resize",
    category: "Essentials",
    icon: Scaling,
  },
  {
    id: "crop",
    title: "Crop",
    short: "Reframe",
    description:
      "Drag a freeform crop or pick a common aspect ratio, then export at the cropped size.",
    path: "/tools/crop",
    category: "Essentials",
    icon: Crop,
  },
  {
    id: "rotate",
    title: "Rotate & flip",
    short: "Fix orientation",
    description: "Rotate by right angles and mirror horizontally or vertically.",
    path: "/tools/rotate",
    category: "Essentials",
    icon: RotateCw,
  },
  {
    id: "watermark",
    title: "Watermark",
    short: "Brand images",
    description:
      "Add text or a logo with position, scale, opacity, margin and tiled watermark options.",
    path: "/tools/watermark",
    category: "Overlay",
    icon: Stamp,
  },
] as const;

export const EXTRA_WORKSPACES = [
  {
    title: "Editor",
    description: "Stack operations, compare against the original, and undo changes.",
    path: "/editor",
    icon: SlidersHorizontal,
    meta: "Multi-step",
  },
  {
    title: "Batch Studio",
    description: "Apply one recipe to a whole queue and download a ZIP.",
    path: "/batch",
    icon: LayoutGrid,
    meta: "Multi-image",
  },
] as const;

export function getTool(id: string | undefined): ToolDefinition | undefined {
  return TOOLS.find((tool) => tool.id === id);
}

export function toolByPath(path: string): ToolDefinition | undefined {
  return TOOLS.find((tool) => tool.path === path);
}
