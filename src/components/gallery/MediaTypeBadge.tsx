import { memo } from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface MediaTypeBadgeProps {
  mediaKind: "video" | "audio";
  duration?: string;
  showDuration?: boolean;
  iconPosition?: "top-right" | "bottom-right";
}

export const MediaTypeBadge = memo(function MediaTypeBadge({
  mediaKind,
  duration,
  showDuration = true,
  iconPosition = "bottom-right",
}: MediaTypeBadgeProps) {
  const iconName = mediaKind === "video" ? "play" : "musical-note";
  const iconPositionClass =
    iconPosition === "top-right"
      ? "absolute right-1 top-1 rounded-full bg-black/60 p-1"
      : "absolute bottom-1 right-1 rounded-full bg-black/60 p-1";

  return (
    <>
      {showDuration && !!duration && (
        <View className="absolute left-1 bottom-1 rounded-md bg-black/70 px-1 py-0.5">
          <Text className="text-[8px] font-semibold text-white">{duration}</Text>
        </View>
      )}
      <View className={iconPositionClass}>
        <Ionicons name={iconName} size={10} color="#fff" />
      </View>
    </>
  );
});
