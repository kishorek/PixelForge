import type {
  Operation,
  PixelForgeError as PixelForgeErrorType,
} from "@pixelforge/image-contracts";
import { PixelForgeError } from "@pixelforge/image-contracts";
import { useEffect, useRef, useState } from "react";
import { asPixelForgeError, newId } from "../lib/errors";
import { type SessionAsset, type WatermarkImage, useSession } from "../state/session";
import { imageProcessor } from "../workers/client";

export interface PreviewState {
  url: string | null;
  width: number;
  height: number;
  busy: boolean;
  error: PixelForgeErrorType | null;
  durationMs: number | null;
}

const EMPTY: PreviewState = {
  url: null,
  width: 0,
  height: 0,
  busy: false,
  error: null,
  durationMs: null,
};

export function usePreview(
  asset: SessionAsset | null,
  operations: readonly Operation[],
  watermark: WatermarkImage | null,
  options: { enabled?: boolean; maxDimension?: number } = {},
): PreviewState {
  const exportSettings = useSession((state) => state.exportSettings);
  const exportRef = useRef(exportSettings);
  exportRef.current = exportSettings;
  const [state, setState] = useState<PreviewState>(EMPTY);
  const tokenRef = useRef(0);
  const urlRef = useRef<string | null>(null);
  const enabled = options.enabled ?? true;

  useEffect(() => {
    tokenRef.current += 1;
    const token = tokenRef.current;

    if (!asset || !enabled) {
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
      setState(EMPTY);
      return;
    }

    const timer = window.setTimeout(async () => {
      setState((previous) => ({ ...previous, busy: true, error: null }));
      try {
        const result = await imageProcessor.process({
          jobId: newId("preview"),
          source: {
            blob: asset.blob,
            name: asset.name,
            width: asset.width,
            height: asset.height,
            mimeType: asset.mimeType,
          },
          operations: operations.map((operation) => structuredClone(operation)),
          export: exportRef.current,
          preview: { maxDimension: options.maxDimension ?? 1800 },
          watermarkImage: watermark?.blob ?? null,
        });
        if (token !== tokenRef.current) return;
        const url = URL.createObjectURL(result.blob);
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = url;
        setState({
          url,
          width: result.width,
          height: result.height,
          busy: false,
          error: null,
          durationMs: result.durationMs,
        });
      } catch (error) {
        if (token !== tokenRef.current) return;
        const pixelError = asPixelForgeError(error);
        if (pixelError instanceof PixelForgeError && pixelError.code === "CANCELLED") return;
        setState((previous) => ({ ...previous, busy: false, error: pixelError }));
      }
    }, 110);

    return () => {
      window.clearTimeout(timer);
      tokenRef.current += 1;
    };
  }, [asset, operations, watermark, enabled, options.maxDimension]);

  useEffect(
    () => () => {
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    },
    [],
  );

  return state;
}
