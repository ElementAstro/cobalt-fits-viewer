import type { ObservationSession, Target, TargetRef } from "../fits/types";
import { normalizeName } from "./targetMatcher";

type SessionLike = Partial<ObservationSession> & {
  targetRefs?: TargetRef[] | null;
  targets?: string[] | null;
};

function normalizeRefName(name: string): string {
  return normalizeName(name).toLowerCase();
}

function getTargetNameCandidates(target: Target): string[] {
  return [target.name, ...target.aliases];
}

function matchTargetByRefName(name: string, targets: Target[]): Target | undefined {
  const normalized = normalizeRefName(name);
  return targets.find((target) =>
    getTargetNameCandidates(target).some((candidate) => normalizeRefName(candidate) === normalized),
  );
}

export function resolveTargetId(ref: TargetRef, targets: Target[]): string | undefined {
  if (ref.targetId && targets.some((target) => target.id === ref.targetId)) {
    return ref.targetId;
  }
  return matchTargetByRefName(ref.name, targets)?.id;
}

export function resolveTargetName(ref: TargetRef, targets: Target[]): string {
  if (ref.targetId) {
    const target = targets.find((item) => item.id === ref.targetId);
    if (target) return target.name;
  }

  const matched = matchTargetByRefName(ref.name, targets);
  if (matched) return matched.name;
  return ref.name.trim();
}

export function toTargetRef(value: string | TargetRef | Target, targets: Target[] = []): TargetRef {
  if (typeof value === "string") {
    const name = value.trim();
    const matched = matchTargetByRefName(name, targets);
    return {
      targetId: matched?.id,
      name: matched?.name ?? name,
    };
  }

  if ("aliases" in value && "id" in value) {
    return {
      targetId: value.id,
      name: value.name,
    };
  }

  const name = value.name.trim();
  const matchedById =
    value.targetId && targets.find((target) => target.id === value.targetId)
      ? targets.find((target) => target.id === value.targetId)
      : undefined;
  const matched = matchedById ?? matchTargetByRefName(name, targets);

  return {
    targetId: matched?.id ?? value.targetId,
    name: matched?.name ?? name,
  };
}

export function dedupeTargetRefs(refs: TargetRef[], targets: Target[] = []): TargetRef[] {
  const deduped: TargetRef[] = [];
  const seenById = new Set<string>();
  const seenByName = new Set<string>();

  for (const ref of refs) {
    const normalizedRef = toTargetRef(ref, targets);
    if (!normalizedRef.name) continue;

    if (normalizedRef.targetId) {
      if (seenById.has(normalizedRef.targetId)) continue;
      seenById.add(normalizedRef.targetId);
      deduped.push(normalizedRef);
      continue;
    }

    const key = normalizeRefName(normalizedRef.name);
    if (seenByName.has(key)) continue;
    seenByName.add(key);
    deduped.push(normalizedRef);
  }

  return deduped;
}

export function normalizeSessionTargetRefs(
  session: SessionLike,
  targets: Target[] = [],
): TargetRef[] {
  const refs = Array.isArray(session.targetRefs)
    ? session.targetRefs
    : (session.targets ?? []).map((name) => ({ name }));
  return dedupeTargetRefs(
    refs.map((ref) => toTargetRef(ref, targets)),
    targets,
  );
}
