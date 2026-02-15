/**
 * 地图标记点详情底部弹窗 - 展示某位置的文件列表
 */

import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheet, Separator, useThemeColor } from "heroui-native";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
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
  const [successColor] = useThemeColor(["success"]);

  const loc = cluster?.location;
  const subtitle = loc ? [loc.city, loc.region, loc.country].filter(Boolean).join(", ") : "";

  return (
    <BottomSheet
      isOpen={!!cluster}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content>
          {cluster && loc ? (
            <>
              {/* Header */}
              <View className="flex-row items-center gap-2 px-4 pt-1 pb-1">
                <Ionicons name="location" size={16} color={successColor} />
                <View className="flex-1">
                  <Text className="text-base font-bold text-foreground" numberOfLines={1}>
                    {loc.placeName ?? loc.city ?? cluster.id}
                  </Text>
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
              </View>

              <Separator className="mx-4 my-1" />

              {/* File count */}
              <View className="px-4 py-1">
                <Text className="text-xs text-muted">
                  {cluster.files.length} {t("sessions.imageCount")}
                </Text>
              </View>

              {/* Thumbnail grid */}
              <BottomSheetScrollView style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
                <ThumbnailGrid
                  files={cluster.files}
                  columns={3}
                  selectionMode={false}
                  selectedIds={[]}
                  onPress={onFilePress}
                  onLongPress={() => {}}
                  onSelect={() => {}}
                />
              </BottomSheetScrollView>
            </>
          ) : null}
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
