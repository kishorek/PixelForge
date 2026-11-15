import { URL, fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const resolve = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig(() => ({
  base: process.env.VITE_BASE ?? "/PixelForge/",
  plugins: [react()],
  resolve: {
    alias: {
      "@pixelforge/image-contracts": resolve("../../packages/image-contracts/src/index.ts"),
      "@pixelforge/operation-model": resolve("../../packages/operation-model/src/index.ts"),
      "@pixelforge/browser-image-io": resolve("../../packages/browser-image-io/src/index.ts"),
      "@pixelforge/recipe-schema": resolve("../../packages/recipe-schema/src/index.ts"),
    },
  },
  worker: {
    format: "es",
  },
  build: {
    target: "es2022",
    sourcemap: false,
  },
  server: {
    port: 5173,
    host: true,
  },
  preview: {
    port: 4173,
    host: true,
  },
}));
