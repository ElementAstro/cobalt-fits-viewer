/**
 * 备份数据概览 Hook — 计算将要备份的数据摘要和预估大小
 */

import { useMemo } from "react";
import { useFitsStore } from "../stores/useFitsStore";
import { useAlbumStore } from "../stores/useAlbumStore";
import { useTargetStore } from "../stores/useTargetStore";
import { useSessionStore } from "../stores/useSessionStore";

export interface BackupSummary {
  fileCount: number;
  albumCount: number;
  targetCount: number;
  sessionCount: number;
  planCount: number;
  estimatedBytes: number;
}

export function useBackupSummary(): BackupSummary {
  const files = useFitsStore((s) => s.files);
  const albums = useAlbumStore((s) => s.albums);
  const targets = useTargetStore((s) => s.targets);
  const sessions = useSessionStore((s) => s.sessions);
  const plans = useSessionStore((s) => s.plans);

  return useMemo(() => {
    let estimatedBytes = 0;
    for (const file of files) {
      estimatedBytes += file.fileSize ?? 0;
    }

    return {
      fileCount: files.length,
      albumCount: albums.length,
      targetCount: targets.length,
      sessionCount: sessions.length,
      planCount: plans.length,
      estimatedBytes,
    };
  }, [files, albums, targets, sessions, plans]);
}
