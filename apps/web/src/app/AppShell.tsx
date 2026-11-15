import * as Tooltip from "@radix-ui/react-tooltip";
import { HelpCircle, Moon, ShieldCheck, Sun, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useTheme } from "../app/theme";
import { ConfirmDialog, IconButton } from "../components/ui";
import { useSession } from "../state/session";
import { imageProcessor } from "../workers/client";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/tools", label: "Tools" },
  { to: "/editor", label: "Editor" },
  { to: "/batch", label: "Batch" },
  { to: "/presets", label: "Presets" },
  { to: "/help", label: "Help" },
] as const;

export function AppShell() {
  const { theme, toggleTheme } = useTheme();
  const assets = useSession((state) => state.assets);
  const clearSession = useSession((state) => state.clearSession);
  const [confirmClear, setConfirmClear] = useState(false);

  return (
    <Tooltip.Provider delayDuration={350}>
      <div className="shell">
        <button
          type="button"
          className="skip-link"
          onClick={() => document.getElementById("main")?.focus()}
        >
          Skip to content
        </button>

        <header className="topbar">
          <Link className="brand" to="/" aria-label="PixelForge home">
            <span className="brand__mark" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </span>
            <span>PixelForge</span>
            <span className="brand__version">v0.1</span>
          </Link>

          <nav className="main-nav" aria-label="Primary">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === "/"} className="nav-link">
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="topbar__spacer" />

          <div className="topbar__actions">
            <span className="badge badge--ok topbar__local">
              <ShieldCheck size={12} aria-hidden="true" /> Local only
            </span>
            <Link to="/help" className="icon-btn" aria-label="Help and supported formats">
              <HelpCircle size={18} aria-hidden="true" />
            </Link>
            <IconButton
              label={theme === "dark" ? "Use light theme" : "Use dark theme"}
              onClick={toggleTheme}
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </IconButton>
            <IconButton
              label="Clear session"
              onClick={() => setConfirmClear(true)}
              disabled={assets.length === 0}
            >
              <Trash2 size={18} />
            </IconButton>
          </div>
        </header>

        <main id="main" tabIndex={-1}>
          <Outlet />
        </main>
      </div>

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Clear this session?"
        description="Every imported image and unexported edit in this tab will be removed. Exported files are not affected."
        confirmLabel="Clear session"
        onConfirm={() => {
          imageProcessor.cancelAll();
          clearSession();
        }}
      />
    </Tooltip.Provider>
  );
}
