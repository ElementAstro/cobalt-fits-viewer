import { View, Text } from "react-native";
import { Chip, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";
import { formatExposureTime } from "../../lib/targets/exposureStats";
import type { FitsMetadata } from "../../lib/fits/types";

interface ObservationTimelineProps {
  files: FitsMetadata[];
  grouping?: "day" | "week" | "month";
}

interface DayGroup {
  date: string;
  files: FitsMetadata[];
  totalExposure: number;
  filterCounts: Record<string, number>;
}

export function ObservationTimeline({ files, grouping = "day" }: ObservationTimelineProps) {
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");

  const groups = groupByPeriod(files, grouping);

  if (groups.length === 0) return null;

  return (
    <View>
      <Text className="mb-3 text-xs font-semibold uppercase text-muted">
        {t("targets.observationHistory")}
      </Text>
      {groups.map((group, idx) => (
        <View key={group.date} className="flex-row mb-3">
          {/* Timeline line */}
          <View className="items-center mr-3 w-4">
            <View className="h-2.5 w-2.5 rounded-full bg-primary" />
            {idx < groups.length - 1 && <View className="flex-1 w-px bg-separator" />}
          </View>

          {/* Content */}
          <View className="flex-1 pb-2">
            <Text className="text-[11px] font-semibold text-foreground">{group.date}</Text>
            <View className="flex-row items-center gap-3 mt-0.5">
              <View className="flex-row items-center gap-1">
                <Ionicons name="images-outline" size={10} color={mutedColor} />
                <Text className="text-[9px] text-muted">{group.files.length}</Text>
              </View>
              <View className="flex-row items-center gap-1">
                <Ionicons name="timer-outline" size={10} color={mutedColor} />
                <Text className="text-[9px] text-muted">
                  {formatExposureTime(group.totalExposure)}
                </Text>
              </View>
            </View>
            {Object.keys(group.filterCounts).length > 0 && (
              <View className="flex-row flex-wrap gap-1 mt-1">
                {Object.entries(group.filterCounts).map(([filter, count]) => (
                  <Chip key={filter} size="sm" variant="secondary">
                    <Chip.Label className="text-[8px]">
                      {filter}×{count}
                    </Chip.Label>
                  </Chip>
                ))}
              </View>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

function getDateKey(dateObs: string | undefined, grouping: "day" | "week" | "month") {
  if (!dateObs) return "Unknown";
  const date = new Date(dateObs);
  if (Number.isNaN(date.getTime())) return "Unknown";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  if (grouping === "day") {
    return `${year}-${month}-${day}`;
  }
  if (grouping === "month") {
    return `${year}-${month}`;
  }
  const jan1 = new Date(year, 0, 1);
  const dayOfYear = Math.floor((date.getTime() - jan1.getTime()) / 86400000) + 1;
  const week = Math.ceil(dayOfYear / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

function groupByPeriod(files: FitsMetadata[], grouping: "day" | "week" | "month"): DayGroup[] {
  const map = new Map<string, FitsMetadata[]>();

  for (const file of files) {
    const date = getDateKey(file.dateObs, grouping);
    if (!map.has(date)) map.set(date, []);
    map.get(date)!.push(file);
  }

  const groups: DayGroup[] = [];
  for (const [date, dayFiles] of map) {
    let totalExposure = 0;
    const filterCounts: Record<string, number> = {};
    for (const f of dayFiles) {
      totalExposure += f.exptime ?? 0;
      const filter = f.filter ?? "Unknown";
      filterCounts[filter] = (filterCounts[filter] ?? 0) + 1;
    }
    groups.push({ date, files: dayFiles, totalExposure, filterCounts });
  }

  groups.sort((a, b) => b.date.localeCompare(a.date));
  return groups;
}
