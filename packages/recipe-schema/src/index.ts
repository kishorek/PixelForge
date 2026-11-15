import { PixelForgeError } from "@pixelforge/image-contracts";
import type { ExportSettings, Operation } from "@pixelforge/image-contracts";
import { validateOperation } from "@pixelforge/operation-model";

export const RECIPE_SCHEMA_VERSION = 1;
export const MAX_RECIPE_OPERATIONS = 100;
export const MAX_RECIPE_BYTES = 256 * 1024;

export interface Recipe {
  schemaVersion: 1;
  name: string;
  operations: Operation[];
  export?: Partial<ExportSettings>;
}

export type RecipeParseResult = { ok: true; recipe: Recipe } | { ok: false; errors: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOperation(value: unknown): value is Operation {
  if (!isRecord(value)) return false;
  if (typeof value.id !== "string" || typeof value.enabled !== "boolean") return false;
  if (typeof value.type !== "string" || !isRecord(value.params)) return false;

  const params = value.params;
  switch (value.type) {
    case "resize":
      return (
        typeof params.width === "number" &&
        typeof params.height === "number" &&
        (params.percent === null || typeof params.percent === "number") &&
        typeof params.fit === "string" &&
        typeof params.resampling === "string" &&
        typeof params.lockAspect === "boolean"
      );
    case "crop":
      return (
        typeof params.x === "number" &&
        typeof params.y === "number" &&
        typeof params.width === "number" &&
        typeof params.height === "number"
      );
    case "rotate":
      return typeof params.angle === "number";
    case "flip":
      return typeof params.direction === "string";
    case "watermark-text":
      return (
        typeof params.text === "string" &&
        typeof params.fontFamily === "string" &&
        typeof params.sizeRatio === "number" &&
        typeof params.color === "string" &&
        typeof params.opacity === "number" &&
        typeof params.anchor === "string" &&
        typeof params.marginRatio === "number" &&
        typeof params.tile === "boolean"
      );
    case "watermark-image":
      return (
        typeof params.scaleRatio === "number" &&
        typeof params.opacity === "number" &&
        typeof params.anchor === "string" &&
        typeof params.marginRatio === "number" &&
        typeof params.tile === "boolean"
      );
    default:
      return false;
  }
}

export function parseRecipe(text: string): RecipeParseResult {
  if (text.length > MAX_RECIPE_BYTES) {
    return { ok: false, errors: ["Recipe payload is too large."] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, errors: ["Recipe is not valid JSON."] };
  }

  if (!isRecord(parsed)) return { ok: false, errors: ["Recipe must be a JSON object."] };
  if (parsed.schemaVersion !== RECIPE_SCHEMA_VERSION) {
    return {
      ok: false,
      errors: [`Unsupported schema version. Expected ${RECIPE_SCHEMA_VERSION}.`],
    };
  }
  if (typeof parsed.name !== "string" || parsed.name.trim().length === 0) {
    return { ok: false, errors: ["Recipe name is required."] };
  }
  if (!Array.isArray(parsed.operations)) {
    return { ok: false, errors: ["Recipe operations must be an array."] };
  }
  if (parsed.operations.length > MAX_RECIPE_OPERATIONS) {
    return { ok: false, errors: ["Recipe contains too many operations."] };
  }

  const errors: string[] = [];
  const operations: Operation[] = [];
  parsed.operations.forEach((candidate, index) => {
    if (!isOperation(candidate)) {
      errors.push(`Operation ${index + 1} has an unsupported type or malformed parameters.`);
      return;
    }
    const problems = validateOperation(candidate);
    if (problems.length > 0) errors.push(`Operation ${index + 1}: ${problems.join(" ")}`);
    operations.push(candidate);
  });

  if (errors.length > 0) return { ok: false, errors };

  const recipe: Recipe = {
    schemaVersion: RECIPE_SCHEMA_VERSION,
    name: parsed.name.trim().slice(0, 120),
    operations,
  };
  if (isRecord(parsed.export)) {
    recipe.export = sanitiseExport(parsed.export);
  }
  return { ok: true, recipe };
}

function sanitiseExport(value: Record<string, unknown>): Partial<ExportSettings> {
  const result: Partial<ExportSettings> = {};
  if (
    value.format === "jpeg" ||
    value.format === "png" ||
    value.format === "webp" ||
    value.format === "avif"
  ) {
    result.format = value.format;
  }
  if (typeof value.quality === "number" && value.quality >= 0 && value.quality <= 1) {
    result.quality = value.quality;
  }
  if (typeof value.background === "string") result.background = value.background;
  if (typeof value.filenameTemplate === "string") {
    result.filenameTemplate = value.filenameTemplate.slice(0, 120);
  }
  if (value.targetSizeBytes === null) result.targetSizeBytes = null;
  return result;
}

export function createRecipe(
  name: string,
  operations: readonly Operation[],
  exportSettings?: Partial<ExportSettings>,
): Recipe {
  if (name.trim().length === 0)
    throw new PixelForgeError("INVALID_INPUT", "Recipe name is required.");
  if (operations.length > MAX_RECIPE_OPERATIONS) {
    throw new PixelForgeError("INVALID_INPUT", "Recipe contains too many operations.");
  }
  for (const operation of operations) {
    const problems = validateOperation(operation);
    if (problems.length > 0) {
      throw new PixelForgeError("INVALID_INPUT", problems.join(" "));
    }
  }
  return {
    schemaVersion: RECIPE_SCHEMA_VERSION,
    name: name.trim(),
    operations: operations.map((operation) => structuredClone(operation)),
    export: exportSettings ? structuredClone(exportSettings) : undefined,
  };
}

export function serializeRecipe(recipe: Recipe): string {
  return JSON.stringify(recipe);
}
