import { View } from "react-native";
import { ControlField, Description, Label, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useHapticFeedback } from "../../hooks/common/useHapticFeedback";

export interface SettingsToggleRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description?: string;
  isSelected: boolean;
  onSelectedChange: (value: boolean) => void;
  iconColor?: string;
  disabled?: boolean;
  testID?: string;
}

export function SettingsToggleRow({
  icon,
  label,
  description,
  isSelected,
  onSelectedChange,
  iconColor,
  disabled,
  testID,
}: SettingsToggleRowProps) {
  const mutedColor = useThemeColor("muted");
  const haptics = useHapticFeedback();

  return (
    <ControlField
      testID={testID}
      className="flex-row items-center py-3"
      isSelected={isSelected}
      onSelectedChange={(v: boolean) => {
        haptics.selection();
        onSelectedChange(v);
      }}
      isDisabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: isSelected }}
    >
      <View className="flex-1 flex-row items-center gap-3">
        <Ionicons name={icon} size={18} color={iconColor ?? mutedColor} />
        <View className="flex-1">
          <Label className="text-sm text-foreground">{label}</Label>
          {description ? (
            <Description className="mt-0.5 text-[11px] text-muted">{description}</Description>
          ) : null}
        </View>
      </View>
      <ControlField.Indicator />
    </ControlField>
  );
}
