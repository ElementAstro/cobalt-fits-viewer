/**
 * 共享备份进度显示组件
 * 提取 BackupProgressSheet 和 LANReceiveSheet 中重复的进度条 + 字节统计 UI
 */

import { View, Text } from "react-native";
import { Surface } from "heroui-native";
import { useI18n } from "../../i18n/useI18n";
import type { BackupProgress } from "../../lib/backup/types";
import { formatFileSize } from "../../lib/utils/fileManager";
import { formatEta } from "./BackupProgressSheet";

interface BackupProgressDisplayProps {
  progress: BackupProgress;
  showSpeed?: boolean;
  elapsedMs?: number;
}

export function BackupProgressDisplay({
  progress,
  showSpeed = false,
  elapsedMs = 0,
}: BackupProgressDisplayProps) {
  const { t } = useI18n();

  if (progress.total <= 0) return null;

  const percentage = Math.round((progress.current / progress.total) * 100);

  const hasByteProgress =
    progress.bytesTransferred != null && progress.bytesTotal != null && progress.bytesTotal > 0;

  const bytePercentage = hasByteProgress
    ? Math.round((progress.bytesTransferred! / progress.bytesTotal!) * 100)
    : percentage;

  const speed =
    showSpeed && hasByteProgress && elapsedMs > 1000
      ? Math.round((progress.bytesTransferred! / elapsedMs) * 1000)
      : 0;

  const eta =
    hasByteProgress && speed > 0 ? (progress.bytesTotal! - progress.bytesTransferred!) / speed : 0;

  return (
    <>
      {/* Progress bar */}
      <Surface variant="secondary" className="h-2 w-full overflow-hidden rounded-full">
        <View className="h-full rounded-full bg-accent" style={{ width: `${bytePercentage}%` }} />
      </Surface>

      <Text className="text-xs text-muted">
        {progress.current} / {progress.total} ({bytePercentage}%)
      </Text>

      {hasByteProgress && (
        <Text className="text-xs text-muted">
          {formatFileSize(progress.bytesTransferred!)} / {formatFileSize(progress.bytesTotal!)}
          {speed > 0 && ` · ${formatFileSize(speed)}/s`}
          {eta > 0 && ` · ${t("backup.eta")} ${formatEta(eta)}`}
        </Text>
      )}

      {progress.currentFile && (
        <Text className="text-xs text-muted" numberOfLines={1} ellipsizeMode="middle">
          {progress.currentFile}
        </Text>
      )}
    </>
  );
}
