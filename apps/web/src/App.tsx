import { Link, Route, Routes } from "react-router-dom";
import { AppShell } from "./app/AppShell";
import { CapabilitySync } from "./app/capabilities";
import { EmptyState } from "./components/ui";
import { BatchStudio } from "./features/batch/BatchStudio";
import { CollagePage } from "./features/collage/CollagePage";
import { ColourPage } from "./features/colour/ColourPage";
import { ComparePage } from "./features/compare/ComparePage";
import { EditorPage } from "./features/editor/EditorPage";
import { HelpPage } from "./features/help/HelpPage";
import { HomePage } from "./features/home/HomePage";
import { MaskPage } from "./features/mask/MaskPage";
import { MetadataPage } from "./features/metadata/MetadataPage";
import { PresetsPage } from "./features/presets/PresetsPage";
import { PrintPage } from "./features/print/PrintPage";
import { SplitPage } from "./features/split/SplitPage";
import { QuickToolPage } from "./features/tools/QuickToolPage";
import { ToolsIndexPage } from "./features/tools/ToolsIndexPage";

function NotFoundPage() {
  return (
    <div className="page">
      <EmptyState
        title="Page not found"
        action={
          <Link className="btn btn--primary" to="/">
            Back to Home
          </Link>
        }
      >
        The page you requested does not exist. Try the tool directory instead.
      </EmptyState>
    </div>
  );
}

export function App() {
  return (
    <>
      <CapabilitySync />
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="tools" element={<ToolsIndexPage />} />
          <Route path="tools/:tool" element={<QuickToolPage />} />
          <Route path="editor" element={<EditorPage />} />
          <Route path="batch" element={<BatchStudio />} />
          <Route path="colour" element={<ColourPage />} />
          <Route path="collage" element={<CollagePage />} />
          <Route path="compare" element={<ComparePage />} />
          <Route path="split" element={<SplitPage />} />
          <Route path="metadata" element={<MetadataPage />} />
          <Route path="mask" element={<MaskPage />} />
          <Route path="print" element={<PrintPage />} />
          <Route path="presets" element={<PresetsPage />} />
          <Route path="help" element={<HelpPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </>
  );
}
