/**
 * 通用选择模式 Hook
 * 统一管理 isSelectionMode, selectedIds, toggleSelection 等逻辑
 */

import { useState, useCallback } from "react";

export function useSelectionMode() {
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id];
      setIsSelectionMode(next.length > 0);
      return next;
    });
  }, []);

  const enterSelectionMode = useCallback((initialId?: string) => {
    setIsSelectionMode(true);
    setSelectedIds(initialId ? [initialId] : []);
  }, []);

  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedIds([]);
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    const uniqueIds: string[] = [];
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) continue;
      seen.add(id);
      uniqueIds.push(id);
    }
    setSelectedIds(uniqueIds);
    setIsSelectionMode(uniqueIds.length > 0);
  }, []);

  const reconcileSelection = useCallback((visibleIds: string[]) => {
    const visibleSet = new Set(visibleIds);
    setSelectedIds((prev) => {
      const next = prev.filter((id) => visibleSet.has(id));
      setIsSelectionMode(next.length > 0);
      return next;
    });
  }, []);

  return {
    isSelectionMode,
    selectedIds,
    toggleSelection,
    enterSelectionMode,
    exitSelectionMode,
    selectAll,
    reconcileSelection,
  };
}
