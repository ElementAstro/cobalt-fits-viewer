/**
 * Header Editor Hook
 * 管理 FITS header 编辑状态、撤销/重做、保存
 * 复用 useImageEditor 的 history 栈模式（简化版）
 */

import { useState, useCallback, useRef } from "react";
import type { HeaderKeyword } from "../lib/fits/types";
import { writeHeaderKeywords, deleteHeaderKeywords } from "../lib/fits/headerWriter";
import { isProtectedKeyword, validateHeaderRecord } from "../lib/fits/headerValidator";
import { LOG_TAGS, Logger } from "../lib/logger";

const TAG = LOG_TAGS.FitsHeaderWriter;
const DEFAULT_MAX_HISTORY = 50;

export interface UseHeaderEditorOptions {
  maxHistory?: number;
}

export interface UseHeaderEditorReturn {
  headers: HeaderKeyword[];
  isDirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  historyIndex: number;
  historyLength: number;
  isSaving: boolean;
  saveError: string | null;

  initialize: (keywords: HeaderKeyword[]) => void;
  editKeyword: (index: number, updates: Partial<HeaderKeyword>) => void;
  addKeyword: (keyword: HeaderKeyword) => void;
  deleteKeyword: (index: number) => void;
  undo: () => void;
  redo: () => void;
  save: (filePath: string) => Promise<boolean>;
  reset: () => void;
  clearSaveError: () => void;
}

function cloneKeywords(keywords: HeaderKeyword[]): HeaderKeyword[] {
  return keywords.map((kw) => ({ ...kw }));
}

