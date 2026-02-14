import { View, Text } from "react-native";
import { Surface, useThemeColor } from "heroui-native";
import { useI18n } from "../../i18n/useI18n";
import { formatExposureTime } from "../../lib/targets/exposureStats";

interface FilterProgress {
  filter: string;
  planned: number;
  acquired: number;
  percent: number;
}

interface ExposureProgressProps {
  filters: FilterProgress[];
  overallPercent: number;
}

const FILTER_COLORS: Record<string, string> = {
  L: "#e5e7eb",
  R: "#ef4444",
  G: "#22c55e",
  B: "#3b82f6",
  Ha: "#dc2626",
  SII: "#f59e0b",
  OIII: "#06b6d4",
  Unknown: "#6b7280",
};

export function ExposureProgress({ filters, overallPercent }: ExposureProgressProps) {
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");

  return (
    <Surface variant="secondary" className="rounded-lg p-3">
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-xs font-semibold text-foreground">
          {t("targets.exposureProgress")}
        </Text>
        <Text className="text-xs font-bold text-success">{overallPercent}%</Text>
      </View>

      {/* Overall progress bar */}
      <View className="h-2 rounded-full bg-black/20 overflow-hidden mb-3">
        <View className="h-full rounded-full bg-success" style={{ width: `${overallPercent}%` }} />
      </View>

      {/* Per-filter breakdown */}
      {filters.map((f) => (
        <View key={f.filter} className="mb-2">
          <View className="flex-row items-center justify-between mb-0.5">
            <View className="flex-row items-center gap-1.5">
              <View
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: FILTER_COLORS[f.filter] ?? mutedColor }}
              />
              <Text className="text-[10px] font-semibold text-foreground">{f.filter}</Text>
            </View>
            <Text className="text-[9px] text-muted">
              {formatExposureTime(f.acquired)} / {formatExposureTime(f.planned)} ({f.percent}%)
            </Text>
          </View>
          <View className="h-1 rounded-full bg-black/20 overflow-hidden">
            <View
              className="h-full rounded-full"
              style={{
                width: `${f.percent}%`,
                backgroundColor: FILTER_COLORS[f.filter] ?? mutedColor,
              }}
            />
          </View>
        </View>
      ))}
    </Surface>
  );
}
