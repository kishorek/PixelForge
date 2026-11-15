import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureZig } from "./install-zig.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "apps", "web", "src", "wasm");
const builtWasm = path.join(root, "engine", "zig", "zig-out", "bin", "pixelforge.wasm");
const targetWasm = path.join(outDir, "pixelforge.wasm");
const manifestPath = path.join(outDir, "wasm-manifest.json");

const zig = await ensureZig();
const env = {
  ...process.env,
  PATH: `${path.dirname(zig)}${path.delimiter}${process.env.PATH ?? ""}`,
};
const { execFileSync } = await import("node:child_process");
execFileSync(zig, ["build", "-Doptimize=ReleaseSmall"], {
  cwd: path.join(root, "engine", "zig"),
  stdio: "inherit",
  env,
});

if (!existsSync(builtWasm)) throw new Error(`WASM artifact missing at ${builtWasm}`);

mkdirSync(outDir, { recursive: true });
copyFileSync(builtWasm, targetWasm);

const bytes = readFileSync(targetWasm);
const sha256 = createHash("sha256").update(bytes).digest("hex");
writeFileSync(
  manifestPath,
  `${JSON.stringify(
    {
      name: "pixelforge",
      abiVersion: 1,
      bytes: statSync(targetWasm).size,
      sha256,
      builtAt: new Date().toISOString(),
    },
    null,
    2,
  )}\n`,
);
console.log(`WASM built: ${statSync(targetWasm).size} bytes, sha256 ${sha256.slice(0, 12)}...`);
