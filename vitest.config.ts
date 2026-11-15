import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const resolve = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@pixelforge/image-contracts": resolve("./packages/image-contracts/src/index.ts"),
      "@pixelforge/operation-model": resolve("./packages/operation-model/src/index.ts"),
      "@pixelforge/browser-image-io": resolve("./packages/browser-image-io/src/index.ts"),
      "@pixelforge/recipe-schema": resolve("./packages/recipe-schema/src/index.ts"),
    },
  },
  test: {
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts", "tests/integration/**/*.test.ts"],
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**/*.ts", "apps/web/src/services/**/*.ts"],
      exclude: ["**/*.test.ts", "**/index.ts"],
    },
  },
});
