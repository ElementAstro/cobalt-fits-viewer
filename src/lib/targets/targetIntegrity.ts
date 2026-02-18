import type {
  FitsMetadata,
  ObservationLogEntry,
  ObservationPlan,
  ObservationSession,
  Target,
  TargetGroup,
} from "../fits/types";
import { useFitsStore } from "../../stores/useFitsStore";
import { useSessionStore } from "../../stores/useSessionStore";
import { useTargetGroupStore } from "../../stores/useTargetGroupStore";
import { useTargetStore } from "../../stores/useTargetStore";
import {
  dedupeTargetRefs,
  normalizeSessionTargetRefs,
  resolveTargetId,
  resolveTargetName,
} from "./targetRefs";

export interface TargetIntegrityInput {
  targets: Target[];
  files: FitsMetadata[];
  groups?: TargetGroup[];
  sessions?: ObservationSession[];
  plans?: ObservationPlan[];
  logEntries?: ObservationLogEntry[];
}

export interface TargetIntegrityReport {
  fixedTargets: number;
  fixedFiles: number;
  fixedGroups: number;
  fixedSessions: number;
  fixedPlans: number;
  fixedLogEntries: number;
  downgradedTargetRefs: number;
}

export interface TargetIntegrityPatch {
  targets: Target[];
  files: FitsMetadata[];
  groups: TargetGroup[];
  sessions: ObservationSession[];
  plans: ObservationPlan[];
  logEntries: ObservationLogEntry[];
  changed: boolean;
  report: TargetIntegrityReport;
  valid: boolean;
  errors: string[];
}

function toUniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function sameStringArray(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((value, idx) => value === b[idx]);
}

function isSameTargetRefList(
  a: ObservationSession["targetRefs"],
  b: ObservationSession["targetRefs"],
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].targetId !== b[i].targetId || a[i].name !== b[i].name) {
      return false;
    }
  }
  return true;
}

function pickNewestTarget(targets: Target[]): Target {
  return [...targets].sort((a, b) => {
    if (a.updatedAt !== b.updatedAt) return b.updatedAt - a.updatedAt;
    return b.createdAt - a.createdAt;
  })[0];
}

