import type { ExportSettings, Operation } from "@pixelforge/image-contracts";
import { type Recipe, createRecipe, parseRecipe, serializeRecipe } from "@pixelforge/recipe-schema";
import { useCallback, useState } from "react";

const STORAGE_KEY = "pixelforge.recipes";
const MAX_RECIPES = 40;

function readStorage(): Recipe[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const recipes: Recipe[] = [];
    for (const candidate of parsed.slice(0, MAX_RECIPES)) {
      const result = parseRecipe(JSON.stringify(candidate));
      if (result.ok) recipes.push(result.recipe);
    }
    return recipes;
  } catch {
    return [];
  }
}

function writeStorage(recipes: Recipe[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recipes.slice(0, MAX_RECIPES)));
  } catch {
    // Storage can be unavailable in private modes; recipes remain in memory.
  }
}

export type RecipeImportResult = { ok: true; recipe: Recipe } | { ok: false; errors: string[] };

export function useRecipes() {
  const [recipes, setRecipes] = useState<Recipe[]>(readStorage);

  const update = useCallback((updater: (current: Recipe[]) => Recipe[]) => {
    setRecipes((current) => {
      const next = updater(current).slice(0, MAX_RECIPES);
      writeStorage(next);
      return next;
    });
  }, []);

  const saveRecipe = useCallback(
    (
      name: string,
      operations: readonly Operation[],
      exportSettings?: Partial<ExportSettings>,
    ): Recipe => {
      const recipe = createRecipe(name, operations, exportSettings);
      update((current) => [recipe, ...current.filter((item) => item.name !== recipe.name)]);
      return recipe;
    },
    [update],
  );

  const removeRecipe = useCallback(
    (name: string) => {
      update((current) => current.filter((recipe) => recipe.name !== name));
    },
    [update],
  );

  const importRecipe = useCallback(
    (text: string): RecipeImportResult => {
      const result = parseRecipe(text);
      if (!result.ok) return { ok: false, errors: result.errors };
      update((current) => [
        result.recipe,
        ...current.filter((item) => item.name !== result.recipe.name),
      ]);
      return { ok: true, recipe: result.recipe };
    },
    [update],
  );

  const exportRecipe = useCallback((recipe: Recipe) => serializeRecipe(recipe), []);

  return {
    recipes,
    saveRecipe,
    removeRecipe,
    importRecipe,
    exportRecipe,
  };
}
