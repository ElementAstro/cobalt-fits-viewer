import type { ObservationSession, Target, TargetRef } from "../fits/types";
import { dedupeTargetRefs, normalizeSessionTargetRefs } from "../targets/targetRefs";

export type SessionLikeInput = Partial<Omit<ObservationSession, "targetRefs" | "imageIds">> & {
  targetRefs?: TargetRef[] | null;
  targets?: string[] | null;
  imageIds?: string[] | null;
};

export type ObservationSessionWriteInput = Omit<ObservationSession, "targetRefs"> & {
  targetRefs?: TargetRef[] | null;
  targets?: string[] | null;
};

interface NormalizeSessionLikeOptions {
  targetCatalog?: Target[];
  forceTargetRefs?: boolean;
  forceImageIds?: boolean;
}

type NormalizedSessionLike<T extends SessionLikeInput> = Omit<
  T,
  "targets" | "targetRefs" | "imageIds"
> & {
  targetRefs?: TargetRef[];
  imageIds?: string[];
};

function dedupeStringArray(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (!value) continue;
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

export function normalizeSessionLike<T extends SessionLikeInput>(
  input: T,
  options: NormalizeSessionLikeOptions = {},
): NormalizedSessionLike<T> {
  const { targetCatalog = [], forceTargetRefs = false, forceImageIds = false } = options;
  const {
    targets: legacyTargets,
    targetRefs: rawTargetRefs,
    imageIds: rawImageIds,
    ...rest
  } = input;

  const normalized = { ...rest } as NormalizedSessionLike<T>;

  const shouldNormalizeTargetRefs =
    forceTargetRefs || rawTargetRefs !== undefined || legacyTargets !== undefined;
  if (shouldNormalizeTargetRefs) {
    normalized.targetRefs = dedupeTargetRefs(
      normalizeSessionTargetRefs(
        {
          targetRefs: rawTargetRefs ?? undefined,
          targets: legacyTargets ?? undefined,
        },
        targetCatalog,
      ),
      targetCatalog,
    );
  }

  if (forceImageIds || rawImageIds !== undefined) {
    normalized.imageIds = dedupeStringArray(rawImageIds ?? []);
  }

  return normalized;
}

export function mergeSessionLike(
  base: SessionLikeInput,
  incoming: SessionLikeInput,
  targetCatalog: Target[] = [],
): SessionLikeInput {
  const left = normalizeSessionLike(base, {
    targetCatalog,
    forceTargetRefs: true,
    forceImageIds: true,
  });
  const right = normalizeSessionLike(incoming, {
    targetCatalog,
    forceTargetRefs: true,
    forceImageIds: true,
  });

  const leftFilters = left.equipment?.filters ?? [];
  const rightFilters = right.equipment?.filters ?? [];
  const mergedFilters = dedupeStringArray([...leftFilters, ...rightFilters]);

  const mergedNotes = [left.notes, right.notes]
    .map((note) => note?.trim())
    .filter((note): note is string => Boolean(note))
    .join("\n");

  const hasEquipment = left.equipment !== undefined || right.equipment !== undefined;
  const mergedEquipment = hasEquipment
    ? {
        ...(left.equipment ?? {}),
        ...(right.equipment ?? {}),
        ...(mergedFilters.length > 0 ? { filters: mergedFilters } : {}),
      }
    : undefined;

  return {
    ...left,
    ...right,
    targetRefs: dedupeTargetRefs(
      [...(left.targetRefs ?? []), ...(right.targetRefs ?? [])],
      targetCatalog,
    ),
    imageIds: dedupeStringArray([...(left.imageIds ?? []), ...(right.imageIds ?? [])]),
    ...(hasEquipment ? { equipment: mergedEquipment } : {}),
    ...(mergedNotes ? { notes: mergedNotes } : { notes: undefined }),
  };
}
