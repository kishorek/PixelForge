import { createThumbnail, inspectImage } from "@pixelforge/browser-image-io";
import { LIMITS } from "@pixelforge/image-contracts";
import { useCallback, useState } from "react";
import { newId } from "../lib/errors";
import { type SessionAsset, useSession } from "../state/session";

const SUPPORTED_NAME = /\.(jpe?g|png|webp|avif)$/i;

export interface ImportResult {
  importFiles: (files: FileList | File[]) => Promise<void>;
  busy: boolean;
  errors: string[];
  clearErrors: () => void;
}

export function useImport(): ImportResult {
  const addAssets = useSession((state) => state.addAssets);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const importFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files).filter((file) => {
        if (file.type.startsWith("image/")) return true;
        return SUPPORTED_NAME.test(file.name);
      });

      if (list.length === 0) {
        setErrors(["No supported image files were found. Import a JPEG, PNG, WebP or AVIF file."]);
        return;
      }

      setBusy(true);
      setErrors([]);
      const assets: SessionAsset[] = [];
      const failures: string[] = [];

      for (const file of list) {
        try {
          const info = await inspectImage(file, file.name);
          const thumbnail = await createThumbnail(file, 320);
          const warning =
            info.size > LIMITS.largeFileBytes
              ? `This file is unusually large (${Math.round(info.size / 1024 / 1024)} MB). Processing may be slower.`
              : info.warning;
          assets.push({
            id: newId("asset"),
            name: file.name,
            mimeType: info.mimeType,
            size: info.size,
            width: info.width,
            height: info.height,
            blob: file,
            thumbnailUrl: URL.createObjectURL(thumbnail),
            previewUrl: URL.createObjectURL(file),
            warning: warning ?? undefined,
            createdAt: Date.now(),
          });
        } catch (error) {
          failures.push(`${file.name}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      if (assets.length > 0) addAssets(assets);
      setErrors(failures);
      setBusy(false);
    },
    [addAssets],
  );

  return { importFiles, busy, errors, clearErrors: () => setErrors([]) };
}
