import { inspectImage } from "@pixelforge/browser-image-io";
import { useState } from "react";
import { useSession } from "../state/session";

export function useWatermarkUpload() {
  const setWatermarkImage = useSession((state) => state.setWatermarkImage);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const info = await inspectImage(file, file.name);
      setWatermarkImage({
        blob: file,
        url: URL.createObjectURL(file),
        width: info.width,
        height: info.height,
        name: file.name,
      });
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : String(uploadError));
    } finally {
      setBusy(false);
    }
  };

  return { upload, busy, error, clearError: () => setError(null) };
}
