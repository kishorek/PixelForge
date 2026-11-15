import { createOperation } from "@pixelforge/operation-model";
import { describe, expect, it } from "vitest";
import { createRecipe, parseRecipe, serializeRecipe } from "./index";

const source = { width: 1200, height: 800 };
const validOperation = createOperation("resize", source, {
  width: 800,
  height: 600,
  fit: "contain",
});

describe("createRecipe and serializeRecipe", () => {
  it("round-trips through JSON", () => {
    const recipe = createRecipe("Web export", [validOperation]);
    const parsed = parseRecipe(serializeRecipe(recipe));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.recipe.name).toBe("Web export");
      expect(parsed.recipe.operations).toHaveLength(1);
      expect(parsed.recipe.schemaVersion).toBe(1);
    }
  });
});

describe("parseRecipe", () => {
  it("rejects malformed JSON", () => {
    const result = parseRecipe("{not json");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/json/i);
  });

  it("rejects an unsupported schema version", () => {
    const result = parseRecipe(
      JSON.stringify({ schemaVersion: 2, name: "x", operations: [validOperation] }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(" ")).toMatch(/version/i);
  });

  it("rejects unknown operation types", () => {
    const result = parseRecipe(
      JSON.stringify({
        schemaVersion: 1,
        name: "x",
        operations: [{ id: "1", type: "explode", enabled: true, params: {} }],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(" ")).toMatch(/unsupported/i);
  });

  it("rejects invalid operation parameters", () => {
    const result = parseRecipe(
      JSON.stringify({
        schemaVersion: 1,
        name: "x",
        operations: [
          { id: "1", type: "crop", enabled: true, params: { x: 0, y: 0, width: 0, height: 1 } },
        ],
      }),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects oversized payloads", () => {
    const operations = Array.from({ length: 200 }, () => validOperation);
    const result = parseRecipe(JSON.stringify({ schemaVersion: 1, name: "x", operations }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(" ")).toMatch(/too many/i);
  });
});
