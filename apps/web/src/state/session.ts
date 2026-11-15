import { FORMATS } from "@pixelforge/image-contracts";
import type { ExportSettings, ImageAsset, Operation } from "@pixelforge/image-contracts";
import { create } from "zustand";

export interface SessionAsset extends ImageAsset {
  thumbnailUrl: string;
  previewUrl: string;
}

export interface WatermarkImage {
  blob: Blob;
  url: string;
  width: number;
  height: number;
  name: string;
}

interface History {
  past: Operation[][];
  future: Operation[][];
}

export interface SessionState {
  assets: SessionAsset[];
  activeId: string | null;
  operationsByAsset: Record<string, Operation[]>;
  historyByAsset: Record<string, History>;
  batchOperations: Operation[];
  exportSettings: ExportSettings;
  watermarkImage: WatermarkImage | null;
  recentTools: string[];
  addAssets: (assets: SessionAsset[]) => void;
  removeAsset: (id: string) => void;
  clearAssets: () => void;
  setActive: (id: string | null) => void;
  addOperation: (assetId: string, operation: Operation) => void;
  updateOperation: (assetId: string, operationId: string, operation: Operation) => void;
  removeOperation: (assetId: string, operationId: string) => void;
  moveOperation: (assetId: string, operationId: string, direction: -1 | 1) => void;
  toggleOperation: (assetId: string, operationId: string) => void;
  resetOperations: (assetId: string) => void;
  setBatchOperations: (operations: Operation[]) => void;
  setExport: (patch: Partial<ExportSettings>) => void;
  setWatermarkImage: (image: WatermarkImage | null) => void;
  recordTool: (tool: string) => void;
  undo: (assetId: string) => void;
  redo: (assetId: string) => void;
  clearSession: () => void;
}

const DEFAULT_EXPORT: ExportSettings = {
  format: "webp",
  quality: 0.9,
  background: "#ffffff",
  targetSizeBytes: null,
  filenameTemplate: "{name}-{width}x{height}",
};

const EXPORT_STORAGE_KEY = "pixelforge.export-settings";
const RECENT_STORAGE_KEY = "pixelforge.recent-tools";

function loadExportSettings(): ExportSettings {
  if (typeof localStorage === "undefined") return DEFAULT_EXPORT;
  try {
    const raw = localStorage.getItem(EXPORT_STORAGE_KEY);
    if (!raw) return DEFAULT_EXPORT;
    const parsed = JSON.parse(raw) as Partial<ExportSettings>;
    const settings: ExportSettings = { ...DEFAULT_EXPORT, ...parsed };
    if (!(settings.format in FORMATS)) settings.format = DEFAULT_EXPORT.format;
    if (!Number.isFinite(settings.quality) || settings.quality <= 0 || settings.quality > 1) {
      settings.quality = DEFAULT_EXPORT.quality;
    }
    if (typeof settings.background !== "string" || settings.background.length === 0) {
      settings.background = DEFAULT_EXPORT.background;
    }
    if (
      settings.targetSizeBytes !== null &&
      (!Number.isFinite(settings.targetSizeBytes) || settings.targetSizeBytes <= 0)
    ) {
      settings.targetSizeBytes = null;
    }
    if (typeof settings.filenameTemplate !== "string" || settings.filenameTemplate.trim() === "") {
      settings.filenameTemplate = DEFAULT_EXPORT.filenameTemplate;
    }
    return settings;
  } catch {
    return DEFAULT_EXPORT;
  }
}

function loadRecentTools(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function persistExport(settings: ExportSettings): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(EXPORT_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage can be unavailable in private modes; preferences are non-critical.
  }
}

function clone(operations: readonly Operation[]): Operation[] {
  return operations.map((operation) => structuredClone(operation));
}

function recordHistory(state: SessionState, assetId: string): Record<string, History> {
  const current = state.operationsByAsset[assetId] ?? [];
  const history = state.historyByAsset[assetId] ?? { past: [], future: [] };
  return {
    ...state.historyByAsset,
    [assetId]: {
      past: [...history.past.slice(-49), clone(current)],
      future: [],
    },
  };
}

