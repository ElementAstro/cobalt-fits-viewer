import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { Button, Chip, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
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
  const mutedColor = useThemeColor("muted");
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
          <TouchableOpacity key={f} onPress={() => handleAddFilter(f)}>
            <Chip size="sm" variant="secondary">
              <Chip.Label className="text-[9px]">+ {f}</Chip.Label>
            </Chip>
          </TouchableOpacity>
        ))}
      </View>

      {/* Custom filter input */}
      <View className="flex-row gap-2 mb-3">
        <TextInput
          className="flex-1 rounded-xl border border-separator bg-background px-3 py-2 text-sm text-foreground"
          placeholder={t("targets.filterName")}
          placeholderTextColor={mutedColor}
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
          <Ionicons name="add" size={14} color={mutedColor} />
        </Button>
      </View>

      {/* Entry rows */}
      {entries.map((entry, index) => (
        <View key={entry.filter} className="flex-row items-center gap-2 mb-2">
          <View className="w-16 items-center">
            <Text className="text-xs font-semibold text-foreground">{entry.filter}</Text>
          </View>
          <TextInput
            className="flex-1 rounded-lg border border-separator bg-background px-3 py-2 text-sm text-foreground text-center"
            placeholder={t("targets.exposureSeconds")}
            placeholderTextColor={mutedColor}
            value={entry.seconds > 0 ? String(entry.seconds) : ""}
            onChangeText={(v) => handleSecondsChange(index, v)}
            keyboardType="numeric"
            autoCorrect={false}
          />
          <Text className="text-[10px] text-muted w-4">s</Text>
          <TouchableOpacity onPress={() => handleRemoveFilter(index)}>
            <Ionicons name="close-circle" size={18} color="#ef4444" />
          </TouchableOpacity>
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
