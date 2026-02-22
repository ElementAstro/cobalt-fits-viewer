import { View, Text } from "react-native";
import { Chip } from "heroui-native";
import { useI18n } from "../../i18n/useI18n";
import type { SerLayout } from "../../lib/fits/types";

const SER_LAYOUT_PRESETS: SerLayout[] = ["cube", "multi-hdu"];
const SER_LAYOUT_LABEL_KEYS: Record<SerLayout, string> = {
  cube: "converter.serLayoutCube",
  "multi-hdu": "converter.serLayoutMultiHdu",
};

interface SerExportOptionsProps {
  serLayout: SerLayout;
  onSerLayoutChange: (layout: SerLayout) => void;
}

export function SerExportOptions({ serLayout, onSerLayoutChange }: SerExportOptionsProps) {
  const { t } = useI18n();

  return (
    <View className="mb-4 gap-3">
      <Text className="text-xs font-semibold text-muted mb-2">{t("converter.serLayout")}</Text>
      <View className="flex-row gap-2">
        {SER_LAYOUT_PRESETS.map((layout) => (
          <Chip
            key={layout}
            size="sm"
            variant={serLayout === layout ? "primary" : "secondary"}
            onPress={() => onSerLayoutChange(layout)}
          >
            <Chip.Label className="text-[9px] uppercase">
              {t(SER_LAYOUT_LABEL_KEYS[layout])}
            </Chip.Label>
          </Chip>
        ))}
      </View>
    </View>
  );
}
