import type { Dimensions, Operation } from "@pixelforge/image-contracts";
import { outputDimensions } from "@pixelforge/operation-model";

export function safeOutputDimensions(
  asset: { width: number; height: number },
  operations: readonly Operation[],
): Dimensions | null {
  try {
    return outputDimensions({ width: asset.width, height: asset.height }, operations);
  } catch {
    return null;
  }
}

export function sourceDimensionsFor(
  asset: { width: number; height: number },
  operations: readonly Operation[],
  operationId: string,
): Dimensions {
  const index = operations.findIndex((operation) => operation.id === operationId);
  if (index <= 0) return { width: asset.width, height: asset.height };
  return (
    safeOutputDimensions(asset, operations.slice(0, index)) ?? {
      width: asset.width,
      height: asset.height,
    }
  );
}
