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
  "pf_resize_kernel_rgba",
  "pf_crop_rgba",
  "pf_flip_rgba",
  "pf_rotate90_rgba",
  "pf_adjust_rgba",
  "pf_filter_rgba",
  "pf_histogram_rgba",
  "pf_chroma_key_rgba",
  "pf_warp_rgba",
  "pf_diff_rgba",
  "pf_perceptual_hash_rgba",
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

const adjust = exports.pf_adjust_rgba;
const adjustPtr = alloc(4);
new Uint8Array(exports.memory.buffer).set([100, 100, 100, 255], adjustPtr);
const adjustStatus = adjust(adjustPtr, 1, 1, 50, 0, 0, 0, 0, 0, 0, 0, 1, 0);
const adjustedRed = new Uint8Array(exports.memory.buffer)[adjustPtr];
free(adjustPtr, 4);
if (adjustStatus !== 0 || adjustedRed <= 150) {
  console.error("WASM adjustment smoke test failed.");
  process.exit(1);
}

const filter = exports.pf_filter_rgba;
const filterPtr = alloc(4);
const scratchPtr = alloc(4);
new Uint8Array(exports.memory.buffer).set([255, 0, 0, 255], filterPtr);
const filterStatus = filter(filterPtr, scratchPtr, 1, 1, 0, 1);
const filtered = new Uint8Array(exports.memory.buffer).slice(filterPtr, filterPtr + 4);
free(filterPtr, 4);
free(scratchPtr, 4);
if (filterStatus !== 0 || filtered[0] !== filtered[1] || filtered[1] !== filtered[2]) {
  console.error("WASM filter smoke test failed.");
  process.exit(1);
}

const histogram = exports.pf_histogram_rgba;
const histogramRaw = alloc(4100);
const histogramPtr = Math.ceil(histogramRaw / 4) * 4;
const histogramInput = alloc(4);
new Uint8Array(exports.memory.buffer).set([255, 0, 0, 255], histogramInput);
const histogramStatus = histogram(histogramInput, 1, 1, histogramPtr);
const counts = new Uint32Array(exports.memory.buffer, histogramPtr, 1024);
const histogramOk = counts[255] === 1 && counts[256] === 1 && counts[512] === 1;
free(histogramRaw, 4100);
free(histogramInput, 4);
if (histogramStatus !== 0 || !histogramOk) {
  console.error("WASM histogram smoke test failed.");
  process.exit(1);
}

const diff = exports.pf_diff_rgba;
const diffA = alloc(4);
const diffB = alloc(4);
const diffOut = alloc(4);
new Uint8Array(exports.memory.buffer).set([255, 0, 0, 255], diffA);
new Uint8Array(exports.memory.buffer).set([0, 0, 0, 255], diffB);
const diffStatus = diff(diffA, diffB, diffOut, 1, 1, 1);
const diffValue = new Uint8Array(exports.memory.buffer)[diffOut];
free(diffA, 4);
free(diffB, 4);
free(diffOut, 4);
if (diffStatus !== 0 || diffValue !== 255) {
  console.error("WASM diff smoke test failed.");
  process.exit(1);
}

console.log(
  `WASM ABI v${abiVersion} verified (${bytes.length} bytes, ${requiredExports.length} exports).`,
);
