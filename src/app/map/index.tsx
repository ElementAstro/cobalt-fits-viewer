/**
 * 地图视图页面 - 展示所有带位置信息的 FITS 文件在地图上的分布
 */

import { useState } from "react";
import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button, useThemeColor } from "heroui-native";
import { useFitsStore } from "../../stores/useFitsStore";
import { useI18n } from "../../i18n/useI18n";
import { LocationMapView } from "../../components/gallery/LocationMapView";
import { LocationMarkerSheet } from "../../components/gallery/LocationMarkerSheet";
import type { LocationCluster } from "../../components/gallery/LocationMapView";
import type { FitsMetadata } from "../../lib/fits/types";

export default function MapScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const [mutedColor, bgColor] = useThemeColor(["muted", "background"]);

  const files = useFitsStore((s) => s.files);
  const filesWithLocation = files.filter((f) => f.location);

  const [selectedCluster, setSelectedCluster] = useState<LocationCluster | null>(null);

  const handleClusterPress = (cluster: LocationCluster) => {
    setSelectedCluster(cluster);
  };

  const handleFilePress = (file: FitsMetadata) => {
    setSelectedCluster(null);
    router.push(`/viewer/${file.id}`);
  };

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View
        className="absolute top-0 left-0 right-0 z-10 flex-row items-center justify-between px-4 pt-14 pb-3"
        style={{ backgroundColor: `${bgColor}CC` }}
      >
        <Button variant="ghost" size="sm" onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color={mutedColor} />
          <Button.Label className="text-sm text-muted">{t("common.goHome")}</Button.Label>
        </Button>
        <View className="flex-row items-center gap-2">
          <Ionicons name="map" size={16} color={mutedColor} />
          <Text className="text-base font-bold text-foreground">{t("location.mapView")}</Text>
        </View>
        <Text className="text-xs text-muted">
          {filesWithLocation.length} {t("location.sites")}
        </Text>
      </View>

      {/* Map */}
      <LocationMapView files={files} onClusterPress={handleClusterPress} style={{ flex: 1 }} />

      {/* Marker Detail Sheet */}
      <LocationMarkerSheet
        cluster={selectedCluster}
        onClose={() => setSelectedCluster(null)}
        onFilePress={handleFilePress}
      />
    </View>
  );
}
