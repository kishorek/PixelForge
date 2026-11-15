import { FORMATS } from "@pixelforge/image-contracts";
import type { Dimensions } from "@pixelforge/image-contracts";
import { formatBytes } from "@pixelforge/operation-model";
import { useSession } from "../state/session";
import { Badge } from "./ui";

export function OutputFooter({
  asset,
  dimensions,
}: {
  asset: { size: number } | null;
  dimensions: Dimensions | null;
}) {
  const format = useSession((state) => state.exportSettings.format);
  return (
    <>
      <div className="workbench__footer-info">
        <span className="muted">Output</span>
        <strong>
          {dimensions ? `${dimensions.width} × ${dimensions.height}` : "—"} ·{" "}
          {FORMATS[format].label}
        </strong>
        <span className="muted">
          Original {asset ? formatBytes(asset.size) : "—"} · processed locally
        </span>
      </div>
      <div className="row">
        <Badge tone="ok">Local only</Badge>
        <Badge>{FORMATS[format].lossy ? "Lossy" : "Lossless"}</Badge>
      </div>
    </>
  );
}
