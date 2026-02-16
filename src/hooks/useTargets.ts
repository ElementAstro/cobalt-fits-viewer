/**
 * 目标管理 Hook
 */

import { useCallback, useMemo } from "react";
import { useTargetStore } from "../stores/useTargetStore";
import { useTargetGroupStore } from "../stores/useTargetGroupStore";
import { useFitsStore } from "../stores/useFitsStore";
import {
  autoDetectTarget,
  calculateTargetExposure,
  createTarget,
} from "../lib/targets/targetManager";
import { findKnownAliases } from "../lib/targets/targetMatcher";
import {
  calculateExposureStats,
  calculateCompletionRate,
  formatExposureTime,
} from "../lib/targets/exposureStats";
import type { TargetType, RecommendedEquipment } from "../lib/fits/types";

export function useTargets() {
  const targets = useTargetStore((s) => s.targets);
  const addTarget = useTargetStore((s) => s.addTarget);
  const removeTarget = useTargetStore((s) => s.removeTarget);
  const updateTarget = useTargetStore((s) => s.updateTarget);
  const addImageToTarget = useTargetStore((s) => s.addImageToTarget);
  const removeImageFromTarget = useTargetStore((s) => s.removeImageFromTarget);
  const addAlias = useTargetStore((s) => s.addAlias);
  const setStatus = useTargetStore((s) => s.setStatus);
  const mergeIntoTarget = useTargetStore((s) => s.mergeIntoTarget);
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

  const files = useFitsStore((s) => s.files);
  const updateFile = useFitsStore((s) => s.updateFile);

  const scanAndAutoDetect = useCallback((): { newCount: number; updatedCount: number } => {
    const localTargets = [...targets];
    let newCount = 0;
    let updatedCount = 0;

    for (const file of files) {
      if (file.targetId) continue;

      const result = autoDetectTarget(file, localTargets);
      if (!result) continue;

      if (result.isNew) {
        localTargets.push(result.target);
        addTarget(result.target);
        addImageToTarget(result.target.id, file.id);
        updateFile(file.id, { targetId: result.target.id });

        const aliases = findKnownAliases(result.target.name);
        for (const alias of aliases) {
          addAlias(result.target.id, alias);
        }
        newCount++;
      } else {
        addImageToTarget(result.target.id, file.id);
        updateFile(file.id, { targetId: result.target.id });

        if (result.coordinateUpdates) {
          updateTarget(result.target.id, result.coordinateUpdates);
        }
        updatedCount++;
      }
    }

    return { newCount, updatedCount };
  }, [files, targets, addTarget, addImageToTarget, addAlias, updateFile, updateTarget]);

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
      const target = createTarget(name, type);
      if (options?.ra !== undefined) target.ra = options.ra;
      if (options?.dec !== undefined) target.dec = options.dec;
      if (options?.notes) target.notes = options.notes;
      if (options?.category) target.category = options.category;
      if (options?.tags) target.tags = options.tags;
      if (options?.isFavorite !== undefined) target.isFavorite = options.isFavorite;
      if (options?.groupId) target.groupId = options.groupId;
      addTarget(target);

      if (options?.groupId) {
        addTargetToGroup(options.groupId, target.id);
      }

      return target;
    },
    [addTarget, addTargetToGroup],
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
    removeTarget,
    updateTarget,

    // Image management
    addImageToTarget,
    removeImageFromTarget,
    associateImages,
    disassociateImages,

    // Alias management
    addAlias,

    // Status management
    setStatus,
    mergeIntoTarget,

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
