import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const wasmPath = path.join(root, "apps", "web", "src", "wasm", "pixelforge.wasm");

if (!existsSync(wasmPath)) {
  console.error(`WASM artifact not found at ${wasmPath}. Run "npm run wasm:build" first.`);
  process.exit(1);
}

const requiredExports = [
  "memory",
  "pf_abi_version",
  "pf_alloc",
  "pf_free",
  "pf_last_error",
  "pf_resize_rgba",
  "pf_crop_rgba",
  "pf_flip_rgba",
  "pf_rotate90_rgba",
];

const bytes = readFileSync(wasmPath);
const { instance } = await WebAssembly.instantiate(bytes, {});
const exports = instance.exports;

const missing = requiredExports.filter((name) => !(name in exports));
if (missing.length > 0) {
  console.error(`WASM ABI validation failed. Missing exports: ${missing.join(", ")}`);
  process.exit(1);
}

const abiVersion = exports.pf_abi_version();
if (abiVersion !== 1) {
  console.error(`Unexpected ABI version ${abiVersion}, expected 1.`);
  process.exit(1);
}

const alloc = exports.pf_alloc;
const free = exports.pf_free;
const resize = exports.pf_resize_rgba;

const inputPtr = alloc(16);
const outputPtr = alloc(4);
if (!inputPtr || !outputPtr) {
  console.error("WASM allocation smoke test failed.");
  process.exit(1);
}
const memory = new Uint8Array(exports.memory.buffer);
memory.set([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 0, 255], inputPtr);
const status = resize(inputPtr, outputPtr, 2, 2, 1, 1, 1);
free(inputPtr, 16);
free(outputPtr, 4);
if (status !== 0) {
  console.error(`WASM resize smoke test failed with status ${status}.`);
  process.exit(1);
}

console.log(
  `WASM ABI v${abiVersion} verified (${bytes.length} bytes, ${requiredExports.length} exports).`,
);
