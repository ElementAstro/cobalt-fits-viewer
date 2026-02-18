/**
 * 目标管理 Hook
 */

import { useCallback, useMemo } from "react";
import { useTargetStore } from "../stores/useTargetStore";
import { useTargetGroupStore } from "../stores/useTargetGroupStore";
import { useFitsStore } from "../stores/useFitsStore";
import { useSessionStore } from "../stores/useSessionStore";
import { calculateTargetExposure, createTarget } from "../lib/targets/targetManager";
import { findKnownAliases } from "../lib/targets/targetMatcher";
import {
  calculateExposureStats,
  calculateCompletionRate,
  formatExposureTime,
} from "../lib/targets/exposureStats";
import { computeMergeRelinkPatch, normalizeTargetMatch } from "../lib/targets/targetRelations";
import {
  applyIntegrityPatch,
  reconcileAll,
  reconcileAllStores,
  type TargetIntegrityInput,
  type TargetIntegrityPatch,
} from "../lib/targets/targetIntegrity";
import { buildTargetIndexes } from "../lib/targets/targetIndexes";
import { dedupeTargetRefs, normalizeSessionTargetRefs } from "../lib/targets/targetRefs";
import type {
  FitsMetadata,
  RecommendedEquipment,
  Target,
  TargetStatus,
  TargetType,
} from "../lib/fits/types";

export type TargetLinkSource = "import" | "scan" | "astrometry" | "manual" | "backup" | "unknown";

