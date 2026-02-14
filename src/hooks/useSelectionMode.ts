/**
 * 通用选择模式 Hook
 * 统一管理 isSelectionMode, selectedIds, toggleSelection 等逻辑
 */

import { useState, useCallback } from "react";

export function useSelectionMode() {
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id],
    );
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
    setSelectedIds(ids);
  }, []);

  return {
    isSelectionMode,
    selectedIds,
    toggleSelection,
    enterSelectionMode,
    exitSelectionMode,
    selectAll,
  };
}
