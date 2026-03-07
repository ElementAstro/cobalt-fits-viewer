import { useEffect, useMemo, useState } from "react";
import { ScrollView, View, Text } from "react-native";
import { BottomSheet, Card, Separator, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";
import { useFitsStore } from "../../stores/files/useFitsStore";
import { useFileGroupStore } from "../../stores/files/useFileGroupStore";
import { analyzeStorage, getDiskUsage } from "../../lib/gallery/storageAnalytics";
import { formatFileSize } from "../../lib/utils/fileManager";

interface StorageAnalyticsSheetProps {
  visible: boolean;
  onClose: () => void;
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <View className="h-2 w-full rounded-full bg-surface-secondary overflow-hidden">
      <View className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
    </View>
  );
}

const TYPE_COLORS: Record<string, string> = {
  fits: "#3b82f6",
  raster: "#22c55e",
  video: "#f59e0b",
  audio: "#8b5cf6",
  unknown: "#6b7280",
};

const FRAME_COLORS: Record<string, string> = {
  light: "#f59e0b",
  dark: "#6366f1",
  flat: "#22c55e",
  bias: "#ec4899",
  darkflat: "#14b8a6",
  unknown: "#6b7280",
};

export function StorageAnalyticsSheet({ visible, onClose }: StorageAnalyticsSheetProps) {
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");

  const allFiles = useFitsStore((s) => s.files);
  const groups = useFileGroupStore((s) => s.groups);
  const fileGroupMap = useFileGroupStore((s) => s.fileGroupMap);

  const [freeDisk, setFreeDisk] = useState<number | null>(null);

  const analytics = useMemo(
    () => analyzeStorage(allFiles, fileGroupMap, groups),
    [allFiles, fileGroupMap, groups],
  );

  useEffect(() => {
    if (!visible) return;
    getDiskUsage().then((result) => setFreeDisk(result.free));
  }, [visible]);

  return (
    <BottomSheet isOpen={visible} onOpenChange={(open) => !open && onClose()}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content snapPoints={["80%"]}>
          <View className="px-4 py-2">
            <BottomSheet.Title>{t("files.storageAnalytics")}</BottomSheet.Title>
            <Text className="text-xs text-muted">
              {analytics.totalFiles} {t("album.images")} · {formatFileSize(analytics.totalSize)}
            </Text>
          </View>

          <Separator />

          <ScrollView className="px-4 py-3" showsVerticalScrollIndicator={false}>
            {/* Disk Usage */}
            {freeDisk !== null && (
              <Card variant="secondary" className="mb-3">
                <Card.Body className="p-3 gap-2">
                  <View className="flex-row items-center gap-2">
                    <Ionicons name="hardware-chip-outline" size={16} color={mutedColor} />
                    <Text className="text-xs font-semibold text-foreground">
                      {t("files.diskUsage")}
                    </Text>
                  </View>
                  <ProgressBar
                    value={analytics.totalSize}
                    max={analytics.totalSize + freeDisk}
                    color="#3b82f6"
                  />
                  <View className="flex-row justify-between">
                    <Text className="text-[10px] text-muted">
                      {t("files.used")}: {formatFileSize(analytics.totalSize)}
                    </Text>
                    <Text className="text-[10px] text-muted">
                      {t("files.free")}: {formatFileSize(freeDisk)}
                    </Text>
                  </View>
                </Card.Body>
              </Card>
            )}

            {/* By Media Type */}
            <Card variant="secondary" className="mb-3">
              <Card.Body className="p-3 gap-2">
                <Text className="text-xs font-semibold text-foreground">
                  {t("files.byMediaType")}
                </Text>
                {analytics.byMediaType.map((item) => (
                  <View key={item.type} className="gap-1">
                    <View className="flex-row justify-between">
                      <Text className="text-[10px] text-foreground">
                        {item.type.toUpperCase()} ({item.count})
                      </Text>
                      <Text className="text-[10px] text-muted">{formatFileSize(item.size)}</Text>
                    </View>
                    <ProgressBar
                      value={item.size}
                      max={analytics.totalSize}
                      color={TYPE_COLORS[item.type] ?? "#6b7280"}
                    />
                  </View>
                ))}
              </Card.Body>
            </Card>

            {/* By Frame Type */}
            <Card variant="secondary" className="mb-3">
              <Card.Body className="p-3 gap-2">
                <Text className="text-xs font-semibold text-foreground">
                  {t("files.byFrameType")}
                </Text>
                {analytics.byFrameType.map((item) => (
                  <View key={item.type} className="gap-1">
                    <View className="flex-row justify-between">
                      <Text className="text-[10px] text-foreground">
                        {item.type} ({item.count})
                      </Text>
                      <Text className="text-[10px] text-muted">{formatFileSize(item.size)}</Text>
                    </View>
                    <ProgressBar
                      value={item.size}
                      max={analytics.totalSize}
                      color={FRAME_COLORS[item.type] ?? "#6b7280"}
                    />
                  </View>
                ))}
              </Card.Body>
            </Card>

            {/* By Folder */}
            {(analytics.byGroup.length > 0 || analytics.ungroupedCount > 0) && (
              <Card variant="secondary" className="mb-3">
                <Card.Body className="p-3 gap-2">
                  <Text className="text-xs font-semibold text-foreground">
                    {t("files.byFolder")}
                  </Text>
                  {analytics.byGroup.map((item) => (
                    <View key={item.groupId} className="gap-1">
                      <View className="flex-row justify-between">
                        <Text className="text-[10px] text-foreground">
                          {item.name} ({item.count})
                        </Text>
                        <Text className="text-[10px] text-muted">{formatFileSize(item.size)}</Text>
                      </View>
                      <ProgressBar value={item.size} max={analytics.totalSize} color="#14b8a6" />
                    </View>
                  ))}
                  {analytics.ungroupedCount > 0 && (
                    <View className="gap-1">
                      <View className="flex-row justify-between">
                        <Text className="text-[10px] text-muted">
                          {t("files.ungroupedFiles")} ({analytics.ungroupedCount})
                        </Text>
                        <Text className="text-[10px] text-muted">
                          {formatFileSize(analytics.ungroupedSize)}
                        </Text>
                      </View>
                      <ProgressBar
                        value={analytics.ungroupedSize}
                        max={analytics.totalSize}
                        color="#6b7280"
                      />
                    </View>
                  )}
                </Card.Body>
              </Card>
            )}

            {/* By Month */}
            {analytics.byMonth.length > 0 && (
              <Card variant="secondary" className="mb-3">
                <Card.Body className="p-3 gap-2">
                  <Text className="text-xs font-semibold text-foreground">
                    {t("files.byMonth")}
                  </Text>
                  {analytics.byMonth.slice(0, 12).map((item) => (
                    <View key={item.month} className="gap-1">
                      <View className="flex-row justify-between">
                        <Text className="text-[10px] text-foreground">
                          {item.month} ({item.count})
                        </Text>
                        <Text className="text-[10px] text-muted">{formatFileSize(item.size)}</Text>
                      </View>
                      <ProgressBar value={item.size} max={analytics.totalSize} color="#f59e0b" />
                    </View>
                  ))}
                </Card.Body>
              </Card>
            )}
          </ScrollView>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
