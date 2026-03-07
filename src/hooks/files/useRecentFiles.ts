import { useMemo } from "react";
import { useFitsStore } from "../../stores/files/useFitsStore";
import type { FitsMetadata } from "../../lib/fits/types";

const MAX_RECENT = 20;

export interface RecentPeriod {
  key: string;
  labelKey: string;
  files: FitsMetadata[];
}

const PERIOD_ORDER = ["today", "yesterday", "thisWeek", "earlier"];
const PERIOD_LABELS: Record<string, string> = {
  today: "files.today",
  yesterday: "files.yesterday",
  thisWeek: "files.thisWeek",
  earlier: "files.earlier",
};

function getPeriodKey(timestamp: number): string {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (timestamp >= todayStart) return "today";
  if (timestamp >= todayStart - 86400000) return "yesterday";
  if (timestamp >= todayStart - 6 * 86400000) return "thisWeek";
  return "earlier";
}

export function useRecentFiles() {
  const files = useFitsStore((s) => s.files);

  const recentFiles = useMemo(() => {
    return files
      .map((f) => ({ file: f, ts: f.lastViewed ?? f.importDate }))
      .filter((item) => item.ts > 0)
      .sort((a, b) => b.ts - a.ts)
      .slice(0, MAX_RECENT)
      .map((item) => item.file);
  }, [files]);

  const recentByPeriod = useMemo<RecentPeriod[]>(() => {
    const groups = new Map<string, FitsMetadata[]>();
    for (const file of recentFiles) {
      const ts = file.lastViewed ?? file.importDate;
      const key = getPeriodKey(ts);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(file);
    }
    return PERIOD_ORDER.filter((key) => groups.has(key)).map((key) => ({
      key,
      labelKey: PERIOD_LABELS[key],
      files: groups.get(key)!,
    }));
  }, [recentFiles]);

  const hasRecent = recentFiles.length > 0;

  return { recentFiles, recentByPeriod, hasRecent };
}
