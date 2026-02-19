import { View, Text, TouchableOpacity } from "react-native";
import { useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";

export interface SettingsRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
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
  value,
  onPress,
  iconColor,
  rightElement,
  disabled,
  testID,
}: SettingsRowProps) {
  const mutedColor = useThemeColor("muted");

  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      disabled={!onPress || disabled}
      accessibilityRole={onPress ? "button" : "text"}
      accessibilityLabel={value ? `${label}: ${value}` : label}
      style={disabled ? { opacity: 0.5 } : undefined}
    >
      <View className="flex-row items-center justify-between py-3">
        <View className="flex-row items-center gap-3">
          <Ionicons name={icon} size={18} color={iconColor ?? mutedColor} />
          <Text className="text-sm text-foreground">{label}</Text>
        </View>
        <View className="flex-row items-center gap-1">
          {rightElement}
          {!rightElement && value != null && <Text className="text-xs text-muted">{value}</Text>}
          {!rightElement && onPress && (
            <Ionicons name="chevron-forward" size={14} color={mutedColor} />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}
