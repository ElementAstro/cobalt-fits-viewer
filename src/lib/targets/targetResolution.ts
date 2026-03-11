import type { FitsMetadata, Target, TargetStatus, TargetType } from "../fits/types";
import { guessTargetType } from "./targetManager";
import { findKnownAliases, normalizeName } from "./targetMatcher";

export const DEFAULT_TARGET_COORDINATE_RADIUS_DEG = 0.5;

export type TargetLinkOutcome =
  | "linked-existing"
  | "created-new"
  | "updated-existing"
  | "ambiguous"
  | "skipped";

export type TargetResolutionReasonCode =
  | "file-not-found"
  | "insufficient-metadata"
  | "no-candidate"
  | "ambiguous-candidates"
  | "created-from-object"
  | "name-match"
  | "alias-match"
  | "coordinate-match"
  | "name-coordinate-match"
  | "alias-coordinate-match"
  | "invalid-state";

export interface TargetResolutionMetadata {
  object?: string;
  aliases?: string[];
  ra?: number;
  dec?: number;
  type?: TargetType;
  status?: TargetStatus;
  category?: string;
  tags?: string[];
  notes?: string;
}

export interface TargetResolutionSignals {
  name: boolean;
  alias: boolean;
  coordinate: boolean;
}

export interface TargetResolutionCandidate {
  targetId: string;
  score: number;
  signals: TargetResolutionSignals;
}

export interface TargetIdentityBundle {
  canonicalObjectName: string | null;
  expandedAliases: string[];
  normalizedLookup: Set<string>;
  candidateNames: string[];
}

export type TargetResolutionDecision =
  | {
      outcome: "linked-existing";
      reasonCode: Extract<
        TargetResolutionReasonCode,
        | "name-match"
        | "alias-match"
        | "coordinate-match"
        | "name-coordinate-match"
        | "alias-coordinate-match"
      >;
      candidate: TargetResolutionCandidate;
      identity: TargetIdentityBundle;
      resolvedRa?: number;
      resolvedDec?: number;
    }
  | {
      outcome: "created-new";
      reasonCode: "created-from-object";
      identity: TargetIdentityBundle;
      resolvedRa?: number;
      resolvedDec?: number;
    }
  | {
      outcome: "ambiguous";
      reasonCode: "ambiguous-candidates";
      identity: TargetIdentityBundle;
      candidates: TargetResolutionCandidate[];
      resolvedRa?: number;
      resolvedDec?: number;
    }
  | {
      outcome: "skipped";
      reasonCode: "insufficient-metadata" | "no-candidate";
      identity: TargetIdentityBundle;
      resolvedRa?: number;
      resolvedDec?: number;
    };

export interface ResolveTargetResolutionInput {
  file: FitsMetadata;
  targets: Target[];
  metadata?: TargetResolutionMetadata;
  coordinateRadiusDeg?: number;
}

export interface BuildTargetMergePlanInput {
  target: Target;
  fileId: string;
  metadata: TargetResolutionMetadata;
  canonicalObjectName: string | null;
  expandedAliases: string[];
  resolvedRa?: number;
  resolvedDec?: number;
}

export interface TargetMergePlan {
  updates: Partial<Target>;
  metadataChanged: boolean;
}

