import { useState } from "react";
import { View, Text } from "react-native";
import { Button, Chip, CloseButton, Input } from "heroui-native";
import { useI18n } from "../../i18n/useI18n";

const COMMON_FILTERS = ["L", "R", "G", "B", "Ha", "SII", "OIII"];

interface FilterExposureEntry {
  filter: string;
  seconds: number;
}

interface FilterExposurePlanProps {
  entries: FilterExposureEntry[];
  onChange: (entries: FilterExposureEntry[]) => void;
}

export function FilterExposurePlan({ entries, onChange }: FilterExposurePlanProps) {
  const { t } = useI18n();
  const [customFilter, setCustomFilter] = useState("");

  const usedFilters = new Set(entries.map((e) => e.filter));

  const handleAddFilter = (filter: string) => {
    if (!filter.trim() || usedFilters.has(filter.trim())) return;
    onChange([...entries, { filter: filter.trim(), seconds: 0 }]);
    setCustomFilter("");
  };

  const handleRemoveFilter = (index: number) => {
    onChange(entries.filter((_, i) => i !== index));
  };

  const handleSecondsChange = (index: number, value: string) => {
    const num = parseInt(value, 10);
    const updated = entries.map((e, i) =>
      i === index ? { ...e, seconds: isNaN(num) ? 0 : Math.max(0, num) } : e,
    );
    onChange(updated);
  };

  return (
    <View>
      {/* Quick-add common filters */}
      <View className="flex-row flex-wrap gap-1 mb-2">
        {COMMON_FILTERS.filter((f) => !usedFilters.has(f)).map((f) => (
          <Chip key={f} size="sm" variant="secondary" onPress={() => handleAddFilter(f)}>
            <Chip.Label className="text-[9px]">+ {f}</Chip.Label>
          </Chip>
        ))}
      </View>

      {/* Custom filter input */}
      <View className="flex-row gap-2 mb-3">
        <Input
          className="flex-1"
          placeholder={t("targets.filterName")}
          value={customFilter}
          onChangeText={setCustomFilter}
          onSubmitEditing={() => handleAddFilter(customFilter)}
          autoCorrect={false}
        />
        <Button
          size="sm"
          variant="outline"
          onPress={() => handleAddFilter(customFilter)}
          isDisabled={!customFilter.trim() || usedFilters.has(customFilter.trim())}
        >
          <Button.Label>+</Button.Label>
        </Button>
      </View>

      {/* Entry rows */}
      {entries.map((entry, index) => (
        <View key={entry.filter} className="flex-row items-center gap-2 mb-2">
          <View className="w-16 items-center">
            <Text className="text-xs font-semibold text-foreground">{entry.filter}</Text>
          </View>
          <Input
            className="flex-1 text-center"
            placeholder={t("targets.exposureSeconds")}
            value={entry.seconds > 0 ? String(entry.seconds) : ""}
            onChangeText={(v) => handleSecondsChange(index, v)}
            keyboardType="numeric"
            autoCorrect={false}
          />
          <Text className="text-[10px] text-muted w-4">s</Text>
          <CloseButton size="sm" onPress={() => handleRemoveFilter(index)} />
        </View>
      ))}

      {entries.length === 0 && (
        <Text className="text-center text-[10px] text-muted py-2">
          {t("targets.plannedFilters")}
        </Text>
      )}
    </View>
  );
}
