import type { LucideIcon } from "lucide-react";
import {
  Crop,
  FileImage,
  FileText,
  Gauge,
  GitCompare,
  Grid3x3,
  LayoutGrid,
  Paintbrush,
  Palette,
  PenTool,
  Pipette,
  Printer,
  RotateCw,
  Scaling,
  Scan,
  Scissors,
  SlidersHorizontal,
  Sparkles,
  Stamp,
} from "lucide-react";

export type ToolId =
  | "convert"
  | "compress"
  | "resize"
  | "crop"
  | "rotate"
  | "watermark"
  | "adjust"
  | "filters"
  | "annotate"
  | "chroma-key"
  | "warp"
  | "quantize";

export interface ToolDefinition {
  id: ToolId;
  title: string;
  short: string;
  description: string;
  path: string;
  category: "Essentials" | "Edit" | "Overlay" | "Background" | "Advanced" | "Colour" | "Compose";
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
    description:
      "Rotate by any angle with optional corner fill, and mirror horizontally or vertically.",
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
  {
    id: "adjust",
    title: "Adjust",
    short: "Tone and colour",
    description:
      "Brightness, contrast, exposure, highlights, shadows, saturation, temperature, tint, gamma and vibrance in one non-destructive adjustment.",
    path: "/tools/adjust",
    category: "Edit",
    icon: SlidersHorizontal,
  },
  {
    id: "warp",
    title: "Perspective & distort",
    short: "Keystone and radial warp",
    description:
      "Apply a conventional vertical perspective and barrel or pincushion distortion with transparent or coloured edges.",
    path: "/tools/warp",
    category: "Advanced",
    icon: Scan,
  },
  {
    id: "filters",
    title: "Filters",
    short: "Creative looks",
    description:
      "Grayscale, sepia, invert, blur, sharpen, emboss, edge, posterize and vignette with strength control.",
    path: "/tools/filters",
    category: "Edit",
    icon: Sparkles,
  },
  {
    id: "quantize",
    title: "Quantize",
    short: "Limit colours",
    description:
      "Reduce the image to a small palette with optional ordered or Floyd–Steinberg dithering.",
    path: "/tools/quantize",
    category: "Advanced",
    icon: Grid3x3,
  },
  {
    id: "chroma-key",
    title: "Chroma key",
    short: "Remove background",
    description:
      "Pick a background colour from the image, tune tolerance and feather, then make it transparent or replace it.",
    path: "/tools/chroma-key",
    category: "Background",
    icon: Pipette,
  },
  {
    id: "annotate",
    title: "Annotate",
    short: "Shapes and frames",
    description:
      "Add rectangles, ellipses, lines and arrows, plus borders and caption plates for labels.",
    path: "/tools/annotate",
    category: "Overlay",
    icon: PenTool,
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
  {
    title: "Colour",
    description: "Inspect pixels, read histograms and extract a dominant palette.",
    path: "/colour",
    icon: Palette,
    meta: "Inspect",
  },
  {
    title: "Collage",
    description: "Compose a grid or a before/after layout and export it.",
    path: "/collage",
    icon: LayoutGrid,
    meta: "Compose",
  },
] as const;

export const POWER_TOOLS = [
  {
    title: "Compare",
    description: "Pixel diff and perceptual similarity between two queue images.",
    path: "/compare",
    icon: GitCompare,
    meta: "Diff",
  },
  {
    title: "Split",
    description: "Slice one image into a grid of tiles and download a ZIP.",
    path: "/split",
    icon: Scissors,
    meta: "Compose",
  },
  {
    title: "Metadata",
    description: "Inspect file, container, colour and EXIF metadata.",
    path: "/metadata",
    icon: FileText,
    meta: "Inspect",
  },
  {
    title: "Mask",
    description: "Paint a mask, then erase, blur or sharpen selectively with feathering.",
    path: "/mask",
    icon: Paintbrush,
    meta: "Mask",
  },
  {
    title: "Print",
    description: "Calculate print size, required pixels and DPI.",
    path: "/print",
    icon: Printer,
    meta: "Calculate",
  },
] as const;

export function getTool(id: string | undefined): ToolDefinition | undefined {
  return TOOLS.find((tool) => tool.id === id);
}

export function toolByPath(path: string): ToolDefinition | undefined {
  return TOOLS.find((tool) => tool.path === path);
}
