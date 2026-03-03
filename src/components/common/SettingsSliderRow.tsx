import { useCallback, useEffect, useRef, useState } from "react";
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
  debounceMs?: number;
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
  debounceMs = 120,
  testID,
}: SettingsSliderRowProps) {
  const [displayValueState, setDisplayValueState] = useState(value);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestValueRef = useRef(value);

  useEffect(() => {
    setDisplayValueState(value);
    latestValueRef.current = value;
  }, [value]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, []);

  const commitDebounced = useCallback(
    (nextValue: number) => {
      latestValueRef.current = nextValue;

      if (debounceMs <= 0) {
        onValueChange(nextValue);
        return;
      }

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        onValueChange(latestValueRef.current);
      }, debounceMs);
    },
    [debounceMs, onValueChange],
  );

  const handleSliderChange = useCallback(
    (nextValue: number) => {
      setDisplayValueState(nextValue);
      commitDebounced(nextValue);
    },
    [commitDebounced],
  );

  const handleSlidingComplete = useCallback(
    (nextValue: number) => {
      setDisplayValueState(nextValue);
      latestValueRef.current = nextValue;

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }

      if (debounceMs > 0) {
        onValueChange(nextValue);
      }
    },
    [debounceMs, onValueChange],
  );

  const displayValue = format
    ? format(displayValueState)
    : step >= 1
      ? displayValueState.toFixed(0)
      : step >= 0.1
        ? displayValueState.toFixed(1)
        : displayValueState.toFixed(2);

  return (
    <>
      <SettingsRow testID={testID} icon={icon} label={label} value={displayValue} />
      <View className="px-2 pb-2">
        <SimpleSlider
          label=""
          value={displayValueState}
          min={min}
          max={max}
          step={step}
          defaultValue={defaultValue}
          onValueChange={handleSliderChange}
          onSlidingComplete={handleSlidingComplete}
        />
      </View>
    </>
  );
}
