import { execFileSync } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readdirSync, renameSync, rmSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { finished } from "node:stream/promises";
import { fileURLToPath } from "node:url";

export const ZIG_VERSION = "0.14.1";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const toolsDir = path.join(root, ".tools");
const zigDir = path.join(toolsDir, "zig");
const zigBin = path.join(zigDir, "zig");

function archiveName() {
  const arch = process.arch === "arm64" ? "aarch64" : "x86_64";
  if (process.platform === "linux") return `zig-${arch}-linux-${ZIG_VERSION}`;
  if (process.platform === "darwin") return `zig-${arch}-macos-${ZIG_VERSION}`;
  throw new Error(`Unsupported platform for the pinned Zig toolchain: ${process.platform}`);
}

async function download(url, destination) {
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download Zig from ${url}: ${response.status}`);
  }
  await finished(Readable.fromWeb(response.body).pipe(createWriteStream(destination)));
}

export async function ensureZig() {
  if (existsSync(zigBin)) return zigBin;

  mkdirSync(toolsDir, { recursive: true });
  const name = archiveName();
  const archive = path.join(toolsDir, `${name}.tar.xz`);
  const url = `https://ziglang.org/download/${ZIG_VERSION}/${name}.tar.xz`;

  console.log(`Provisioning Zig ${ZIG_VERSION} (${name})...`);
  await download(url, archive);
  execFileSync("tar", ["-xf", archive, "-C", toolsDir], { stdio: "inherit" });
  rmSync(archive, { force: true });

  const extracted = readdirSync(toolsDir).find((entry) => entry.startsWith(name));
  if (!extracted) throw new Error("Zig archive extracted an unexpected directory layout.");
  rmSync(zigDir, { recursive: true, force: true });
  renameSync(path.join(toolsDir, extracted), zigDir);

  if (!existsSync(zigBin)) throw new Error("Zig binary was not found after extraction.");
  console.log(`Zig ${ZIG_VERSION} ready at ${zigBin}`);
  return zigBin;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  ensureZig().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
