import { Link, Route, Routes } from "react-router-dom";
import { AppShell } from "./app/AppShell";
import { CapabilitySync } from "./app/capabilities";
import { EmptyState } from "./components/ui";
import { BatchStudio } from "./features/batch/BatchStudio";
import { EditorPage } from "./features/editor/EditorPage";
import { HelpPage } from "./features/help/HelpPage";
import { HomePage } from "./features/home/HomePage";
import { PresetsPage } from "./features/presets/PresetsPage";
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
          <Route path="presets" element={<PresetsPage />} />
          <Route path="help" element={<HelpPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </>
  );
}
