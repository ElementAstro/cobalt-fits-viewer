import type { FitsMetadata, ObservationSession, Target, TargetGroup } from "../fits/types";
import { matchTargetByName, mergeTargets, normalizeName } from "./targetMatcher";

export interface NormalizedTargetMatchInput {
  name?: string;
  aliases?: string[];
  targets: Target[];
}

export interface TargetGraphInput {
  targets: Target[];
  files: FitsMetadata[];
  groups?: TargetGroup[];
  sessions?: ObservationSession[];
}

export interface TargetGraphPatch {
  targets: Target[];
  files: FitsMetadata[];
  groups: TargetGroup[];
  sessions: ObservationSession[];
  changed: boolean;
}

function toUniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    ordered.push(value);
  }
  return ordered;
}

function arrayEquals(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function pickNewestTarget(targets: Target[]): Target {
  return [...targets].sort((a, b) => {
    if (a.updatedAt !== b.updatedAt) return b.updatedAt - a.updatedAt;
    return b.createdAt - a.createdAt;
  })[0];
}

export function normalizeTargetMatch({
  name,
  aliases = [],
  targets,
}: NormalizedTargetMatchInput): Target | null {
  const candidates = toUniqueStrings(
    [name ?? "", ...aliases].map((value) => value.trim()).filter(Boolean),
  );
  if (candidates.length === 0) return null;

  for (const candidate of candidates) {
    const matched = matchTargetByName(candidate, targets);
    if (matched) return matched;
  }

  const normalizedCandidates = new Set(
    candidates.map((value) => normalizeName(value).toLowerCase()),
  );
  for (const target of targets) {
    const names = [target.name, ...target.aliases].map((value) =>
      normalizeName(value).toLowerCase(),
    );
    if (names.some((value) => normalizedCandidates.has(value))) {
      return target;
    }
  }

  return null;
}

export function computeTargetFileReconciliation({
  targets,
  files,
  groups = [],
  sessions = [],
}: TargetGraphInput): TargetGraphPatch {
  const validFileIds = new Set(files.map((file) => file.id));
  const targetById = new Map(targets.map((target) => [target.id, target]));
  const validTargetIds = new Set(targetById.keys());

  const sanitizedFiles = files.map((file) => {
    if (!file.targetId || validTargetIds.has(file.targetId)) return file;
    return { ...file, targetId: undefined };
  });

  const fileTargetCandidates = new Map<string, Target[]>();
  for (const target of targets) {
    const dedupedImageIds = toUniqueStrings(target.imageIds).filter((imageId) =>
      validFileIds.has(imageId),
    );
    for (const imageId of dedupedImageIds) {
      const list = fileTargetCandidates.get(imageId);
      if (list) {
        list.push(target);
      } else {
        fileTargetCandidates.set(imageId, [target]);
      }
    }
  }

  const fileAssignment = new Map<string, string | undefined>();
  for (const file of sanitizedFiles) {
    if (file.targetId && validTargetIds.has(file.targetId)) {
      fileAssignment.set(file.id, file.targetId);
      continue;
    }

    const candidates = fileTargetCandidates.get(file.id) ?? [];
    if (candidates.length === 1) {
      fileAssignment.set(file.id, candidates[0].id);
      continue;
    }

    if (candidates.length > 1) {
      fileAssignment.set(file.id, pickNewestTarget(candidates).id);
      continue;
    }

    fileAssignment.set(file.id, undefined);
  }

  const imageIdsByTarget = new Map<string, Set<string>>();
  for (const [fileId, targetId] of fileAssignment.entries()) {
    if (!targetId) continue;
    const bucket = imageIdsByTarget.get(targetId);
    if (bucket) {
      bucket.add(fileId);
    } else {
      imageIdsByTarget.set(targetId, new Set([fileId]));
    }
  }

  let targetsChanged = false;
  const reconciledTargets = targets.map((target) => {
    const assignedSet = imageIdsByTarget.get(target.id) ?? new Set<string>();
    const orderedImageIds = target.imageIds.filter((imageId) => assignedSet.has(imageId));
    for (const imageId of assignedSet) {
      if (!orderedImageIds.includes(imageId)) {
        orderedImageIds.push(imageId);
      }
    }

    const cleanedRatings: Record<string, number> = {};
    for (const [imageId, rating] of Object.entries(target.imageRatings)) {
      if (assignedSet.has(imageId)) {
        cleanedRatings[imageId] = rating;
      }
    }

    const nextBestImageId =
      target.bestImageId && assignedSet.has(target.bestImageId) ? target.bestImageId : undefined;

    const imageIdsChanged = !arrayEquals(target.imageIds, orderedImageIds);
    const ratingsChanged =
      Object.keys(cleanedRatings).length !== Object.keys(target.imageRatings).length;
    const bestImageChanged = target.bestImageId !== nextBestImageId;
    if (!imageIdsChanged && !ratingsChanged && !bestImageChanged) return target;

    targetsChanged = true;
    return {
      ...target,
      imageIds: orderedImageIds,
      imageRatings: cleanedRatings,
      bestImageId: nextBestImageId,
      updatedAt: Date.now(),
    };
  });

  let filesChanged = false;
  const reconciledFiles = sanitizedFiles.map((file) => {
    const assignedTargetId = fileAssignment.get(file.id);
    if (file.targetId === assignedTargetId) return file;
    filesChanged = true;
    return { ...file, targetId: assignedTargetId };
  });

  let groupsChanged = false;
  const reconciledGroups = groups.map((group) => {
    const normalizedTargetIds = toUniqueStrings(group.targetIds).filter((targetId) =>
      validTargetIds.has(targetId),
    );
    if (arrayEquals(group.targetIds, normalizedTargetIds)) return group;
    groupsChanged = true;
    return {
      ...group,
      targetIds: normalizedTargetIds,
      updatedAt: Date.now(),
    };
  });

  const validTargetNames = new Set(reconciledTargets.map((target) => target.name));
  let sessionsChanged = false;
  const reconciledSessions = sessions.map((session) => {
    const normalizedTargetNames = toUniqueStrings(session.targets).filter((name) =>
      validTargetNames.has(name),
    );
    const normalizedImageIds = toUniqueStrings(session.imageIds).filter((imageId) =>
      validFileIds.has(imageId),
    );
    if (
      arrayEquals(session.targets, normalizedTargetNames) &&
      arrayEquals(session.imageIds, normalizedImageIds)
    ) {
      return session;
    }
    sessionsChanged = true;
    return {
      ...session,
      targets: normalizedTargetNames,
      imageIds: normalizedImageIds,
    };
  });

  return {
    targets: reconciledTargets,
    files: reconciledFiles,
    groups: reconciledGroups,
    sessions: reconciledSessions,
    changed: targetsChanged || filesChanged || groupsChanged || sessionsChanged,
  };
}

export function computeMergeRelinkPatch(
  input: TargetGraphInput & { destId: string; sourceId: string },
): TargetGraphPatch {
  const { destId, sourceId, targets, files, groups = [], sessions = [] } = input;
  if (destId === sourceId) {
    return { targets, files, groups, sessions, changed: false };
  }

  const dest = targets.find((target) => target.id === destId);
  const source = targets.find((target) => target.id === sourceId);
  if (!dest || !source) {
    return { targets, files, groups, sessions, changed: false };
  }

  const mergedTarget: Target = {
    ...mergeTargets(dest, source),
    imageIds: toUniqueStrings([...dest.imageIds, ...source.imageIds]),
  };

  const mergedTargets = targets
    .map((target) => {
      if (target.id === sourceId) return null;
      if (target.id === destId) return mergedTarget;
      return target;
    })
    .filter((target): target is Target => Boolean(target));

  const relinkedFiles = files.map((file) =>
    file.targetId === sourceId ? { ...file, targetId: destId } : file,
  );

  const relinkedGroups = groups.map((group) => {
    const replaced = group.targetIds.map((targetId) => (targetId === sourceId ? destId : targetId));
    const deduped = toUniqueStrings(replaced);
    if (arrayEquals(group.targetIds, deduped)) return group;
    return {
      ...group,
      targetIds: deduped,
      updatedAt: Date.now(),
    };
  });

  const relinkedSessions = sessions.map((session) => {
    const replaced = session.targets.map((targetName) =>
      targetName === source.name ? mergedTarget.name : targetName,
    );
    const deduped = toUniqueStrings(replaced);
    if (arrayEquals(session.targets, deduped)) return session;
    return {
      ...session,
      targets: deduped,
    };
  });

  const reconciled = computeTargetFileReconciliation({
    targets: mergedTargets,
    files: relinkedFiles,
    groups: relinkedGroups,
    sessions: relinkedSessions,
  });

  return {
    ...reconciled,
    changed: true,
  };
}