export interface UpsertTargetMetadata {
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

export interface UpsertAndLinkResult {
  target: Target;
  targetId: string;
  isNew: boolean;
  source: TargetLinkSource;
}

const COORDINATE_MATCH_RADIUS_DEG = 0.5;

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function isCoordinateMatch(ra1: number, dec1: number, ra2: number, dec2: number): boolean {
  const dRa = (ra1 - ra2) * Math.cos((dec1 * Math.PI) / 180);
  const dDec = dec1 - dec2;
  return Math.sqrt(dRa * dRa + dDec * dDec) <= COORDINATE_MATCH_RADIUS_DEG;
}

function getTargetGraphSnapshot(): TargetIntegrityInput {
  const sessionState = useSessionStore.getState();
  return {
    targets: useTargetStore.getState().targets,
    files: useFitsStore.getState().files,
    groups: useTargetGroupStore.getState().groups,
    sessions: sessionState.sessions,
    plans: sessionState.plans,
    logEntries: sessionState.logEntries,
  };
}

function commitTargetGraphMutation(
  mutator: (snapshot: TargetIntegrityInput) => TargetIntegrityInput,
): TargetIntegrityPatch | null {
  const snapshot = getTargetGraphSnapshot();
  const mutated = mutator(snapshot);
  const patch = reconcileAll(mutated);
  if (!patch.valid) return null;

  const hasMutation =
    mutated.targets !== snapshot.targets ||
    mutated.files !== snapshot.files ||
    mutated.groups !== snapshot.groups ||
    mutated.sessions !== snapshot.sessions ||
    mutated.plans !== snapshot.plans ||
    mutated.logEntries !== snapshot.logEntries;

  const changed = patch.changed || hasMutation;
  if (changed) {
    applyIntegrityPatch({ ...patch, changed: true });
  }

  return { ...patch, changed };
}

export function reconcileTargetGraphStores(): boolean {
  const patch = reconcileAllStores();
  return patch.changed;
}

export function useTargets() {
  const targets = useTargetStore((s) => s.targets);
  const groups = useTargetGroupStore((s) => s.groups);
  const files = useFitsStore((s) => s.files);

  const addGroup = useTargetGroupStore((s) => s.addGroup);
  const removeGroup = useTargetGroupStore((s) => s.removeGroup);
  const updateGroup = useTargetGroupStore((s) => s.updateGroup);
  const addTargetToGroup = useTargetGroupStore((s) => s.addTargetToGroup);
  const removeTargetFromGroup = useTargetGroupStore((s) => s.removeTargetFromGroup);
  const getGroupById = useTargetGroupStore((s) => s.getGroupById);

  const targetIndexes = useMemo(() => buildTargetIndexes(targets, files), [targets, files]);

  const updateTargetFields = useCallback((targetId: string, updates: Partial<Target>) => {
    commitTargetGraphMutation((snapshot) => ({
      ...snapshot,
      targets: snapshot.targets.map((target) =>
        target.id === targetId ? { ...target, ...updates, updatedAt: Date.now() } : target,
      ),
    }));
  }, []);

  const upsertAndLinkFileTarget = useCallback(
    (
      fileId: string,
      metadata: UpsertTargetMetadata = {},
      source: TargetLinkSource = "unknown",
    ): UpsertAndLinkResult | null => {
      let targetId: string | null = null;
      let isNew = false;

      const patch = commitTargetGraphMutation((snapshot) => {
        const file = snapshot.files.find((item) => item.id === fileId);
        if (!file) return snapshot;

        const targetName = metadata.object?.trim() || file.object?.trim();
        const aliasInputs = uniqueStrings(
          (metadata.aliases ?? []).map((alias) => alias.trim()).filter((alias) => alias.length > 0),
        );

        let matched = normalizeTargetMatch({
          name: targetName,
          aliases: aliasInputs,
          targets: snapshot.targets,
        });

        if (!matched && metadata.ra !== undefined && metadata.dec !== undefined) {
          matched =
            snapshot.targets.find(
              (candidate) =>
                candidate.ra !== undefined &&
                candidate.dec !== undefined &&
                isCoordinateMatch(metadata.ra!, metadata.dec!, candidate.ra, candidate.dec),
            ) ?? null;
        }

        let nextTargets = [...snapshot.targets];

        if (!matched) {
          if (!targetName) {
            return snapshot;
          }
          const nextTarget = createTarget(targetName, metadata.type ?? "other");
          nextTarget.ra = metadata.ra ?? nextTarget.ra;
          nextTarget.dec = metadata.dec ?? nextTarget.dec;
          nextTarget.status = metadata.status ?? nextTarget.status;
          nextTarget.category = metadata.category ?? nextTarget.category;
          nextTarget.tags = metadata.tags ? uniqueStrings(metadata.tags) : nextTarget.tags;
          nextTarget.notes = metadata.notes ?? nextTarget.notes;
          const knownAliases = findKnownAliases(targetName);
          nextTarget.aliases = uniqueStrings(
            [...nextTarget.aliases, ...aliasInputs, ...knownAliases].filter(
              (alias) => alias.toLowerCase() !== targetName.toLowerCase(),
            ),
          );
          nextTarget.imageIds = uniqueStrings([...nextTarget.imageIds, fileId]);
          nextTargets = [...nextTargets, nextTarget];
          targetId = nextTarget.id;
          isNew = true;
        } else {
          const updates: Partial<Target> = {};
          if (metadata.ra !== undefined && matched.ra !== metadata.ra) {
            updates.ra = metadata.ra;
          }
          if (metadata.dec !== undefined && matched.dec !== metadata.dec) {
            updates.dec = metadata.dec;
          }
          if (metadata.status && matched.status !== metadata.status) {
            updates.status = metadata.status;
          }
          if (metadata.category && matched.category !== metadata.category) {
            updates.category = metadata.category;
          }
          if (metadata.notes && !matched.notes) {
            updates.notes = metadata.notes;
          }
          if (metadata.type && matched.type === "other") {
            updates.type = metadata.type;
          }
          if (metadata.tags && metadata.tags.length > 0) {
            updates.tags = uniqueStrings([...(matched.tags ?? []), ...metadata.tags]);
          }
          if (targetName) {
            const knownAliases = findKnownAliases(targetName);
            const mergedAliases = uniqueStrings([
              ...matched.aliases,
              ...aliasInputs,
              ...knownAliases,
              ...(targetName.toLowerCase() === matched.name.toLowerCase() ? [] : [targetName]),
            ]);
            if (
              mergedAliases.length !== matched.aliases.length ||
              mergedAliases.some((alias, idx) => alias !== matched.aliases[idx])
            ) {
              updates.aliases = mergedAliases;
            }
          }
          updates.imageIds = uniqueStrings([...(matched.imageIds ?? []), fileId]);

          nextTargets = nextTargets.map((target) =>
            target.id === matched!.id ? { ...target, ...updates, updatedAt: Date.now() } : target,
          );
          targetId = matched.id;
        }

        if (!targetId) return snapshot;

        const nextFiles = snapshot.files.map((item) =>
          item.id === fileId ? { ...item, targetId: targetId ?? undefined } : item,
        );

        return {
          ...snapshot,
          targets: nextTargets,
          files: nextFiles,
        };
      });

      if (!patch || !targetId) return null;
      const linkedTarget =
        patch.targets.find((item) => item.id === targetId) ??
        useTargetStore.getState().targets.find((item) => item.id === targetId);
      if (!linkedTarget) return null;

      return {
        target: linkedTarget,
        targetId,
        isNew,
        source,
      };
    },
    [],
  );

  const removeTargetCascade = useCallback((targetId: string) => {
    const snapshot = getTargetGraphSnapshot();
    const target = snapshot.targets.find((item) => item.id === targetId);
    if (!target) return false;

    const targetNames = new Set([target.name, ...target.aliases].map((name) => name.toLowerCase()));

    const patch = commitTargetGraphMutation((state) => ({
      ...state,
      targets: state.targets.filter((item) => item.id !== targetId),
      files: state.files.map((file) =>
        file.targetId === targetId ? { ...file, targetId: undefined } : file,
      ),
      groups: (state.groups ?? []).map((group) => ({
        ...group,
        targetIds: group.targetIds.filter((id) => id !== targetId),
      })),
      sessions: (state.sessions ?? []).map((session) => {
        const refs = normalizeSessionTargetRefs(session, state.targets).filter(
          (ref) => ref.targetId !== targetId && !targetNames.has(ref.name.toLowerCase()),
        );
        return {
          ...session,
          targetRefs: dedupeTargetRefs(refs, state.targets),
        };
      }),
      plans: (state.plans ?? []).map((plan) => {
        if (plan.targetId !== targetId) return plan;
        return {
          ...plan,
          targetId: undefined,
        };
      }),
    }));

    return Boolean(patch);
  }, []);

  const mergeTargetsCascade = useCallback((destId: string, sourceId: string) => {
    if (destId === sourceId) return null;

    const snapshot = getTargetGraphSnapshot();
    const patch = computeMergeRelinkPatch({
      ...snapshot,
      destId,
      sourceId,
    });

    if (!patch.changed) return null;

    const validated = reconcileAll(patch);
    if (!validated.valid) return null;

    applyIntegrityPatch(validated);
    return validated.targets.find((target) => target.id === destId) ?? null;
  }, []);

  const renameTargetCascade = useCallback((targetId: string, newName: string) => {
    const snapshot = getTargetGraphSnapshot();
    const target = snapshot.targets.find((item) => item.id === targetId);
    const trimmed = newName.trim();
    if (!target || !trimmed || target.name === trimmed) return false;

    const patch = commitTargetGraphMutation((state) => {
      const nextTargets = state.targets.map((item) => {
        if (item.id !== targetId) return item;
        const nextAliases = item.aliases.includes(item.name)
          ? item.aliases
          : [...item.aliases, item.name];
        return {
          ...item,
          name: trimmed,
          aliases: uniqueStrings(nextAliases),
          updatedAt: Date.now(),
        };
      });

      const nextSessions = (state.sessions ?? []).map((session) => {
        const nextRefs = normalizeSessionTargetRefs(session, state.targets).map((ref) => {
          if (ref.targetId === targetId) {
            return { ...ref, name: trimmed };
          }
          if (!ref.targetId && ref.name.toLowerCase() === target.name.toLowerCase()) {
            return { targetId, name: trimmed };
          }
          return ref;
        });

        return {
          ...session,
          targetRefs: dedupeTargetRefs(nextRefs, nextTargets),
        };
      });

      const nextPlans = (state.plans ?? []).map((plan) => {
        if (plan.targetId === targetId) {
          return { ...plan, targetName: trimmed };
        }
        if (!plan.targetId && plan.targetName.toLowerCase() === target.name.toLowerCase()) {
          return { ...plan, targetId, targetName: trimmed };
        }
        return plan;
      });

      return {
        ...state,
        targets: nextTargets,
        sessions: nextSessions,
        plans: nextPlans,
      };
    });

    return Boolean(patch);
  }, []);

  const reconcileTargetGraph = useCallback(() => reconcileTargetGraphStores(), []);

  const scanAndAutoDetect = useCallback((): { newCount: number; updatedCount: number } => {
    let newCount = 0;
    let updatedCount = 0;
    const fileList = useFitsStore.getState().files;

    for (const file of fileList) {
      if (file.targetId) continue;
      if (!file.object && file.ra === undefined && file.dec === undefined) continue;

      const result = upsertAndLinkFileTarget(
        file.id,
        {
          object: file.object,
          ra: file.ra,
          dec: file.dec,
        },
        "scan",
      );
      if (!result) continue;
      if (result.isNew) {
        newCount++;
      } else {
        updatedCount++;
      }
    }

    return { newCount, updatedCount };
  }, [upsertAndLinkFileTarget]);

  const createNewTarget = useCallback(
    (
      name: string,
      type: TargetType = "other",
      options?: {
        ra?: number;
        dec?: number;
        notes?: string;
        category?: string;
        tags?: string[];
        isFavorite?: boolean;
        groupId?: string;
      },
    ) => {
      const snapshot = getTargetGraphSnapshot();
      const existing = normalizeTargetMatch({
        name,
        targets: snapshot.targets,
      });

      if (existing) {
        const mergedTags = options?.tags
          ? uniqueStrings([...(existing.tags ?? []), ...(options.tags ?? [])])
          : existing.tags;

        updateTargetFields(existing.id, {
          ra: existing.ra ?? options?.ra,
          dec: existing.dec ?? options?.dec,
          notes: existing.notes ?? options?.notes,
          category: existing.category ?? options?.category,
          tags: mergedTags,
          isFavorite: options?.isFavorite ?? existing.isFavorite,
        });

        if (options?.groupId) {
          addTargetToGroup(options.groupId, existing.id);
        }

        return (
          useTargetStore.getState().targets.find((target) => target.id === existing.id) ?? existing
        );
      }

      const target = createTarget(name, type);
      if (options?.ra !== undefined) target.ra = options.ra;
      if (options?.dec !== undefined) target.dec = options.dec;
      if (options?.notes) target.notes = options.notes;
      if (options?.category) target.category = options.category;
      if (options?.tags) target.tags = uniqueStrings(options.tags);
      if (options?.isFavorite !== undefined) target.isFavorite = options.isFavorite;
      const aliases = findKnownAliases(target.name);
      if (aliases.length > 0) {
        target.aliases = uniqueStrings([...target.aliases, ...aliases]);
      }

      const patch = commitTargetGraphMutation((state) => {
        const nextGroups = [...(state.groups ?? [])];
        if (options?.groupId) {
          for (let i = 0; i < nextGroups.length; i++) {
            if (nextGroups[i].id !== options.groupId) continue;
            nextGroups[i] = {
              ...nextGroups[i],
              targetIds: uniqueStrings([...(nextGroups[i].targetIds ?? []), target.id]),
              updatedAt: Date.now(),
            };
          }
        }

        return {
          ...state,
          targets: [...state.targets, target],
          groups: nextGroups,
        };
      });

      return patch?.targets.find((item) => item.id === target.id) ?? target;
    },
    [addTargetToGroup, updateTargetFields],
  );

  const updateTargetWithCascade = useCallback(
    (targetId: string, updates: Partial<Target>) => {
      const { name, ...rest } = updates;
      if (typeof name === "string") {
        renameTargetCascade(targetId, name);
      }
      if (Object.keys(rest).length > 0) {
        updateTargetFields(targetId, rest);
      }
    },
    [renameTargetCascade, updateTargetFields],
  );

  const getTargetStats = useCallback(
    (targetId: string) => {
      const target = targets.find((t) => t.id === targetId);
      if (!target) return null;

      const cachedStats = targetIndexes.targetStatsCache.get(targetId);
      const targetFiles =
        cachedStats?.files ??
        target.imageIds
          .map((imageId) => targetIndexes.fileById.get(imageId))
          .filter((file): file is FitsMetadata => Boolean(file));

      const exposureStats = calculateExposureStats(targetFiles);
      const completion = calculateCompletionRate(target, files);

      return {
        exposureStats,
        completion,
        filterExposure: cachedStats?.filterExposure ?? calculateTargetExposure(target, files),
      };
    },
    [targets, files, targetIndexes],
  );

  const associateImages = useCallback((targetId: string, imageIds: string[]) => {
    commitTargetGraphMutation((state) => ({
      ...state,
      targets: state.targets.map((target) =>
        target.id === targetId
          ? { ...target, imageIds: uniqueStrings([...(target.imageIds ?? []), ...imageIds]) }
          : target,
      ),
      files: state.files.map((file) => (imageIds.includes(file.id) ? { ...file, targetId } : file)),
    }));
  }, []);

  const disassociateImages = useCallback((targetId: string, imageIds: string[]) => {
    commitTargetGraphMutation((state) => ({
      ...state,
      targets: state.targets.map((target) =>
        target.id === targetId
          ? {
              ...target,
              imageIds: target.imageIds.filter((imageId) => !imageIds.includes(imageId)),
            }
          : target,
      ),
      files: state.files.map((file) =>
        imageIds.includes(file.id) && file.targetId === targetId
          ? { ...file, targetId: undefined }
          : file,
      ),
    }));
  }, []);

  const updateEquipment = useCallback(
    (targetId: string, equipment: RecommendedEquipment) => {
      updateTargetFields(targetId, { recommendedEquipment: equipment });
    },
    [updateTargetFields],
  );

  const rateImage = useCallback((targetId: string, imageId: string, rating: number) => {
    if (rating < 1 || rating > 5) return;
    commitTargetGraphMutation((state) => ({
      ...state,
      targets: state.targets.map((target) =>
        target.id === targetId
          ? {
              ...target,
              imageRatings: { ...(target.imageRatings ?? {}), [imageId]: rating },
              updatedAt: Date.now(),
            }
          : target,
      ),
    }));
  }, []);

  const clearImageRating = useCallback((targetId: string, imageId: string) => {
    commitTargetGraphMutation((state) => ({
      ...state,
      targets: state.targets.map((target) => {
        if (target.id !== targetId) return target;
        const { [imageId]: _removed, ...rest } = target.imageRatings ?? {};
        return {
          ...target,
          imageRatings: rest,
          updatedAt: Date.now(),
        };
      }),
    }));
  }, []);

  const setTargetBestImage = useCallback(
    (targetId: string, imageId: string | undefined) => {
      const target = targets.find((item) => item.id === targetId);
      if (!target) return;
      if (imageId && !target.imageIds.includes(imageId)) return;
      updateTargetFields(targetId, { bestImageId: imageId });
    },
    [targets, updateTargetFields],
  );

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const target of targets) {
      for (const tag of target.tags) {
        tagSet.add(tag);
      }
    }
    return Array.from(tagSet).sort();
  }, [targets]);

  const allCategories = useMemo(() => {
    const categorySet = new Set<string>();
    for (const target of targets) {
      if (target.category) {
        categorySet.add(target.category);
      }
    }
    return Array.from(categorySet).sort();
  }, [targets]);

  return {
    // Data
    targets,
    groups,
    allTags,
    allCategories,

    // Basic CRUD
    addTarget: createNewTarget,
    removeTarget: removeTargetCascade,
    removeTargetCascade,
    updateTarget: updateTargetWithCascade,
    renameTargetCascade,

    // Image management
    addImageToTarget: (targetId: string, imageId: string) => associateImages(targetId, [imageId]),
    removeImageFromTarget: (targetId: string, imageId: string) =>
      disassociateImages(targetId, [imageId]),
    associateImages,
    disassociateImages,
    upsertAndLinkFileTarget,

    // Alias management
    addAlias: (targetId: string, alias: string) => {
      const trimmed = alias.trim();
      if (!trimmed) return;
      const target = useTargetStore.getState().targets.find((item) => item.id === targetId);
      if (!target || target.aliases.includes(trimmed)) return;
      updateTargetFields(targetId, { aliases: [...target.aliases, trimmed] });
    },

    // Status management
    setStatus: (targetId: string, status: TargetStatus) => updateTargetFields(targetId, { status }),
    mergeIntoTarget: mergeTargetsCascade,
    mergeTargetsCascade,
    reconcileTargetGraph,

    // Favorite & Pin
    toggleFavorite: (targetId: string) => {
      const target = useTargetStore.getState().targets.find((item) => item.id === targetId);
      if (!target) return;
      updateTargetFields(targetId, { isFavorite: !target.isFavorite });
    },
    togglePinned: (targetId: string) => {
      const target = useTargetStore.getState().targets.find((item) => item.id === targetId);
      if (!target) return;
      updateTargetFields(targetId, { isPinned: !target.isPinned });
    },
    favoriteTargets: targets.filter((target) => target.isFavorite),
    pinnedTargets: targets.filter((target) => target.isPinned),

    // Tag management
    addTag: (targetId: string, tag: string) => {
      const trimmed = tag.trim();
      const target = useTargetStore.getState().targets.find((item) => item.id === targetId);
      if (!target || !trimmed || target.tags.includes(trimmed)) return;
      updateTargetFields(targetId, { tags: [...target.tags, trimmed] });
    },
    removeTag: (targetId: string, tag: string) => {
      const target = useTargetStore.getState().targets.find((item) => item.id === targetId);
      if (!target) return;
      updateTargetFields(targetId, { tags: target.tags.filter((item) => item !== tag) });
    },
    setTags: (targetId: string, tags: string[]) => updateTargetFields(targetId, { tags }),
    getTargetsByTag: (tag: string) => targets.filter((target) => target.tags.includes(tag)),

    // Category management
    setCategory: (targetId: string, category: string | undefined) =>
      updateTargetFields(targetId, { category }),
    getTargetsByCategory: (category: string) =>
      targets.filter((target) => target.category === category),

    // Group management
    setGroup: (_targetId: string, _groupId: string | undefined) => {
      // Deprecated API. Group membership is sourced from TargetGroup.targetIds only.
    },
    addGroup,
    removeGroup,
    updateGroup,
    addTargetToGroup,
    removeTargetFromGroup,
    getGroupById,

    // Equipment
    updateEquipment,
    setRecommendedEquipment: updateEquipment,

    // Best image
    setBestImage: setTargetBestImage,

    // Image rating
    rateImage,
    clearImageRating,
    setImageRating: rateImage,
    removeImageRating: clearImageRating,

    // Scan & Auto-detect
    scanAndAutoDetect,
    getTargetStats,
    formatExposureTime,
  };
}
