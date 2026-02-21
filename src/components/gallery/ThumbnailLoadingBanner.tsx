import { Text, View } from "react-native";
import { Alert, Spinner, Surface } from "heroui-native";
import { useI18n } from "../../i18n/useI18n";
import { formatBytes, type ThumbnailLoadingSummary } from "./thumbnailLoading";

interface ThumbnailLoadingBannerProps {
  summary: ThumbnailLoadingSummary | null;
}

export function ThumbnailLoadingBanner({ summary }: ThumbnailLoadingBannerProps) {
  const { t } = useI18n();
  if (!summary || summary.totalCount === 0 || summary.loadingCount <= 0) return null;

  const percent = Math.round(Math.max(0, Math.min(1, summary.progress)) * 100);
  const detail =
    summary.totalBytes > 0
      ? t("gallery.thumbnailBytesProgress", {
          loaded: formatBytes(summary.loadedBytes),
          total: formatBytes(summary.totalBytes),
        })
      : t("gallery.thumbnailCountProgress", {
          completed: summary.completedCount,
          total: summary.totalCount,
        });

  return (
    <Surface variant="secondary" className="mb-3 p-2">
      <Alert status={summary.errorCount > 0 ? "warning" : "accent"}>
        <Alert.Indicator>
          <Spinner size="sm" color={summary.errorCount > 0 ? "warning" : "default"} />
        </Alert.Indicator>
        <Alert.Content>
          <Alert.Title>{t("gallery.thumbnailLoadingTitle")}</Alert.Title>
          <Alert.Description>{detail}</Alert.Description>
        </Alert.Content>
      </Alert>
      <View className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-tertiary">
        <View className="h-full rounded-full bg-success" style={{ width: `${percent}%` }} />
      </View>
      <View className="mt-1 flex-row items-center justify-between">
        <Text className="text-[10px] text-muted">
          {t("gallery.thumbnailCountProgress", {
            completed: summary.completedCount,
            total: summary.totalCount,
          })}
        </Text>
        <Text className="text-[10px] font-semibold text-foreground">{percent}%</Text>
      </View>
    </Surface>
  );
}
