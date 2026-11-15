import { detectCapabilities } from "@pixelforge/browser-image-io";
import type { CapabilityReport, ImageFormat } from "@pixelforge/image-contracts";
import { type ReactNode, createContext, useContext, useEffect, useState } from "react";
import { useSession } from "../state/session";

const CapabilitiesContext = createContext<CapabilityReport | null>(null);

export function CapabilitiesProvider({ children }: { children: ReactNode }) {
  const [report, setReport] = useState<CapabilityReport | null>(null);

  useEffect(() => {
    let cancelled = false;
    detectCapabilities().then((result) => {
      if (!cancelled) setReport(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return <CapabilitiesContext.Provider value={report}>{children}</CapabilitiesContext.Provider>;
}

export function useCapabilities(): CapabilityReport | null {
  return useContext(CapabilitiesContext);
}

const PREFERENCE_ORDER: ImageFormat[] = ["webp", "jpeg", "png", "avif"];

/**
 * Keeps the persisted export format valid as capabilities are discovered.
 * Defaults to the first supported format when the stored one is unavailable.
 */
export function CapabilitySync() {
  const report = useCapabilities();
  const format = useSession((state) => state.exportSettings.format);
  const setExport = useSession((state) => state.setExport);

  useEffect(() => {
    if (!report) return;
    if (report.encode[format]) return;
    const fallback = PREFERENCE_ORDER.find((candidate) => report.encode[candidate]);
    if (fallback) setExport({ format: fallback });
  }, [report, format, setExport]);

  return null;
}
