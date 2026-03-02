import type { FitsMetadata } from "../fits/types";
import { isImageLikeMedia } from "../import/imageParsePipeline";

function normalizeId(id: string | null | undefined): string | null {
  if (!id) return null;
  const normalized = id.trim();
  return normalized.length > 0 ? normalized : null;
}

export function pickImageLikeIds(ids: string[], files: FitsMetadata[], limit = 2): string[] {
  const max = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 0;
  if (max === 0 || ids.length === 0 || files.length === 0) return [];

  const byId = new Map(files.map((file) => [file.id, file] as const));
  const selected: string[] = [];

  for (const raw of ids) {
    const id = normalizeId(raw);
    if (!id || selected.includes(id)) continue;
    const file = byId.get(id);
    if (!file || !isImageLikeMedia(file)) continue;
    selected.push(id);
    if (selected.length >= max) break;
  }

  return selected;
}

export function resolveComparePair(
  primaryId: string,
  files: FitsMetadata[],
  preferredId?: string | null,
): string[] {
  const normalizedPrimaryId = normalizeId(primaryId);
  if (!normalizedPrimaryId) return [];

  const imageFiles = files.filter((file) => isImageLikeMedia(file));
  if (imageFiles.length === 0) return [];

  const primaryIndex = imageFiles.findIndex((file) => file.id === normalizedPrimaryId);
  if (primaryIndex === -1) return [];

  const primary = imageFiles[primaryIndex];
  const candidates: Array<string | null> = [
    normalizeId(preferredId),
    normalizeId(primary.derivedFromId),
    imageFiles[primaryIndex + 1]?.id ?? null,
    imageFiles[primaryIndex - 1]?.id ?? null,
  ];

  for (const candidate of candidates) {
    if (!candidate || candidate === primary.id) continue;
    if (imageFiles.some((file) => file.id === candidate)) {
      return [primary.id, candidate];
    }
  }

  return [primary.id];
}
