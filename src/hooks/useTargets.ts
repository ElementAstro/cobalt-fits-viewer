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
import {
  computeMergeRelinkPatch,
  computeTargetFileReconciliation,
  normalizeTargetMatch,
} from "../lib/targets/targetRelations";
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

function syncSessionTargetName(
  sessions: ReturnType<typeof useSessionStore.getState>["sessions"],
  sourceName: string,
  destName?: string,
) {
  return sessions.map((session) => {
    const replaced = session.targets
      .map((targetName) => (targetName === sourceName ? destName : targetName))
      .filter((targetName): targetName is string => Boolean(targetName));
    const deduped = uniqueStrings(replaced);
    if (
      deduped.length === session.targets.length &&
      deduped.every((value, idx) => value === session.targets[idx])
    ) {
      return session;
    }
    return {
      ...session,
      targets: deduped,
    };
  });
}

function applyTargetGraphPatch(patch: {
  targets: Target[];
  files: FitsMetadata[];
  groups: ReturnType<typeof useTargetGroupStore.getState>["groups"];
  sessions: ReturnType<typeof useSessionStore.getState>["sessions"];
}) {
  useTargetStore.setState({ targets: patch.targets });
  useFitsStore.setState({ files: patch.files });
  useTargetGroupStore.setState({ groups: patch.groups });
  useSessionStore.setState({ sessions: patch.sessions });
}

export function reconcileTargetGraphStores(): boolean {
  const patch = computeTargetFileReconciliation({
    targets: useTargetStore.getState().targets,
    files: useFitsStore.getState().files,
    groups: useTargetGroupStore.getState().groups,
    sessions: useSessionStore.getState().sessions,
  });

  if (!patch.changed) return false;
  applyTargetGraphPatch(patch);
  return true;
}