function reconcileFilesAndTargets(
  targets: Target[],
  files: FitsMetadata[],
  report: TargetIntegrityReport,
) {
  const validFileIds = new Set(files.map((file) => file.id));
  const targetById = new Map(targets.map((target) => [target.id, target]));
  const validTargetIds = new Set(targetById.keys());

  const sanitizedFiles = files.map((file) => {
    if (!file.targetId || validTargetIds.has(file.targetId)) return file;
    report.fixedFiles += 1;
    return { ...file, targetId: undefined };
  });

  const fileTargetCandidates = new Map<string, Target[]>();
  for (const target of targets) {
    const dedupedIds = toUniqueStrings(target.imageIds).filter((imageId) =>
      validFileIds.has(imageId),
    );
    for (const imageId of dedupedIds) {
      const bucket = fileTargetCandidates.get(imageId);
      if (bucket) {
        bucket.push(target);
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
      report.fixedFiles += 1;
      continue;
    }
    if (candidates.length > 1) {
      fileAssignment.set(file.id, pickNewestTarget(candidates).id);
      report.fixedFiles += 1;
      continue;
    }
    fileAssignment.set(file.id, undefined);
  }

  const imageIdsByTarget = new Map<string, Set<string>>();
  for (const [fileId, targetId] of fileAssignment.entries()) {
    if (!targetId) continue;
    const bucket = imageIdsByTarget.get(targetId) ?? new Set<string>();
    bucket.add(fileId);
    imageIdsByTarget.set(targetId, bucket);
  }

  const reconciledTargets = targets.map((target) => {
    const assignedSet = imageIdsByTarget.get(target.id) ?? new Set<string>();
    const nextImageIds = target.imageIds.filter((imageId) => assignedSet.has(imageId));
    for (const imageId of assignedSet) {
      if (!nextImageIds.includes(imageId)) {
        nextImageIds.push(imageId);
      }
    }

    const nextRatings: Record<string, number> = {};
    for (const [imageId, rating] of Object.entries(target.imageRatings ?? {})) {
      if (assignedSet.has(imageId)) {
        nextRatings[imageId] = rating;
      }
    }
    const nextBestImageId =
      target.bestImageId && assignedSet.has(target.bestImageId) ? target.bestImageId : undefined;

    const ratingsChanged =
      Object.keys(nextRatings).length !== Object.keys(target.imageRatings ?? {}).length;
    const imageIdsChanged = !sameStringArray(target.imageIds, nextImageIds);
    const bestImageChanged = target.bestImageId !== nextBestImageId;

    if (!imageIdsChanged && !ratingsChanged && !bestImageChanged) return target;
    report.fixedTargets += 1;
    return {
      ...target,
      imageIds: nextImageIds,
      imageRatings: nextRatings,
      bestImageId: nextBestImageId,
      updatedAt: Date.now(),
    };
  });

  const reconciledFiles = sanitizedFiles.map((file) => {
    const assignedTargetId = fileAssignment.get(file.id);
    if (file.targetId === assignedTargetId) return file;
    return { ...file, targetId: assignedTargetId };
  });

  return { reconciledTargets, reconciledFiles };
}

function reconcileGroups(
  groups: TargetGroup[],
  validTargetIds: Set<string>,
  report: TargetIntegrityReport,
) {
  return groups.map((group) => {
    const nextIds = toUniqueStrings(group.targetIds).filter((targetId) =>
      validTargetIds.has(targetId),
    );
    if (sameStringArray(group.targetIds, nextIds)) return group;
    report.fixedGroups += 1;
    return {
      ...group,
      targetIds: nextIds,
      updatedAt: Date.now(),
    };
  });
}

function reconcileSessions(
  sessions: ObservationSession[],
  validFileIds: Set<string>,
  targets: Target[],
  report: TargetIntegrityReport,
) {
  return sessions.map((session) => {
    const normalizedRefs = dedupeTargetRefs(normalizeSessionTargetRefs(session, targets), targets);
    const normalizedImageIds = toUniqueStrings(session.imageIds).filter((imageId) =>
      validFileIds.has(imageId),
    );

    const downgradedCount = normalizedRefs.filter((ref) => !ref.targetId).length;
    if (downgradedCount > 0) {
      report.downgradedTargetRefs += downgradedCount;
    }

    if (
      isSameTargetRefList(session.targetRefs, normalizedRefs) &&
      sameStringArray(session.imageIds, normalizedImageIds)
    ) {
      return session;
    }
    report.fixedSessions += 1;
    return {
      ...session,
      targetRefs: normalizedRefs,
      imageIds: normalizedImageIds,
    };
  });
}

function reconcilePlans(
  plans: ObservationPlan[],
  targets: Target[],
  report: TargetIntegrityReport,
) {
  return plans.map((plan) => {
    const resolvedId = plan.targetId
      ? resolveTargetId({ targetId: plan.targetId, name: plan.targetName }, targets)
      : resolveTargetId({ name: plan.targetName }, targets);
    const resolvedName = resolvedId
      ? resolveTargetName({ targetId: resolvedId, name: plan.targetName }, targets)
      : plan.targetName.trim();
    if (plan.targetId === resolvedId && plan.targetName === resolvedName) {
      return plan;
    }
    report.fixedPlans += 1;
    return {
      ...plan,
      targetId: resolvedId,
      targetName: resolvedName,
    };
  });
}

function reconcileLogEntries(
  entries: ObservationLogEntry[],
  validSessionIds: Set<string>,
  validFileIds: Set<string>,
  report: TargetIntegrityReport,
) {
  const filtered = entries.filter(
    (entry) => validSessionIds.has(entry.sessionId) && validFileIds.has(entry.imageId),
  );
  if (filtered.length !== entries.length) {
    report.fixedLogEntries += entries.length - filtered.length;
  }
  return filtered;
}

export function validateTargetIntegrity(input: TargetIntegrityInput): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const targetById = new Map(input.targets.map((target) => [target.id, target]));
  const fileById = new Map(input.files.map((file) => [file.id, file]));

  for (const file of input.files) {
    if (!file.targetId) continue;
    const target = targetById.get(file.targetId);
    if (!target) {
      errors.push(`File ${file.id} references missing target ${file.targetId}`);
      continue;
    }
    if (!target.imageIds.includes(file.id)) {
      errors.push(`File ${file.id} targetId does not match target.imageIds`);
    }
  }

  for (const target of input.targets) {
    for (const imageId of target.imageIds) {
      const file = fileById.get(imageId);
      if (!file) {
        errors.push(`Target ${target.id} references missing file ${imageId}`);
        continue;
      }
      if (file.targetId !== target.id) {
        errors.push(`Target ${target.id} and file ${file.id} are not bidirectionally linked`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function reconcileAll(input: TargetIntegrityInput): TargetIntegrityPatch {
  const report: TargetIntegrityReport = {
    fixedTargets: 0,
    fixedFiles: 0,
    fixedGroups: 0,
    fixedSessions: 0,
    fixedPlans: 0,
    fixedLogEntries: 0,
    downgradedTargetRefs: 0,
  };

  const groups = input.groups ?? [];
  const sessions = input.sessions ?? [];
  const plans = input.plans ?? [];
  const logEntries = input.logEntries ?? [];

  const { reconciledTargets, reconciledFiles } = reconcileFilesAndTargets(
    input.targets,
    input.files,
    report,
  );
  const validTargetIds = new Set(reconciledTargets.map((target) => target.id));
  const validFileIds = new Set(reconciledFiles.map((file) => file.id));

  const reconciledGroups = reconcileGroups(groups, validTargetIds, report);
  const reconciledSessions = reconcileSessions(sessions, validFileIds, reconciledTargets, report);
  const reconciledPlans = reconcilePlans(plans, reconciledTargets, report);
  const validSessionIds = new Set(reconciledSessions.map((session) => session.id));
  const reconciledLogEntries = reconcileLogEntries(
    logEntries,
    validSessionIds,
    validFileIds,
    report,
  );

  const changed =
    report.fixedTargets > 0 ||
    report.fixedFiles > 0 ||
    report.fixedGroups > 0 ||
    report.fixedSessions > 0 ||
    report.fixedPlans > 0 ||
    report.fixedLogEntries > 0;

  const validation = validateTargetIntegrity({
    targets: reconciledTargets,
    files: reconciledFiles,
    groups: reconciledGroups,
    sessions: reconciledSessions,
    plans: reconciledPlans,
    logEntries: reconciledLogEntries,
  });

  return {
    targets: reconciledTargets,
    files: reconciledFiles,
    groups: reconciledGroups,
    sessions: reconciledSessions,
    plans: reconciledPlans,
    logEntries: reconciledLogEntries,
    changed,
    report,
    valid: validation.valid,
    errors: validation.errors,
  };
}

export function applyIntegrityPatch(patch: TargetIntegrityPatch) {
  useTargetStore.setState({ targets: patch.targets });
  useFitsStore.setState({ files: patch.files });
  useTargetGroupStore.setState({ groups: patch.groups });
  useSessionStore.setState({
    sessions: patch.sessions,
    plans: patch.plans,
    logEntries: patch.logEntries,
  });
}

export function reconcileAllStores(): TargetIntegrityPatch {
  const snapshot = {
    targets: useTargetStore.getState().targets,
    files: useFitsStore.getState().files,
    groups: useTargetGroupStore.getState().groups,
    sessions: useSessionStore.getState().sessions,
    plans: useSessionStore.getState().plans,
    logEntries: useSessionStore.getState().logEntries,
  };
  const patch = reconcileAll(snapshot);
  if (patch.changed && patch.valid) {
    applyIntegrityPatch(patch);
  }
  return patch;
}
