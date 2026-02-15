import { memo } from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";

interface AstrometryBadgeProps {
  status: string;
  progress: number;
}

export const AstrometryBadge = memo(function AstrometryBadge({
  status,
  progress,
}: AstrometryBadgeProps) {
  const { t } = useI18n();

  return (
    <View className="absolute top-2 right-2 bg-accent/80 rounded-md px-2 py-1 flex-row items-center gap-1">
      <Ionicons name="hourglass-outline" size={10} color="#fff" />
      <Text className="text-[9px] text-white font-medium">
        {t(`astrometry.${status}`)} {progress}%
      </Text>
    </View>
  );
});
