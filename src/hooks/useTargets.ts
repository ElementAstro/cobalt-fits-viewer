/**
 * 目标管理 Hook
 */

import { useCallback } from "react";
import { useTargetStore } from "../stores/useTargetStore";
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
import type { TargetType } from "../lib/fits/types";

export function useTargets() {
  const targets = useTargetStore((s) => s.targets);
  const addTarget = useTargetStore((s) => s.addTarget);
  const removeTarget = useTargetStore((s) => s.removeTarget);
  const updateTarget = useTargetStore((s) => s.updateTarget);
  const addImageToTarget = useTargetStore((s) => s.addImageToTarget);
  const addAlias = useTargetStore((s) => s.addAlias);
  const setStatus = useTargetStore((s) => s.setStatus);
  const mergeIntoTarget = useTargetStore((s) => s.mergeIntoTarget);

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
      options?: { ra?: number; dec?: number; notes?: string },
    ) => {
      const target = createTarget(name, type);
      if (options?.ra !== undefined) target.ra = options.ra;
      if (options?.dec !== undefined) target.dec = options.dec;
      if (options?.notes) target.notes = options.notes;
      addTarget(target);
      return target;
    },
    [addTarget],
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

  return {
    targets,
    addTarget: createNewTarget,
    removeTarget,
    updateTarget,
    addImageToTarget,
    addAlias,
    setStatus,
    mergeIntoTarget,
    scanAndAutoDetect,
    getTargetStats,
    formatExposureTime,
  };
}
