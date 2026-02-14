/**
 * 地图标记点详情底部弹窗 - 展示某位置的文件列表
 */

import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Separator, useThemeColor } from "heroui-native";
import { useI18n } from "../../i18n/useI18n";
import type { LocationCluster } from "./LocationMapView";
import { ThumbnailGrid } from "./ThumbnailGrid";
import type { FitsMetadata } from "../../lib/fits/types";

interface LocationMarkerSheetProps {
  cluster: LocationCluster | null;
  onClose: () => void;
  onFilePress: (file: FitsMetadata) => void;
}

export function LocationMarkerSheet({ cluster, onClose, onFilePress }: LocationMarkerSheetProps) {
  const { t } = useI18n();
  const [mutedColor, successColor] = useThemeColor(["muted", "success"]);

  if (!cluster) return null;

  const loc = cluster.location;
  const subtitle = [loc.city, loc.region, loc.country].filter(Boolean).join(", ");

  return (
    <View className="absolute bottom-0 left-0 right-0 max-h-[50%] rounded-t-2xl bg-surface-secondary border-t border-separator">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Ionicons name="location" size={16} color={successColor} />
            <Text className="text-base font-bold text-foreground" numberOfLines={1}>
              {cluster.location.placeName ?? cluster.location.city ?? cluster.id}
            </Text>
          </View>
          {subtitle ? (
            <Text className="mt-0.5 text-xs text-muted" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
          <Text className="mt-0.5 text-[10px] text-muted">
            {loc.latitude.toFixed(4)}°, {loc.longitude.toFixed(4)}°
            {loc.altitude ? ` · ${Math.round(loc.altitude)}m` : ""}
          </Text>
        </View>
        <TouchableOpacity onPress={onClose} className="p-1">
          <Ionicons name="close-circle" size={24} color={mutedColor} />
        </TouchableOpacity>
      </View>

      <Separator className="mx-4" />

      {/* File count */}
      <View className="px-4 py-2">
        <Text className="text-xs text-muted">
          {cluster.files.length} {t("sessions.imageCount")}
        </Text>
      </View>

      {/* Thumbnail grid */}
      <ScrollView className="px-4 pb-4" showsVerticalScrollIndicator={false}>
        <ThumbnailGrid
          files={cluster.files}
          columns={3}
          selectionMode={false}
          selectedIds={[]}
          onPress={onFilePress}
          onLongPress={() => {}}
          onSelect={() => {}}
        />
      </ScrollView>
    </View>
  );
}
