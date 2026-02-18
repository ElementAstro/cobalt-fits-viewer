/**
 * 目标搜索 Hook
 */

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useTargetStore } from "../stores/useTargetStore";
import { useTargets } from "./useTargets";
import { searchTargets, type SearchConditions } from "../lib/targets/targetSearch";
import {
  detectDuplicates,
  findDuplicatesOf,
  type DuplicateDetectionResult,
  type DuplicateGroup,
} from "../lib/targets/duplicateDetector";

const DEBOUNCE_MS = 300;

interface SearchIndexItem {
  targetId: string;
  targetName: string;
  searchBlob: string;
  aliases: string[];
  tags: string[];
  category?: string;
}

export function useTargetSearch() {
  const targets = useTargetStore((s) => s.targets);
  const searchIndex = useMemo<SearchIndexItem[]>(() => {
    return targets.map((target) => ({
      targetId: target.id,
      targetName: target.name ?? "",
      aliases: target.aliases ?? [],
      tags: target.tags ?? [],
      category: target.category,
      searchBlob: [
        target.name ?? "",
        ...(target.aliases ?? []),
        ...(target.tags ?? []),
        target.notes ?? "",
      ]
        .join("|")
        .toLowerCase(),
    }));
  }, [targets]);

  // 搜索状态
  const [query, setQuery] = useState("");
  const [conditions, setConditions] = useState<SearchConditions>({});
  const [isAdvancedMode, setIsAdvancedMode] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // 防抖处理
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = setTimeout(() => {
      setDebouncedQuery(query);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [query]);

  // 执行搜索
  const searchResult = useMemo(() => {
    if (!isAdvancedMode && debouncedQuery) {
      const q = debouncedQuery.trim().toLowerCase();
      const idSet = new Set(
        searchIndex.filter((item) => item.searchBlob.includes(q)).map((item) => item.targetId),
      );
      const results = targets.filter((target) => idSet.has(target.id));
      return {
        targets: results,
        matchCount: results.length,
        conditions: { query: debouncedQuery },
      };
    }

    const searchConditions = isAdvancedMode
      ? { ...conditions, query: debouncedQuery || conditions.query }
      : { query: debouncedQuery };

    if (!searchConditions.query && Object.keys(searchConditions).length === 0) {
      return { targets, matchCount: targets.length, conditions: {} };
    }

    return searchTargets(targets, searchConditions);
  }, [targets, debouncedQuery, conditions, isAdvancedMode, searchIndex]);

  // 搜索建议
  const suggestions = useMemo(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) return [];
    const q = debouncedQuery.trim().toLowerCase();
    const suggestionSet = new Set<string>();
    for (const item of searchIndex) {
      if (item.targetName.toLowerCase().includes(q)) {
        suggestionSet.add(item.targetName);
      }
      for (const alias of item.aliases) {
        if (alias.toLowerCase().includes(q)) {
          suggestionSet.add(alias);
        }
      }
      for (const tag of item.tags) {
        if (tag.toLowerCase().includes(q)) {
          suggestionSet.add(tag);
        }
      }
      if (item.category?.toLowerCase().includes(q)) {
        suggestionSet.add(item.category);
      }
      if (suggestionSet.size >= 10) break;
    }
    return Array.from(suggestionSet).slice(0, 10);
  }, [searchIndex, debouncedQuery]);

  // 更新搜索条件
  const updateCondition = useCallback(
    <K extends keyof SearchConditions>(key: K, value: SearchConditions[K]) => {
      setConditions((prev) => ({
        ...prev,
        [key]: value,
      }));
    },
    [],
  );

  // 清除条件
  const clearCondition = useCallback((key: keyof SearchConditions) => {
    setConditions((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  // 清除所有条件
  const clearAllConditions = useCallback(() => {
    setConditions({});
    setQuery("");
  }, []);

  // 重置搜索
  const reset = useCallback(() => {
    setQuery("");
    setConditions({});
    setIsAdvancedMode(false);
  }, []);

  return {
    // 状态
    query,
    conditions,
    isAdvancedMode,
    results: searchResult.targets,
    matchCount: searchResult.matchCount,
    suggestions,

    // 操作
    setQuery,
    setConditions,
    setIsAdvancedMode,
    updateCondition,
    clearCondition,
    clearAllConditions,
    reset,
  };
}

export function useDuplicateDetection() {
  const targets = useTargetStore((s) => s.targets);
  const { mergeTargetsCascade } = useTargets();

  const [detectionResult, setDetectionResult] = useState<DuplicateDetectionResult | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);

  // 执行检测
  const detect = useCallback(() => {
    setIsDetecting(true);
    // 使用 setTimeout 模拟异步处理，避免阻塞 UI
    setTimeout(() => {
      const result = detectDuplicates(targets);
      setDetectionResult(result);
      setIsDetecting(false);
    }, 0);
  }, [targets]);

  // 查找特定目标的重复项
  const findDuplicates = useCallback(
    (targetId: string) => {
      return findDuplicatesOf(targets, targetId);
    },
    [targets],
  );

  // 合并重复目标
  const mergeDuplicates = useCallback(
    (group: DuplicateGroup) => {
      if (group.targets.length < 2) return;

      // 按图片数量排序，保留图片最多的
      const sorted = [...group.targets].sort((a, b) => b.imageIds.length - a.imageIds.length);
      const primary = sorted[0];

      // 合并其他目标到主目标
      for (let i = 1; i < sorted.length; i++) {
        mergeTargetsCascade(primary.id, sorted[i].id);
      }

      // 重新检测
      detect();
    },
    [mergeTargetsCascade, detect],
  );

  // 清除检测结果
  const clearDetection = useCallback(() => {
    setDetectionResult(null);
  }, []);

  return {
    detectionResult,
    isDetecting,
    detect,
    findDuplicates,
    mergeDuplicates,
    clearDetection,
  };
}
