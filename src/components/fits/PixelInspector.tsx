import { View, Text } from "react-native";
import { useI18n } from "../../i18n/useI18n";

interface PixelInspectorProps {
  x: number;
  y: number;
  value: number | null;
  ra?: string;
  dec?: string;
  visible?: boolean;
}

export function PixelInspector({ x, y, value, ra, dec, visible = true }: PixelInspectorProps) {
  const { t } = useI18n();
  if (!visible || value === null) return null;

  return (
    <View className="absolute bottom-16 left-3 rounded-lg bg-black/80 px-3 py-2">
      <Text className="text-[10px] font-semibold text-white">{t("viewer.pixelInfo")}</Text>
      <Text className="text-[9px] text-neutral-300">
        X: {x} Y: {y}
      </Text>
      <Text className="text-[9px] text-neutral-300">
        {t("viewer.value")}: {value.toFixed(2)}
      </Text>
      {ra && dec && (
        <Text className="text-[9px] text-neutral-400">
          RA: {ra} Dec: {dec}
        </Text>
      )}
    </View>
  );
}
