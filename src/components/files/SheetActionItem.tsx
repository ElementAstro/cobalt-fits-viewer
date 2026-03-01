import { View, Text } from "react-native";
import { PressableFeedback, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";

interface SheetActionItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress: () => void;
  disabled?: boolean;
  compact?: boolean;
  destructive?: boolean;
  showChevron?: boolean;
  successColor?: string;
  mutedColor?: string;
  dangerColor?: string;
}

export function SheetActionItem({
  icon,
  title,
  subtitle,
  onPress,
  disabled,
  compact,
  destructive,
  showChevron,
  successColor: successColorProp,
  mutedColor: mutedColorProp,
  dangerColor: dangerColorProp,
}: SheetActionItemProps) {
  const [themeSuccess, themeMuted, themeDanger] = useThemeColor(["success", "muted", "danger"]);
  const successColor = successColorProp ?? themeSuccess;
  const mutedColor = mutedColorProp ?? themeMuted;
  const dangerColor = dangerColorProp ?? themeDanger;
  const iconColor = destructive ? dangerColor : disabled ? mutedColor : successColor;

  return (
    <PressableFeedback
      onPress={onPress}
      isDisabled={disabled}
      className={`flex-row items-center gap-3 rounded-xl ${
        disabled ? "bg-surface-secondary/60" : "bg-surface-secondary"
      } ${compact ? "p-3" : "p-4"}`}
    >
      <View
        className={`items-center justify-center rounded-full ${
          destructive ? "bg-danger/10" : "bg-success/10"
        } ${compact ? "h-8 w-8" : "h-10 w-10"}`}
      >
        <Ionicons name={icon} size={compact ? 16 : 20} color={iconColor} />
      </View>
      <View className="flex-1">
        <Text
          className={`font-semibold ${disabled ? "text-muted" : "text-foreground"} ${
            compact ? "text-xs" : "text-sm"
          }`}
        >
          {title}
        </Text>
        {subtitle && <Text className="text-xs text-muted">{subtitle}</Text>}
      </View>
      {showChevron && <Ionicons name="chevron-forward" size={16} color={mutedColor} />}
    </PressableFeedback>
  );
}
