import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureZig } from "./install-zig.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const zig = await ensureZig();
const engineDir = path.join(root, "engine", "zig");

const env = {
  ...process.env,
  PATH: `${path.dirname(zig)}${path.delimiter}${process.env.PATH ?? ""}`,
};
execFileSync(zig, ["build", ...process.argv.slice(2)], {
  cwd: engineDir,
  stdio: "inherit",
  env,
});
