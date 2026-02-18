import type {
  FitsMetadata,
  ObservationLogEntry,
  ObservationPlan,
  ObservationSession,
  Target,
  TargetGroup,
} from "../fits/types";
import { matchTargetByName, mergeTargets, normalizeName } from "./targetMatcher";
import { dedupeTargetRefs, normalizeSessionTargetRefs } from "./targetRefs";
import { reconcileAll } from "./targetIntegrity";

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
  plans?: ObservationPlan[];
  logEntries?: ObservationLogEntry[];
}

export interface TargetGraphPatch {
  targets: Target[];
  files: FitsMetadata[];
  groups: TargetGroup[];
  sessions: ObservationSession[];
  plans: ObservationPlan[];
  logEntries: ObservationLogEntry[];
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
  plans = [],
  logEntries = [],
}: TargetGraphInput): TargetGraphPatch {
  const patch = reconcileAll({
    targets,
    files,
    groups,
    sessions,
    plans,
    logEntries,
  });
  return {
    targets: patch.targets,
    files: patch.files,
    groups: patch.groups,
    sessions: patch.sessions,
    plans: patch.plans,
    logEntries: patch.logEntries,
    changed: patch.changed,
  };
}

export function computeMergeRelinkPatch(
  input: TargetGraphInput & { destId: string; sourceId: string },
): TargetGraphPatch {
  const {
    destId,
    sourceId,
    targets,
    files,
    groups = [],
    sessions = [],
    plans = [],
    logEntries = [],
  } = input;
  if (destId === sourceId) {
    return { targets, files, groups, sessions, plans, logEntries, changed: false };
  }

  const dest = targets.find((target) => target.id === destId);
  const source = targets.find((target) => target.id === sourceId);
  if (!dest || !source) {
    return { targets, files, groups, sessions, plans, logEntries, changed: false };
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

  const sourceNames = new Set([source.name, ...source.aliases].map((name) => normalizeName(name)));
  const relinkedSessions = sessions.map((session) => {
    const normalizedRefs = normalizeSessionTargetRefs(session, targets);
    const replacedRefs = normalizedRefs.map((ref) => {
      const normalizedRefName = normalizeName(ref.name);
      if (ref.targetId === sourceId || (!ref.targetId && sourceNames.has(normalizedRefName))) {
        return { targetId: destId, name: mergedTarget.name };
      }
      if (ref.targetId === destId) {
        return { ...ref, name: mergedTarget.name };
      }
      return ref;
    });
    const dedupedRefs = dedupeTargetRefs(replacedRefs, targets);
    if (session.targetRefs && session.targetRefs.length > 0) {
      const unchanged =
        session.targetRefs.length === dedupedRefs.length &&
        session.targetRefs.every(
          (ref, idx) =>
            ref.targetId === dedupedRefs[idx].targetId && ref.name === dedupedRefs[idx].name,
        );
      if (unchanged) return session;
    }
    return {
      ...session,
      targetRefs: dedupedRefs,
    };
  });

  const relinkedPlans = plans.map((plan) => {
    const normalizedPlanName = normalizeName(plan.targetName);
    if (plan.targetId === sourceId || (!plan.targetId && sourceNames.has(normalizedPlanName))) {
      return {
        ...plan,
        targetId: destId,
        targetName: mergedTarget.name,
      };
    }
    if (plan.targetId === destId && plan.targetName !== mergedTarget.name) {
      return {
        ...plan,
        targetName: mergedTarget.name,
      };
    }
    return plan;
  });

  const reconciled = computeTargetFileReconciliation({
    targets: mergedTargets,
    files: relinkedFiles,
    groups: relinkedGroups,
    sessions: relinkedSessions,
    plans: relinkedPlans,
    logEntries,
  });

  return {
    ...reconciled,
    changed: true,
  };
}
