import { View, Text } from "react-native";
import { PressableFeedback, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";

export interface SettingsRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description?: string;
  value?: string;
  onPress?: () => void;
  iconColor?: string;
  rightElement?: React.ReactNode;
  disabled?: boolean;
  testID?: string;
}

export function SettingsRow({
  icon,
  label,
  description,
  value,
  onPress,
  iconColor,
  rightElement,
  disabled,
  testID,
}: SettingsRowProps) {
  const mutedColor = useThemeColor("muted");

  return (
    <PressableFeedback
      testID={testID}
      onPress={onPress}
      isDisabled={!onPress || disabled}
      accessibilityRole={onPress ? "button" : "text"}
      accessibilityLabel={value ? `${label}: ${value}` : label}
      style={disabled ? { opacity: 0.5 } : undefined}
    >
      <PressableFeedback.Highlight />
      <View className="flex-row items-center justify-between py-3">
        <View className="flex-1 flex-row items-center gap-3">
          <Ionicons name={icon} size={18} color={iconColor ?? mutedColor} />
          <View className="flex-1">
            <Text className="text-sm text-foreground">{label}</Text>
            {description ? (
              <Text className="mt-0.5 text-[11px] text-muted" numberOfLines={2}>
                {description}
              </Text>
            ) : null}
          </View>
        </View>
        <View className="flex-row items-center gap-1">
          {rightElement}
          {!rightElement && value != null && <Text className="text-xs text-muted">{value}</Text>}
          {!rightElement && onPress && (
            <Ionicons name="chevron-forward" size={14} color={mutedColor} />
          )}
        </View>
      </View>
    </PressableFeedback>
  );
}
