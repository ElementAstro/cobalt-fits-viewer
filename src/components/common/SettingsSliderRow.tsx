import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SettingsRow } from "./SettingsRow";
import { SimpleSlider } from "./SimpleSlider";

export interface SettingsSliderRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
  format?: (v: number) => string;
  min: number;
  max: number;
  step: number;
  defaultValue?: number;
  onValueChange: (v: number) => void;
  testID?: string;
}

export function SettingsSliderRow({
  icon,
  label,
  value,
  format,
  min,
  max,
  step,
  defaultValue,
  onValueChange,
  testID,
}: SettingsSliderRowProps) {
  const displayValue = format
    ? format(value)
    : step >= 1
      ? value.toFixed(0)
      : step >= 0.1
        ? value.toFixed(1)
        : value.toFixed(2);

  return (
    <>
      <SettingsRow testID={testID} icon={icon} label={label} value={displayValue} />
      <View className="px-2 pb-2">
        <SimpleSlider
          label=""
          value={value}
          min={min}
          max={max}
          step={step}
          defaultValue={defaultValue}
          onValueChange={onValueChange}
        />
      </View>
    </>
  );
}
