/**
 * Auto Solve Hook
 * 监听新文件导入，当 autoSolve 开启时自动提交 plate solving
 */

import { useEffect, useRef } from "react";
import { useFitsStore } from "../stores/useFitsStore";
import { useAstrometryStore } from "../stores/useAstrometryStore";
import { useAstrometry } from "./useAstrometry";
import { Logger } from "../lib/logger";

const TAG = "useAutoSolve";

export function useAutoSolve() {
  const { submitFile } = useAstrometry();
  const autoSolve = useAstrometryStore((s) => s.config.autoSolve);
  const apiKeyConfigured = useAstrometryStore((s) => !!s.config.apiKey);
  const files = useFitsStore((s) => s.files);

  const prevFileIdsRef = useRef<Set<string>>(new Set(files.map((f) => f.id)));

  useEffect(() => {
    if (!autoSolve || !apiKeyConfigured) return;

    const currentIds = new Set(files.map((f) => f.id));
    const newIds: string[] = [];

    for (const id of currentIds) {
      if (!prevFileIdsRef.current.has(id)) {
        newIds.push(id);
      }
    }

    prevFileIdsRef.current = currentIds;

    if (newIds.length === 0) return;

    Logger.info(TAG, `Auto-solving ${newIds.length} newly imported files`);
    for (const id of newIds) {
      submitFile(id);
    }
  }, [files, autoSolve, apiKeyConfigured, submitFile]);
}
