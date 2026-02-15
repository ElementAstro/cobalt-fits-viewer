import { View, Text } from "react-native";
import { Card, Chip, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";
import { formatDuration } from "../../lib/sessions/format";
import type { ObservationStats } from "../../lib/fits/types";

interface SessionStatsCardProps {
  stats: ObservationStats;
  visible: boolean;
}

export function SessionStatsCard({ stats, visible }: SessionStatsCardProps) {
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");

  if (!visible || stats.totalSessions === 0) return null;

  const avgDuration =
    stats.totalSessions > 0 ? Math.round(stats.totalObservationTime / stats.totalSessions) : 0;

  return (
    <View className="gap-3">
      {/* Summary Row */}
      <View className="flex-row gap-2">
        <Card variant="secondary" className="flex-1">
          <Card.Body className="items-center p-2">
            <Text className="text-lg font-bold text-foreground">
              {formatDuration(stats.totalObservationTime)}
            </Text>
            <Text className="text-[9px] text-muted">{t("sessions.totalTime")}</Text>
          </Card.Body>
        </Card>
        <Card variant="secondary" className="flex-1">
          <Card.Body className="items-center p-2">
            <Text className="text-lg font-bold text-foreground">{formatDuration(avgDuration)}</Text>
            <Text className="text-[9px] text-muted">{t("sessions.avgDuration")}</Text>
          </Card.Body>
        </Card>
      </View>

      {/* Top Targets */}
      {stats.topTargets.length > 0 && (
        <View>
          <Text className="mb-2 text-xs font-semibold uppercase text-muted">
            {t("sessions.topTargets")}
          </Text>
          <View className="gap-1">
            {stats.topTargets.slice(0, 5).map((target, idx) => (
              <View
                key={target.name}
                className="flex-row items-center justify-between rounded-lg bg-surface-secondary px-3 py-2"
              >
                <View className="flex-row items-center gap-2">
                  <Text className="text-[10px] font-bold text-muted w-4">{idx + 1}</Text>
                  <Text className="text-xs font-medium text-foreground">{target.name}</Text>
                </View>
                <Text className="text-[10px] text-muted">
                  {target.count} frames · {formatDuration(target.exposure)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Filter Exposure Distribution */}
      {Object.keys(stats.exposureByFilter).length > 0 && (
        <View>
          <Text className="mb-2 text-xs font-semibold uppercase text-muted">
            {t("sessions.filterBreakdown")}
          </Text>
          <View className="flex-row flex-wrap gap-1.5">
            {Object.entries(stats.exposureByFilter)
              .sort(([, a], [, b]) => b - a)
              .map(([filter, exposure]) => (
                <Chip key={filter} size="sm" variant="secondary">
                  <Chip.Label className="text-[9px]">
                    {filter}: {formatDuration(exposure)}
                  </Chip.Label>
                </Chip>
              ))}
          </View>
        </View>
      )}

      {/* Equipment Usage */}
      {Object.keys(stats.byEquipment).length > 0 && (
        <View>
          <Text className="mb-2 text-xs font-semibold uppercase text-muted">
            {t("sessions.equipmentUsage")}
          </Text>
          <View className="gap-1">
            {Object.entries(stats.byEquipment)
              .sort(([, a], [, b]) => b - a)
              .map(([name, count]) => (
                <View
                  key={name}
                  className="flex-row items-center justify-between rounded-lg bg-surface-secondary px-3 py-1.5"
                >
                  <View className="flex-row items-center gap-2">
                    <Ionicons name="hardware-chip-outline" size={11} color={mutedColor} />
                    <Text className="text-[10px] text-foreground">{name}</Text>
                  </View>
                  <Text className="text-[10px] text-muted">
                    {count}× {t("sessions.session").toLowerCase()}
                  </Text>
                </View>
              ))}
          </View>
        </View>
      )}
    </View>
  );
}
