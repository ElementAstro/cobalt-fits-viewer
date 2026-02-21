import { Text, View } from "react-native";
import { useI18n } from "../../i18n/useI18n";
import { formatBytes, type ThumbnailLoadSnapshot } from "./thumbnailLoading";

interface ThumbnailProgressOverlayProps {
  snapshot: ThumbnailLoadSnapshot;
}

export function ThumbnailProgressOverlay({ snapshot }: ThumbnailProgressOverlayProps) {
  const { t } = useI18n();
  if (snapshot.stage === "ready") return null;

  const percent = Math.round(Math.max(0, Math.min(1, snapshot.progress)) * 100);
  const stageLabel =
    snapshot.stage === "loading"
      ? t("gallery.thumbnailStageLoading")
      : snapshot.stage === "decoding"
        ? t("gallery.thumbnailStageDecoding")
        : snapshot.stage === "error"
          ? t("gallery.thumbnailStageError")
          : t("gallery.thumbnailStageWaiting");
  const detail =
    snapshot.hasByteProgress && snapshot.totalBytes > 0
      ? t("gallery.thumbnailBytesProgress", {
          loaded: formatBytes(snapshot.loadedBytes),
          total: formatBytes(snapshot.totalBytes),
        })
      : stageLabel;

  return (
    <View className="absolute bottom-1 left-1 right-1 rounded-md bg-black/65 px-1.5 py-1">
      <View className="flex-row items-center justify-between">
        <Text className="text-[8px] text-white/90" numberOfLines={1}>
          {detail}
        </Text>
        <Text className="text-[8px] font-semibold text-white">{percent}%</Text>
      </View>
      <View className="mt-1 h-1 overflow-hidden rounded-full bg-white/20">
        <View className="h-full rounded-full bg-success" style={{ width: `${percent}%` }} />
      </View>
    </View>
  );
}
