/**
 * 收藏按钮组件
 */

import { Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColor } from "heroui-native";

interface FavoriteButtonProps {
  isFavorite: boolean;
  size?: number;
  onToggleFavorite: () => void;
}

export function FavoriteButton({ isFavorite, size = 18, onToggleFavorite }: FavoriteButtonProps) {
  const warningColor = useThemeColor("warning");
  const mutedColor = useThemeColor("muted");

  return (
    <Pressable onPress={onToggleFavorite} hitSlop={8}>
      <Ionicons
        name={isFavorite ? "star" : "star-outline"}
        size={size}
        color={isFavorite ? warningColor : mutedColor}
      />
    </Pressable>
  );
}

interface PinButtonProps {
  isPinned: boolean;
  size?: number;
  onTogglePinned: () => void;
}

export function PinButton({ isPinned, size = 18, onTogglePinned }: PinButtonProps) {
  const accentColor = useThemeColor("accent");
  const mutedColor = useThemeColor("muted");

  return (
    <Pressable onPress={onTogglePinned} hitSlop={8}>
      <Ionicons
        name={isPinned ? "pin" : "pin-outline"}
        size={size}
        color={isPinned ? accentColor : mutedColor}
      />
    </Pressable>
  );
}