export interface TargetCreationPlan {
  name: string;
  type: TargetType;
  aliases: string[];
  tags: string[];
  ra?: number;
  dec?: number;
  status?: TargetStatus;
  category?: string;
  notes?: string;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function hasFiniteNumber(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function toNormalizedName(value: string): string {
  return normalizeName(value).toLowerCase();
}

export function isCoordinateMatch(
  ra1: number,
  dec1: number,
  ra2: number,
  dec2: number,
  radiusDeg: number = DEFAULT_TARGET_COORDINATE_RADIUS_DEG,
): boolean {
  const dRa = (ra1 - ra2) * Math.cos((dec1 * Math.PI) / 180);
  const dDec = dec1 - dec2;
  const dist = Math.sqrt(dRa * dRa + dDec * dDec);
  return dist <= radiusDeg;
}

export function buildTargetIdentityBundle(
  objectName?: string,
  aliases: string[] = [],
): TargetIdentityBundle {
  const trimmedObject = objectName?.trim() ?? "";
  const canonicalObjectName = trimmedObject ? normalizeName(trimmedObject) : null;

  const baseCandidates = uniqueStrings(
    [trimmedObject, ...aliases]
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
      .map((value) => normalizeName(value)),
  );

  const expandedFromKnown = uniqueStrings(
    baseCandidates.flatMap((name) => findKnownAliases(name).map((alias) => normalizeName(alias))),
  );

  const candidateNames = uniqueStrings([...baseCandidates, ...expandedFromKnown]);
  const expandedAliases = candidateNames.filter(
    (name) =>
      !canonicalObjectName || toNormalizedName(name) !== toNormalizedName(canonicalObjectName),
  );
  const normalizedLookup = new Set(candidateNames.map((name) => toNormalizedName(name)));

  return {
    canonicalObjectName,
    expandedAliases,
    normalizedLookup,
    candidateNames,
  };
}

function scoreCandidate(
  target: Target,
  identity: TargetIdentityBundle,
  resolvedRa: number | undefined,
  resolvedDec: number | undefined,
  coordinateRadiusDeg: number,
): TargetResolutionCandidate | null {
  const targetNameNormalized = toNormalizedName(target.name);
  const aliasNames = target.aliases.map((alias) => toNormalizedName(alias));

  const nameSignal = identity.normalizedLookup.has(targetNameNormalized);
  const aliasSignal = aliasNames.some((alias) => identity.normalizedLookup.has(alias));
  const coordinateSignal =
    hasFiniteNumber(resolvedRa) &&
    hasFiniteNumber(resolvedDec) &&
    hasFiniteNumber(target.ra) &&
    hasFiniteNumber(target.dec) &&
    isCoordinateMatch(resolvedRa, resolvedDec, target.ra, target.dec, coordinateRadiusDeg);

  if (!nameSignal && !aliasSignal && !coordinateSignal) return null;

  let score = 0;
  if (nameSignal) {
    score = 100;
  } else if (aliasSignal) {
    score = 90;
  } else if (coordinateSignal) {
    score = 60;
  }

  if (coordinateSignal && (nameSignal || aliasSignal)) {
    score += 20;
  }

  return {
    targetId: target.id,
    score,
    signals: {
      name: nameSignal,
      alias: aliasSignal,
      coordinate: coordinateSignal,
    },
  };
}

function reasonFromSignals(
  signals: TargetResolutionSignals,
): Extract<
  TargetResolutionReasonCode,
  | "name-match"
  | "alias-match"
  | "coordinate-match"
  | "name-coordinate-match"
  | "alias-coordinate-match"
> {
  if (signals.name && signals.coordinate) return "name-coordinate-match";
  if (signals.alias && signals.coordinate) return "alias-coordinate-match";
  if (signals.name) return "name-match";
  if (signals.alias) return "alias-match";
  return "coordinate-match";
}

export function resolveTargetResolution({
  file,
  targets,
  metadata = {},
  coordinateRadiusDeg = DEFAULT_TARGET_COORDINATE_RADIUS_DEG,
}: ResolveTargetResolutionInput): TargetResolutionDecision {
  const resolvedObjectName = metadata.object?.trim() || file.object?.trim();
  const resolvedAliases = uniqueStrings(
    (metadata.aliases ?? []).map((alias) => alias.trim()).filter((alias) => alias.length > 0),
  );
  const resolvedRa = hasFiniteNumber(metadata.ra) ? metadata.ra : file.ra;
  const resolvedDec = hasFiniteNumber(metadata.dec) ? metadata.dec : file.dec;
  const identity = buildTargetIdentityBundle(resolvedObjectName, resolvedAliases);

  if (
    !identity.canonicalObjectName &&
    (!hasFiniteNumber(resolvedRa) || !hasFiniteNumber(resolvedDec))
  ) {
    return {
      outcome: "skipped",
      reasonCode: "insufficient-metadata",
      identity,
      resolvedRa,
      resolvedDec,
    };
  }

  const candidates = targets
    .map((target) => scoreCandidate(target, identity, resolvedRa, resolvedDec, coordinateRadiusDeg))
    .filter((candidate): candidate is TargetResolutionCandidate => Boolean(candidate))
    .sort((a, b) => b.score - a.score);

  if (candidates.length === 0) {
    if (!identity.canonicalObjectName) {
      return {
        outcome: "skipped",
        reasonCode: "no-candidate",
        identity,
        resolvedRa,
        resolvedDec,
      };
    }
    return {
      outcome: "created-new",
      reasonCode: "created-from-object",
      identity,
      resolvedRa,
      resolvedDec,
    };
  }

  const topScore = candidates[0].score;
  const topCandidates = candidates.filter((candidate) => candidate.score === topScore);
  if (topCandidates.length > 1) {
    return {
      outcome: "ambiguous",
      reasonCode: "ambiguous-candidates",
      identity,
      candidates: topCandidates,
      resolvedRa,
      resolvedDec,
    };
  }

  return {
    outcome: "linked-existing",
    reasonCode: reasonFromSignals(topCandidates[0].signals),
    candidate: topCandidates[0],
    identity,
    resolvedRa,
    resolvedDec,
  };
}

export function buildTargetCreationPlan(
  metadata: TargetResolutionMetadata,
  identity: TargetIdentityBundle,
  resolvedRa?: number,
  resolvedDec?: number,
): TargetCreationPlan | null {
  if (!identity.canonicalObjectName) return null;

  const targetName = identity.canonicalObjectName;
  const aliases = uniqueStrings(
    identity.expandedAliases.filter(
      (alias) => toNormalizedName(alias) !== toNormalizedName(targetName),
    ),
  );
  const tags = uniqueStrings((metadata.tags ?? []).map((tag) => tag.trim()).filter((tag) => tag));

  return {
    name: targetName,
    type: metadata.type ?? guessTargetType(targetName),
    aliases,
    tags,
    ra: hasFiniteNumber(resolvedRa) ? resolvedRa : undefined,
    dec: hasFiniteNumber(resolvedDec) ? resolvedDec : undefined,
    status: metadata.status,
    category: metadata.category?.trim() || undefined,
    notes: metadata.notes?.trim() || undefined,
  };
}

export function buildTargetMergePlan({
  target,
  fileId,
  metadata,
  canonicalObjectName,
  expandedAliases,
  resolvedRa,
  resolvedDec,
}: BuildTargetMergePlanInput): TargetMergePlan {
  const updates: Partial<Target> = {};

  const nextImageIds = uniqueStrings([...(target.imageIds ?? []), fileId]);
  if (!arraysEqual(target.imageIds ?? [], nextImageIds)) {
    updates.imageIds = nextImageIds;
  }

  if (hasFiniteNumber(resolvedRa) && !hasFiniteNumber(target.ra)) {
    updates.ra = resolvedRa;
  }
  if (hasFiniteNumber(resolvedDec) && !hasFiniteNumber(target.dec)) {
    updates.dec = resolvedDec;
  }

  if (metadata.status && target.status !== metadata.status) {
    updates.status = metadata.status;
  }

  const trimmedCategory = metadata.category?.trim();
  if (trimmedCategory && !target.category) {
    updates.category = trimmedCategory;
  }

  const trimmedNotes = metadata.notes?.trim();
  if (trimmedNotes && !target.notes) {
    updates.notes = trimmedNotes;
  }

  if (metadata.type && target.type === "other") {
    updates.type = metadata.type;
  }

  const incomingTags = uniqueStrings(
    (metadata.tags ?? []).map((tag) => tag.trim()).filter(Boolean),
  );
  if (incomingTags.length > 0) {
    const mergedTags = uniqueStrings([...(target.tags ?? []), ...incomingTags]);
    if (!arraysEqual(target.tags ?? [], mergedTags)) {
      updates.tags = mergedTags;
    }
  }

  const identityAliases = uniqueStrings([
    ...expandedAliases,
    ...(canonicalObjectName &&
    toNormalizedName(canonicalObjectName) !== toNormalizedName(target.name)
      ? [canonicalObjectName]
      : []),
  ]);
  const mergedAliases = uniqueStrings([...(target.aliases ?? []), ...identityAliases]);
  if (!arraysEqual(target.aliases ?? [], mergedAliases)) {
    updates.aliases = mergedAliases;
  }

  const metadataChanged = Object.keys(updates).some((key) => key !== "imageIds");
  return { updates, metadataChanged };
}
