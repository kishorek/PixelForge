import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;
const BASE = `http://127.0.0.1:${PORT}/PixelForge/`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: BASE,
    trace: "on-first-retry",
    acceptDownloads: true,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run build && npm run preview -w @pixelforge/web -- --host 127.0.0.1 --port 4173",
    url: BASE,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
