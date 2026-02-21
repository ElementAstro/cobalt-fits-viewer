import { View, Text } from "react-native";
import { Button, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondaryAction?: () => void;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondaryAction,
}: EmptyStateProps) {
  const mutedColor = useThemeColor("muted");

  return (
    <View className="items-center justify-center py-20">
      <Ionicons name={icon} size={64} color={mutedColor} />
      <Text className="mt-4 text-base font-semibold text-muted">{title}</Text>
      {description && (
        <Text className="mt-1 text-xs text-muted text-center px-8">{description}</Text>
      )}
      {actionLabel && onAction && (
        <Button variant="outline" className="mt-4" onPress={onAction}>
          <Button.Label>{actionLabel}</Button.Label>
        </Button>
      )}
      {secondaryLabel && onSecondaryAction && (
        <Button variant="ghost" size="sm" className="mt-2" onPress={onSecondaryAction}>
          <Button.Label>{secondaryLabel}</Button.Label>
        </Button>
      )}
    </View>
  );
}
