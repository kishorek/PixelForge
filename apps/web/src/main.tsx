import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { App } from "./App";
import { CapabilitiesProvider } from "./app/capabilities";
import { ThemeProvider } from "./app/theme";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/components.css";
import "./styles/layout.css";

const container = document.getElementById("root");
if (!container) throw new Error("Root element was not found.");

createRoot(container).render(
  <StrictMode>
    <ThemeProvider>
      <CapabilitiesProvider>
        <HashRouter>
          <App />
        </HashRouter>
      </CapabilitiesProvider>
    </ThemeProvider>
  </StrictMode>,
);
