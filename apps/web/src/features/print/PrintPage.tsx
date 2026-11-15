import { Printer } from "lucide-react";
import { useState } from "react";
import { Badge, Button, NumberField, SegmentedControl, SelectField } from "../../components/ui";
import { activeAssetOf, useSession } from "../../state/session";
import {
  type LengthUnit,
  formatLength,
  megapixels,
  pixelsForPrint,
  printSizeFromPixels,
} from "./print";

const DPI_PRESETS = [72, 150, 300, 600];

export function PrintPage() {
  const asset = useSession(activeAssetOf);
  const [pixelWidth, setPixelWidth] = useState(3000);
  const [pixelHeight, setPixelHeight] = useState(2000);
  const [dpi, setDpi] = useState(300);
  const [unit, setUnit] = useState<LengthUnit>("in");
  const [targetWidth, setTargetWidth] = useState(8);
  const [targetHeight, setTargetHeight] = useState(10);

  const printWidth = printSizeFromPixels(pixelWidth, dpi, unit);
  const printHeight = printSizeFromPixels(pixelHeight, dpi, unit);
  const requiredWidth = pixelsForPrint(targetWidth, unit, dpi);
  const requiredHeight = pixelsForPrint(targetHeight, unit, dpi);
  const dpiOptions = DPI_PRESETS.includes(dpi)
    ? DPI_PRESETS.map((value) => ({ value: String(value), label: `${value} DPI` }))
    : [
        ...DPI_PRESETS.map((value) => ({ value: String(value), label: `${value} DPI` })),
        { value: String(dpi), label: `${dpi} DPI (custom)` },
      ];

  const loadActive = () => {
    if (!asset) return;
    setPixelWidth(asset.width);
    setPixelHeight(asset.height);
  };

  return (
    <div className="page">
      <header className="page-header">
        <span className="eyebrow">Print & DPI</span>
        <h1>Size it for paper</h1>
        <p className="lede">
          Convert between pixel dimensions, physical print size and dots per inch. Calculations
          assume the image fills the stated dimensions; bleed, margins and printer resolution are
          not included.
        </p>
      </header>

      <section className="panel" style={{ marginBottom: "var(--space-5)" }}>
        <div className="panel__header">
          <h2 className="panel__title">Shared settings</h2>
          <Badge>
            <Printer size={12} aria-hidden="true" /> Print calculator
          </Badge>
        </div>
        <div className="panel__body">
          <div className="tool-layout" style={{ gap: "var(--space-4)" }}>
            <div className="row" style={{ alignItems: "flex-end" }}>
              <SelectField
                id="print-dpi-preset"
                label="DPI preset"
                value={String(dpi)}
                options={dpiOptions}
                onChange={(value) => setDpi(Number(value))}
              />
              <div style={{ flex: "0 0 140px" }}>
                <NumberField
                  id="print-dpi"
                  label="Custom DPI"
                  value={dpi}
                  min={36}
                  max={1200}
                  onChange={(value) => setDpi(Math.min(1200, Math.max(1, Math.round(value))))}
                />
              </div>
            </div>
            <div>
              <span className="field__label">Units</span>
              <SegmentedControl
                label="Print units"
                value={unit}
                options={[
                  { value: "in", label: "Inches" },
                  { value: "cm", label: "Centimetres" },
                  { value: "mm", label: "Millimetres" },
                ]}
                onChange={(value) => setUnit(value as LengthUnit)}
              />
            </div>
          </div>
        </div>
      </section>

      <div className="calculator-grid">
        <section className="panel">
          <div className="panel__header">
            <h2 className="panel__title">Print size from pixels</h2>
          </div>
          <div className="panel__body">
            <div className="row">
              <Button size="sm" onClick={loadActive} disabled={!asset}>
                Load active image
              </Button>
              {asset ? (
                <span className="field__hint">
                  {asset.name} · {asset.width}×{asset.height}
                </span>
              ) : (
                <span className="field__hint">No image in the queue</span>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
              <NumberField
                id="print-pixel-width"
                label="Pixel width"
                value={pixelWidth}
                min={1}
                max={100000}
                suffix="px"
                onChange={setPixelWidth}
              />
              <NumberField
                id="print-pixel-height"
                label="Pixel height"
                value={pixelHeight}
                min={1}
                max={100000}
                suffix="px"
                onChange={setPixelHeight}
              />
            </div>
            <div className="calc-result">
              <span className="field__label">Print size at {dpi} DPI</span>
              <span className="calc-value">
                {formatLength(printWidth, unit)} × {formatLength(printHeight, unit)}
              </span>
              <span className="field__hint">
                {megapixels(pixelWidth, pixelHeight).toFixed(1)} MP · {Math.round(pixelWidth)} ×{" "}
                {Math.round(pixelHeight)} px
              </span>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <h2 className="panel__title">Pixels needed for print</h2>
          </div>
          <div className="panel__body">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
              <NumberField
                id="print-target-width"
                label={`Print width (${unit})`}
                value={targetWidth}
                min={0.1}
                step={0.1}
                onChange={setTargetWidth}
              />
              <NumberField
                id="print-target-height"
                label={`Print height (${unit})`}
                value={targetHeight}
                min={0.1}
                step={0.1}
                onChange={setTargetHeight}
              />
            </div>
            <div className="calc-result">
              <span className="field__label">Required pixels at {dpi} DPI</span>
              <span className="calc-value">
                {requiredWidth} × {requiredHeight} px
              </span>
              <span className="field__hint">
                {megapixels(requiredWidth, requiredHeight).toFixed(1)} MP for{" "}
                {formatLength(targetWidth, unit)} × {formatLength(targetHeight, unit)}
              </span>
            </div>
            <p className="field__hint">
              Use 300 DPI for typical photo prints. Large-format prints can use a lower DPI at
              normal viewing distance.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