export function useHeaderEditor(options: UseHeaderEditorOptions = {}): UseHeaderEditorReturn {
  const maxHistory = Math.max(1, Math.min(200, options.maxHistory ?? DEFAULT_MAX_HISTORY));

  const historyRef = useRef<HeaderKeyword[][]>([]);
  const historyIndexRef = useRef(-1);
  const originalRef = useRef<HeaderKeyword[]>([]);

  const [headers, setHeaders] = useState<HeaderKeyword[]>([]);
  const [historyLength, setHistoryLength] = useState(0);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const syncState = useCallback((index: number, length: number) => {
    setHistoryIndex(index);
    setHistoryLength(length);
    setHeaders(cloneKeywords(historyRef.current[index] ?? []));
  }, []);

  const pushSnapshot = useCallback(
    (snapshot: HeaderKeyword[]) => {
      const history = historyRef.current;
      const idx = historyIndexRef.current;

      // Truncate future history
      const nextHistory = history.slice(0, idx + 1);
      nextHistory.push(cloneKeywords(snapshot));

      // Trim to max
      const trimmed =
        nextHistory.length > maxHistory
          ? nextHistory.slice(nextHistory.length - maxHistory)
          : nextHistory;

      historyRef.current = trimmed;
      historyIndexRef.current = trimmed.length - 1;
      syncState(historyIndexRef.current, trimmed.length);
    },
    [maxHistory, syncState],
  );

  const initialize = useCallback(
    (keywords: HeaderKeyword[]) => {
      const cloned = cloneKeywords(keywords);
      originalRef.current = cloneKeywords(keywords);
      historyRef.current = [cloned];
      historyIndexRef.current = 0;
      setSaveError(null);
      syncState(0, 1);
    },
    [syncState],
  );

  const editKeyword = useCallback(
    (index: number, updates: Partial<HeaderKeyword>) => {
      const current = historyRef.current[historyIndexRef.current];
      if (!current || index < 0 || index >= current.length) return;

      const next = cloneKeywords(current);
      const target = next[index];

      // Protected keywords: cannot change key name
      if (
        updates.key !== undefined &&
        updates.key !== target.key &&
        isProtectedKeyword(target.key)
      ) {
        return;
      }

      next[index] = { ...target, ...updates };
      pushSnapshot(next);
      Logger.debug(TAG, `Keyword edited: ${target.key}`, { index });
    },
    [pushSnapshot],
  );

  const addKeyword = useCallback(
    (keyword: HeaderKeyword) => {
      const errors = validateHeaderRecord(keyword);
      if (errors.length > 0) return;

      const current = historyRef.current[historyIndexRef.current];
      if (!current) return;

      const next = cloneKeywords(current);
      next.push({ ...keyword });
      pushSnapshot(next);
      Logger.debug(TAG, `Keyword added: ${keyword.key}`);
    },
    [pushSnapshot],
  );

  const deleteKeyword = useCallback(
    (index: number) => {
      const current = historyRef.current[historyIndexRef.current];
      if (!current || index < 0 || index >= current.length) return;

      const target = current[index];
      if (isProtectedKeyword(target.key)) return;

      const next = cloneKeywords(current);
      next.splice(index, 1);
      pushSnapshot(next);
      Logger.debug(TAG, `Keyword deleted: ${target.key}`, { index });
    },
    [pushSnapshot],
  );

  const undo = useCallback(() => {
    const idx = historyIndexRef.current;
    if (idx <= 0) return;
    const newIdx = idx - 1;
    historyIndexRef.current = newIdx;
    syncState(newIdx, historyRef.current.length);
  }, [syncState]);

  const redo = useCallback(() => {
    const idx = historyIndexRef.current;
    if (idx >= historyRef.current.length - 1) return;
    const newIdx = idx + 1;
    historyIndexRef.current = newIdx;
    syncState(newIdx, historyRef.current.length);
  }, [syncState]);

  const save = useCallback(
    async (filePath: string): Promise<boolean> => {
      const current = historyRef.current[historyIndexRef.current];
      const original = originalRef.current;
      if (!current) return false;

      setIsSaving(true);
      setSaveError(null);

      try {
        // Build map of original keywords by key
        const originalMap = new Map<string, HeaderKeyword>();
        for (const kw of original) {
          originalMap.set(kw.key, kw);
        }

        // Find updated + new entries
        const toWrite: Array<{ key: string; value: string | number | boolean; comment?: string }> =
          [];
        for (const kw of current) {
          if (kw.value === null) continue;
          const orig = originalMap.get(kw.key);
          if (!orig || orig.value !== kw.value || orig.comment !== kw.comment) {
            toWrite.push({ key: kw.key, value: kw.value, comment: kw.comment });
          }
        }

        // Find deleted keys
        const currentKeys = new Set(current.map((kw) => kw.key));
        const toDelete: string[] = [];
        for (const kw of original) {
          if (!currentKeys.has(kw.key) && !isProtectedKeyword(kw.key)) {
            toDelete.push(kw.key);
          }
        }

        let totalChanges = 0;

        // Write updates + new entries
        if (toWrite.length > 0) {
          const count = await writeHeaderKeywords(filePath, toWrite);
          totalChanges += count;
        }

        // Delete removed entries
        if (toDelete.length > 0) {
          const count = await deleteHeaderKeywords(filePath, toDelete);
          totalChanges += count;
        }

        // Reset history with current as new baseline
        originalRef.current = cloneKeywords(current);
        historyRef.current = [cloneKeywords(current)];
        historyIndexRef.current = 0;
        syncState(0, 1);

        Logger.info(TAG, `Header saved: ${totalChanges} changes`, { filePath });
        return true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to save header";
        setSaveError(msg);
        Logger.error(TAG, "Header save failed", e);
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [syncState],
  );

  const reset = useCallback(() => {
    const original = originalRef.current;
    historyRef.current = [cloneKeywords(original)];
    historyIndexRef.current = 0;
    setSaveError(null);
    syncState(0, 1);
  }, [syncState]);

  const clearSaveError = useCallback(() => {
    setSaveError(null);
  }, []);

  return {
    headers,
    isDirty: historyIndex > 0,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < historyLength - 1,
    historyIndex,
    historyLength,
    isSaving,
    saveError,
    initialize,
    editKeyword,
    addKeyword,
    deleteKeyword,
    undo,
    redo,
    save,
    reset,
    clearSaveError,
  };
}
