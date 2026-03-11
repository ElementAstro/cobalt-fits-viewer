/**
 * 按需缩略图生成 Hook
 * 当缩略图缺失时自动触发生成，使用全局优先级调度器避免重复生成和竞争。
 */

import { useCallback } from "react";
import type { FitsMetadata } from "../../lib/fits/types";
import { resolveThumbnailUri } from "../../lib/gallery/thumbnailCache";
import {
  clearThumbnailSchedulerFailures,
  enqueueThumbnailRegeneration,
  getThumbnailSchedulerMetrics,
  type ThumbnailRequestPriority,
} from "../../lib/gallery/thumbnailScheduler";
import { useFitsStore } from "../../stores/files/useFitsStore";

export function useThumbnailOnDemand() {
  const updateFile = useFitsStore((s) => s.updateFile);

  const requestThumbnail = useCallback(
    (
      file: FitsMetadata,
      priority: ThumbnailRequestPriority = "background",
    ): Promise<{ fileId: string; uri: string | null }> => {
      if (file.sourceType === "audio") {
        return Promise.resolve({ fileId: file.id, uri: null });
      }

      const existingUri = resolveThumbnailUri(file.id, file.thumbnailUri);
      if (existingUri) {
        return Promise.resolve({ fileId: file.id, uri: existingUri });
      }

      return enqueueThumbnailRegeneration(file, {
        priority,
        reason: "gallery-on-demand",
      }).then((result) => {
        if (result.uri) {
          updateFile(result.fileId, { thumbnailUri: result.uri });
        }
        return result;
      });
    },
    [updateFile],
  );

  const resetFailed = useCallback(() => {
    clearThumbnailSchedulerFailures();
  }, []);

  const getMetrics = useCallback(() => getThumbnailSchedulerMetrics(), []);

  return { requestThumbnail, resetFailed, getMetrics };
}