export function useTargets() {
  const targets = useTargetStore((s) => s.targets);
  const addTarget = useTargetStore((s) => s.addTarget);
  const removeTarget = useTargetStore((s) => s.removeTarget);
  const updateTarget = useTargetStore((s) => s.updateTarget);
  const addImageToTarget = useTargetStore((s) => s.addImageToTarget);
  const removeImageFromTarget = useTargetStore((s) => s.removeImageFromTarget);
  const addAlias = useTargetStore((s) => s.addAlias);
  const setStatus = useTargetStore((s) => s.setStatus);
  const toggleFavorite = useTargetStore((s) => s.toggleFavorite);
  const togglePinned = useTargetStore((s) => s.togglePinned);
  const addTag = useTargetStore((s) => s.addTag);
  const removeTag = useTargetStore((s) => s.removeTag);
  const setTags = useTargetStore((s) => s.setTags);
  const setCategory = useTargetStore((s) => s.setCategory);
  const setGroup = useTargetStore((s) => s.setGroup);
  const setRecommendedEquipment = useTargetStore((s) => s.setRecommendedEquipment);
  const setBestImage = useTargetStore((s) => s.setBestImage);
  const setImageRating = useTargetStore((s) => s.setImageRating);
  const removeImageRating = useTargetStore((s) => s.removeImageRating);
  const getFavoriteTargets = useTargetStore((s) => s.getFavoriteTargets);
  const getPinnedTargets = useTargetStore((s) => s.getPinnedTargets);
  const getTargetsByTag = useTargetStore((s) => s.getTargetsByTag);
  const getTargetsByCategory = useTargetStore((s) => s.getTargetsByCategory);

  const groups = useTargetGroupStore((s) => s.groups);
  const addGroup = useTargetGroupStore((s) => s.addGroup);
  const removeGroup = useTargetGroupStore((s) => s.removeGroup);
  const updateGroup = useTargetGroupStore((s) => s.updateGroup);
  const addTargetToGroup = useTargetGroupStore((s) => s.addTargetToGroup);
  const removeTargetFromGroup = useTargetGroupStore((s) => s.removeTargetFromGroup);
  const getGroupById = useTargetGroupStore((s) => s.getGroupById);
  const removeTargetFromAllGroups = useTargetGroupStore((s) => s.removeTargetFromAllGroups);
  const replaceTargetInGroups = useTargetGroupStore((s) => s.replaceTargetInGroups);

  const files = useFitsStore((s) => s.files);
  const updateFile = useFitsStore((s) => s.updateFile);

  const upsertAndLinkFileTarget = useCallback(
    (
      fileId: string,
      metadata: UpsertTargetMetadata = {},
      source: TargetLinkSource = "unknown",
    ): UpsertAndLinkResult | null => {
      const fileStore = useFitsStore.getState();
      const targetStore = useTargetStore.getState();
      const file = fileStore.getFileById(fileId);
      if (!file) return null;

      const targetName = metadata.object?.trim() || file.object?.trim();
      const aliasInputs = uniqueStrings(
        (metadata.aliases ?? []).map((alias) => alias.trim()).filter((alias) => alias.length > 0),
      );
      const match = normalizeTargetMatch({
        name: targetName,
        aliases: aliasInputs,
        targets: targetStore.targets,
      });

      let target = match;
      if (!target && metadata.ra !== undefined && metadata.dec !== undefined) {
        target =
          targetStore.targets.find(
            (candidate) =>
              candidate.ra !== undefined &&
              candidate.dec !== undefined &&
              isCoordinateMatch(metadata.ra!, metadata.dec!, candidate.ra, candidate.dec),
          ) ?? null;
      }

      let isNew = false;
      if (!target) {
        if (!targetName) return null;
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
        addTarget(nextTarget);
        target = nextTarget;
        isNew = true;
      } else {
        const existingTarget = target;
        const updates: Partial<Target> = {};
        if (metadata.ra !== undefined && existingTarget.ra !== metadata.ra) {
          updates.ra = metadata.ra;
        }
        if (metadata.dec !== undefined && existingTarget.dec !== metadata.dec) {
          updates.dec = metadata.dec;
        }
        if (metadata.status && existingTarget.status !== metadata.status) {
          updates.status = metadata.status;
        }
        if (metadata.category && existingTarget.category !== metadata.category) {
          updates.category = metadata.category;
        }
        if (metadata.notes && !existingTarget.notes) {
          updates.notes = metadata.notes;
        }
        if (metadata.type && existingTarget.type === "other") {
          updates.type = metadata.type;
        }
        if (metadata.tags && metadata.tags.length > 0) {
          updates.tags = uniqueStrings([...(existingTarget.tags ?? []), ...metadata.tags]);
        }
        if (targetName) {
          const knownAliases = findKnownAliases(targetName);
          const mergedAliases = uniqueStrings([
            ...existingTarget.aliases,
            ...aliasInputs,
            ...knownAliases,
            ...(targetName.toLowerCase() === existingTarget.name.toLowerCase() ? [] : [targetName]),
          ]);
          if (
            mergedAliases.length !== existingTarget.aliases.length ||
            mergedAliases.some((alias, idx) => alias !== existingTarget.aliases[idx])
          ) {
            updates.aliases = mergedAliases;
          }
        }
        if (Object.keys(updates).length > 0) {
          updateTarget(existingTarget.id, updates);
        }
      }

      if (!target) return null;

      addImageToTarget(target.id, fileId);
      if (file.targetId !== target.id) {
        fileStore.updateFile(fileId, { targetId: target.id });
      }

      const latest =
        useTargetStore.getState().targets.find((item) => item.id === target.id) ?? target;
      return {
        target: latest,
        targetId: latest.id,
        isNew,
        source,
      };
    },
    [addTarget, addImageToTarget, updateTarget],
  );

  const removeTargetCascade = useCallback(
    (targetId: string) => {
      const target = useTargetStore.getState().targets.find((item) => item.id === targetId);
      if (!target) return false;

      removeTarget(targetId);
      useFitsStore.setState((state) => ({
        files: state.files.map((file) =>
          file.targetId === targetId ? { ...file, targetId: undefined } : file,
        ),
      }));
      removeTargetFromAllGroups(targetId);
      useSessionStore.setState((state) => ({
        sessions: syncSessionTargetName(state.sessions, target.name),
      }));
      reconcileTargetGraphStores();
      return true;
    },
    [removeTarget, removeTargetFromAllGroups],
  );

  const mergeTargetsCascade = useCallback(
    (destId: string, sourceId: string) => {
      if (destId === sourceId) return null;
      const stateSnapshot = {
        targets: useTargetStore.getState().targets,
        files: useFitsStore.getState().files,
        groups: useTargetGroupStore.getState().groups,
        sessions: useSessionStore.getState().sessions,
      };
      const source = stateSnapshot.targets.find((target) => target.id === sourceId);
      if (!source) return null;

      replaceTargetInGroups(sourceId, destId);
      const patch = computeMergeRelinkPatch({
        ...stateSnapshot,
        groups: useTargetGroupStore.getState().groups,
        destId,
        sourceId,
      });
      if (!patch.changed) return null;

      applyTargetGraphPatch(patch);
      const mergedTarget = patch.targets.find((target) => target.id === destId) ?? null;
      if (mergedTarget) {
        useSessionStore.setState((state) => ({
          sessions: syncSessionTargetName(state.sessions, source.name, mergedTarget.name),
        }));
      }
      return mergedTarget;
    },
    [replaceTargetInGroups],
  );

  const renameTargetCascade = useCallback(
    (targetId: string, newName: string) => {
      const target = useTargetStore.getState().targets.find((item) => item.id === targetId);
      const trimmed = newName.trim();
      if (!target || !trimmed || target.name === trimmed) return false;

      const nextAliases = target.aliases.includes(target.name)
        ? target.aliases
        : [...target.aliases, target.name];
      updateTarget(targetId, { name: trimmed, aliases: uniqueStrings(nextAliases) });
      useSessionStore.setState((state) => ({
        sessions: syncSessionTargetName(state.sessions, target.name, trimmed),
      }));
      return true;
    },
    [updateTarget],
  );

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
      const existing = normalizeTargetMatch({
        name,
        targets: useTargetStore.getState().targets,
      });
      if (existing) {
        const mergedTags = options?.tags
          ? uniqueStrings([...(existing.tags ?? []), ...(options.tags ?? [])])
          : existing.tags;
        const updates: Partial<Target> = {
          ra: existing.ra ?? options?.ra,
          dec: existing.dec ?? options?.dec,
          notes: existing.notes ?? options?.notes,
          category: existing.category ?? options?.category,
          tags: mergedTags,
          isFavorite: options?.isFavorite ?? existing.isFavorite,
          groupId: options?.groupId ?? existing.groupId,
        };
        updateTarget(existing.id, updates);
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
      if (options?.groupId) target.groupId = options.groupId;
      const aliases = findKnownAliases(target.name);
      if (aliases.length > 0) {
        target.aliases = uniqueStrings([...target.aliases, ...aliases]);
      }
      addTarget(target);

      if (options?.groupId) {
        addTargetToGroup(options.groupId, target.id);
      }

      return target;
    },
    [addTarget, addTargetToGroup, updateTarget],
  );

  const updateTargetWithCascade = useCallback(
    (targetId: string, updates: Partial<Target>) => {
      const { name, ...rest } = updates;
      if (typeof name === "string") {
        renameTargetCascade(targetId, name);
      }
      if (Object.keys(rest).length > 0) {
        updateTarget(targetId, rest);
      }
    },
    [renameTargetCascade, updateTarget],
  );

  const getTargetStats = useCallback(
    (targetId: string) => {
      const target = targets.find((t) => t.id === targetId);
      if (!target) return null;

      const targetFiles = files.filter((f) => target.imageIds.includes(f.id));
      const exposureStats = calculateExposureStats(targetFiles);
      const completion = calculateCompletionRate(target, files);

      return {
        exposureStats,
        completion,
        filterExposure: calculateTargetExposure(target, files),
      };
    },
    [targets, files],
  );

  const associateImages = useCallback(
    (targetId: string, imageIds: string[]) => {
      for (const imageId of imageIds) {
        addImageToTarget(targetId, imageId);
        updateFile(imageId, { targetId });
      }
    },
    [addImageToTarget, updateFile],
  );

  const disassociateImages = useCallback(
    (targetId: string, imageIds: string[]) => {
      for (const imageId of imageIds) {
        removeImageFromTarget(targetId, imageId);
        const file = files.find((f) => f.id === imageId);
        if (file && file.targetId === targetId) {
          updateFile(imageId, { targetId: undefined });
        }
      }
    },
    [removeImageFromTarget, files, updateFile],
  );

  const updateEquipment = useCallback(
    (targetId: string, equipment: RecommendedEquipment) => {
      setRecommendedEquipment(targetId, equipment);
    },
    [setRecommendedEquipment],
  );

  const rateImage = useCallback(
    (targetId: string, imageId: string, rating: number) => {
      if (rating < 1 || rating > 5) return;
      setImageRating(targetId, imageId, rating);
    },
    [setImageRating],
  );

  const clearImageRating = useCallback(
    (targetId: string, imageId: string) => {
      removeImageRating(targetId, imageId);
    },
    [removeImageRating],
  );

  const setTargetBestImage = useCallback(
    (targetId: string, imageId: string | undefined) => {
      const target = targets.find((t) => t.id === targetId);
      if (!target) return;
      if (imageId && !target.imageIds.includes(imageId)) return;
      setBestImage(targetId, imageId);
    },
    [targets, setBestImage],
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
    addImageToTarget,
    removeImageFromTarget,
    associateImages,
    disassociateImages,
    upsertAndLinkFileTarget,

    // Alias management
    addAlias,

    // Status management
    setStatus,
    mergeIntoTarget: mergeTargetsCascade,
    mergeTargetsCascade,
    reconcileTargetGraph,

    // Favorite & Pin
    toggleFavorite,
    togglePinned,
    favoriteTargets: getFavoriteTargets(),
    pinnedTargets: getPinnedTargets(),

    // Tag management
    addTag,
    removeTag,
    setTags,
    getTargetsByTag,

    // Category management
    setCategory,
    getTargetsByCategory,

    // Group management
    setGroup,
    addGroup,
    removeGroup,
    updateGroup,
    addTargetToGroup,
    removeTargetFromGroup,
    getGroupById,

    // Equipment
    updateEquipment,
    setRecommendedEquipment,

    // Best image
    setBestImage: setTargetBestImage,

    // Image rating
    rateImage,
    clearImageRating,
    setImageRating,
    removeImageRating,

    // Scan & Auto-detect
    scanAndAutoDetect,
    getTargetStats,
    formatExposureTime,
  };
}
