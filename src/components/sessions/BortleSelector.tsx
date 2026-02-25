import { memo } from "react";
import { View } from "react-native";
import { Chip, Label } from "heroui-native";
import { useI18n } from "../../i18n/useI18n";
import { BORTLE_OPTIONS } from "../../lib/sessions/constants";

interface BortleSelectorProps {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}

export const BortleSelector = memo(function BortleSelector({
  value,
  onChange,
}: BortleSelectorProps) {
  const { t } = useI18n();

  return (
    <View className="mb-3">
      <Label className="mb-1">{t("sessions.bortle")}</Label>
      <View className="flex-row flex-wrap gap-1">
        {BORTLE_OPTIONS.map((b) => (
          <Chip
            key={b}
            size="sm"
            variant={value === b ? "primary" : "secondary"}
            onPress={() => onChange(value === b ? undefined : b)}
          >
            <Chip.Label className="text-[9px]">{b}</Chip.Label>
          </Chip>
        ))}
      </View>
    </View>
  );
});