export const useSession = create<SessionState>((set, get) => ({
  assets: [],
  activeId: null,
  operationsByAsset: {},
  historyByAsset: {},
  batchOperations: [],
  exportSettings: loadExportSettings(),
  watermarkImage: null,
  recentTools: loadRecentTools(),

  addAssets: (incoming) =>
    set((state) => {
      const assets = [...state.assets, ...incoming];
      const operationsByAsset = { ...state.operationsByAsset };
      const historyByAsset = { ...state.historyByAsset };
      for (const asset of incoming) {
        operationsByAsset[asset.id] = operationsByAsset[asset.id] ?? [];
        historyByAsset[asset.id] = historyByAsset[asset.id] ?? { past: [], future: [] };
      }
      return {
        assets,
        operationsByAsset,
        historyByAsset,
        activeId: state.activeId ?? incoming[0]?.id ?? null,
      };
    }),

  removeAsset: (id) =>
    set((state) => {
      const asset = state.assets.find((candidate) => candidate.id === id);
      if (asset) {
        URL.revokeObjectURL(asset.thumbnailUrl);
        URL.revokeObjectURL(asset.previewUrl);
      }
      const remaining = state.assets.filter((candidate) => candidate.id !== id);
      const operationsByAsset = { ...state.operationsByAsset };
      const historyByAsset = { ...state.historyByAsset };
      delete operationsByAsset[id];
      delete historyByAsset[id];
      return {
        assets: remaining,
        operationsByAsset,
        historyByAsset,
        activeId: state.activeId === id ? (remaining[0]?.id ?? null) : state.activeId,
      };
    }),

  clearAssets: () =>
    set((state) => {
      for (const asset of state.assets) {
        URL.revokeObjectURL(asset.thumbnailUrl);
        URL.revokeObjectURL(asset.previewUrl);
      }
      return { assets: [], activeId: null, operationsByAsset: {}, historyByAsset: {} };
    }),

  setActive: (id) => set({ activeId: id }),

  addOperation: (assetId, operation) =>
    set((state) => ({
      operationsByAsset: {
        ...state.operationsByAsset,
        [assetId]: [...(state.operationsByAsset[assetId] ?? []), operation],
      },
      historyByAsset: recordHistory(state, assetId),
    })),

  updateOperation: (assetId, operationId, operation) =>
    set((state) => ({
      operationsByAsset: {
        ...state.operationsByAsset,
        [assetId]: (state.operationsByAsset[assetId] ?? []).map((candidate) =>
          candidate.id === operationId ? operation : candidate,
        ),
      },
      historyByAsset: recordHistory(state, assetId),
    })),

  removeOperation: (assetId, operationId) =>
    set((state) => ({
      operationsByAsset: {
        ...state.operationsByAsset,
        [assetId]: (state.operationsByAsset[assetId] ?? []).filter(
          (candidate) => candidate.id !== operationId,
        ),
      },
      historyByAsset: recordHistory(state, assetId),
    })),

  moveOperation: (assetId, operationId, direction) =>
    set((state) => {
      const operations = [...(state.operationsByAsset[assetId] ?? [])];
      const index = operations.findIndex((candidate) => candidate.id === operationId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= operations.length) return {};
      const [moved] = operations.splice(index, 1);
      if (!moved) return {};
      operations.splice(target, 0, moved);
      return {
        operationsByAsset: { ...state.operationsByAsset, [assetId]: operations },
        historyByAsset: recordHistory(state, assetId),
      };
    }),

  toggleOperation: (assetId, operationId) =>
    set((state) => ({
      operationsByAsset: {
        ...state.operationsByAsset,
        [assetId]: (state.operationsByAsset[assetId] ?? []).map((candidate) =>
          candidate.id === operationId ? { ...candidate, enabled: !candidate.enabled } : candidate,
        ),
      },
      historyByAsset: recordHistory(state, assetId),
    })),

  resetOperations: (assetId) =>
    set((state) => ({
      operationsByAsset: { ...state.operationsByAsset, [assetId]: [] },
      historyByAsset: recordHistory(state, assetId),
    })),

  setBatchOperations: (operations) => set({ batchOperations: operations }),

  setExport: (patch) =>
    set((state) => {
      const exportSettings = { ...state.exportSettings, ...patch };
      persistExport(exportSettings);
      return { exportSettings };
    }),

  setWatermarkImage: (image) =>
    set((state) => {
      if (state.watermarkImage?.url) URL.revokeObjectURL(state.watermarkImage.url);
      return { watermarkImage: image };
    }),

  recordTool: (tool) =>
    set((state) => {
      const recentTools = [tool, ...state.recentTools.filter((item) => item !== tool)].slice(0, 4);
      if (typeof localStorage !== "undefined") {
        try {
          localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(recentTools));
        } catch {
          // Ignored: recent tools are a convenience only.
        }
      }
      return { recentTools };
    }),

  undo: (assetId) =>
    set((state) => {
      const history = state.historyByAsset[assetId];
      const current = state.operationsByAsset[assetId] ?? [];
      const previous = history?.past.at(-1);
      if (!history || !previous) return {};
      return {
        operationsByAsset: { ...state.operationsByAsset, [assetId]: clone(previous) },
        historyByAsset: {
          ...state.historyByAsset,
          [assetId]: {
            past: history.past.slice(0, -1),
            future: [clone(current), ...history.future].slice(0, 50),
          },
        },
      };
    }),

  redo: (assetId) =>
    set((state) => {
      const history = state.historyByAsset[assetId];
      const current = state.operationsByAsset[assetId] ?? [];
      const next = history?.future[0];
      if (!history || !next) return {};
      return {
        operationsByAsset: { ...state.operationsByAsset, [assetId]: clone(next) },
        historyByAsset: {
          ...state.historyByAsset,
          [assetId]: {
            past: [...history.past.slice(-49), clone(current)],
            future: history.future.slice(1),
          },
        },
      };
    }),

  clearSession: () => {
    const watermark = get().watermarkImage;
    if (watermark?.url) URL.revokeObjectURL(watermark.url);
    get().clearAssets();
    set({ watermarkImage: null, batchOperations: [] });
  },
}));

export function activeAssetOf(state: SessionState): SessionAsset | null {
  return state.assets.find((asset) => asset.id === state.activeId) ?? null;
}

export function activeOperationsOf(state: SessionState): Operation[] {
  return state.activeId ? (state.operationsByAsset[state.activeId] ?? []) : [];
}

export function historyOf(state: SessionState, assetId: string | null): History {
  if (!assetId) return { past: [], future: [] };
  return state.historyByAsset[assetId] ?? { past: [], future: [] };
}

export { DEFAULT_EXPORT };
