/**
 * 目标统计仪表板
 */

import { ScrollView, View, Text, useWindowDimensions } from "react-native";
import { Accordion, Card, Chip, Surface, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "../../i18n/useI18n";
import { formatExposureHours } from "../../lib/targets/targetStatistics";
import type { TargetStatistics, MonthlyStats } from "../../lib/targets/targetStatistics";
import type { TargetType } from "../../lib/fits/types";
import {
  STATUS_COLORS,
  TARGET_STATUSES,
  targetTypeI18nKey,
  targetStatusI18nKey,
} from "../../lib/targets/targetConstants";

interface StatisticsDashboardProps {
  statistics: TargetStatistics;
  monthlyStats: MonthlyStats[];
}

function MonthlyChart({ monthlyStats }: { monthlyStats: MonthlyStats[] }) {
  const maxTargets = Math.max(...monthlyStats.map((m) => m.targetsCount), 1);

  return (
    <View className="flex-row items-end gap-1 h-20">
      {monthlyStats.map((month) => {
        const height = (month.targetsCount / maxTargets) * 100;
        return (
          <View key={month.month} className="flex-1 items-center">
            <View
              className="w-full bg-primary/60 rounded-t"
              style={{ height: `${Math.max(height, 4)}%` }}
            />
            <Text className="text-[10px] text-muted mt-1">{month.month.slice(5)}</Text>
          </View>
        );
      })}
    </View>
  );
}

export function StatisticsDashboard({ statistics, monthlyStats }: StatisticsDashboardProps) {
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();

  // Calculate max height for scrollable content (80% of screen minus header space)
  const scrollMaxHeight = screenHeight * 0.65;

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      style={{ maxHeight: scrollMaxHeight }}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}
    >
      {/* 总览卡片 */}
      <View className="flex-row gap-2 mb-4">
        <Card variant="secondary" className="flex-1">
          <Card.Body className="items-center p-3">
            <Ionicons name="telescope" size={20} color={mutedColor} />
            <Text className="text-xl font-bold text-foreground mt-1">
              {statistics.totalTargets}
            </Text>
            <Text className="text-[10px] text-muted">{t("targets.statistics.totalTargets")}</Text>
          </Card.Body>
        </Card>
        <Card variant="secondary" className="flex-1">
          <Card.Body className="items-center p-3">
            <Ionicons name="images" size={20} color={mutedColor} />
            <Text className="text-xl font-bold text-foreground mt-1">{statistics.totalFrames}</Text>
            <Text className="text-[10px] text-muted">{t("targets.statistics.totalFrames")}</Text>
          </Card.Body>
        </Card>
        <Card variant="secondary" className="flex-1">
          <Card.Body className="items-center p-3">
            <Ionicons name="time" size={20} color={mutedColor} />
            <Text className="text-xl font-bold text-foreground mt-1">
              {formatExposureHours(statistics.totalExposureSeconds)}
            </Text>
            <Text className="text-[10px] text-muted">{t("targets.statistics.totalExposure")}</Text>
          </Card.Body>
        </Card>
      </View>

      {/* 状态进度 */}
      <Card variant="secondary" className="mb-4">
        <Card.Header>
          <Card.Title>{t("targets.statistics.progressOverview")}</Card.Title>
        </Card.Header>
        <Card.Body className="p-3 pt-0">
          <View className="flex-row gap-2">
            {TARGET_STATUSES.map((status) => {
              const count = statistics.byStatus[status] ?? 0;
              const percent =
                statistics.totalTargets > 0
                  ? Math.round((count / statistics.totalTargets) * 100)
                  : 0;
              return (
                <View key={status} className="flex-1 items-center">
                  <View
                    className="w-10 h-10 rounded-full items-center justify-center mb-1"
                    style={{ backgroundColor: STATUS_COLORS[status] + "20" }}
                  >
                    <Text className="text-sm font-bold" style={{ color: STATUS_COLORS[status] }}>
                      {count}
                    </Text>
                  </View>
                  <Text className="text-[9px] text-muted text-center">
                    {t(targetStatusI18nKey(status))}
                  </Text>
                  <Text className="text-[9px] text-muted">{percent}%</Text>
                </View>
              );
            })}
          </View>
        </Card.Body>
      </Card>

      <Accordion selectionMode="multiple" variant="surface" defaultValue={["leaderboard"]}>
        {/* 曝光排行榜 */}
        {statistics.exposureLeaderboard.length > 0 && (
          <Accordion.Item value="leaderboard">
            <Accordion.Trigger>
              <Text className="flex-1 text-xs font-semibold text-muted">
                {t("targets.statistics.exposureLeaderboard")}
              </Text>
              <Accordion.Indicator />
            </Accordion.Trigger>
            <Accordion.Content>
              <View className="px-2">
                {statistics.exposureLeaderboard.map((entry, index) => (
                  <Surface
                    key={entry.target.id}
                    variant={index < 3 ? "secondary" : "tertiary"}
                    className="rounded-lg p-2 mb-1"
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-2">
                        <Text
                          className={`text-sm font-bold w-5 ${index < 3 ? "text-warning" : "text-muted"}`}
                        >
                          #{index + 1}
                        </Text>
                        <Text className="text-sm text-foreground">{entry.target.name}</Text>
                      </View>
                      <View className="flex-row items-center gap-2">
                        <Text className="text-xs text-muted">{entry.frameCount}f</Text>
                        <Text className="text-xs font-semibold text-foreground">
                          {formatExposureHours(entry.totalSeconds)}
                        </Text>
                      </View>
                    </View>
                  </Surface>
                ))}
              </View>
            </Accordion.Content>
          </Accordion.Item>
        )}

        {/* 月度活动 */}
        <Accordion.Item value="monthly">
          <Accordion.Trigger>
            <Text className="flex-1 text-xs font-semibold text-muted">
              {t("targets.statistics.monthlyActivity")}
            </Text>
            <Accordion.Indicator />
          </Accordion.Trigger>
          <Accordion.Content>
            <View className="px-2">
              <MonthlyChart monthlyStats={monthlyStats} />
            </View>
          </Accordion.Content>
        </Accordion.Item>

        {/* 类型分布 */}
        <Accordion.Item value="types">
          <Accordion.Trigger>
            <Text className="flex-1 text-xs font-semibold text-muted">{t("targets.type")}</Text>
            <Accordion.Indicator />
          </Accordion.Trigger>
          <Accordion.Content>
            <View className="flex-row flex-wrap gap-1.5 px-2">
              {Object.entries(statistics.byType).map(([type, count]) => (
                <Chip key={type} size="sm" variant="secondary">
                  <Chip.Label className="text-[10px]">
                    {t(targetTypeI18nKey(type as TargetType))}: {count}
                  </Chip.Label>
                </Chip>
              ))}
            </View>
          </Accordion.Content>
        </Accordion.Item>

        {/* 标签分布 */}
        {Object.keys(statistics.tagBreakdown).length > 0 && (
          <Accordion.Item value="tags">
            <Accordion.Trigger>
              <Text className="flex-1 text-xs font-semibold text-muted">{t("targets.tags")}</Text>
              <Accordion.Indicator />
            </Accordion.Trigger>
            <Accordion.Content>
              <View className="flex-row flex-wrap gap-1.5 px-2">
                {Object.entries(statistics.tagBreakdown)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 10)
                  .map(([tag, count]) => (
                    <Chip key={tag} size="sm" variant="secondary">
                      <Chip.Label className="text-[10px]">
                        {tag}: {count}
                      </Chip.Label>
                    </Chip>
                  ))}
              </View>
            </Accordion.Content>
          </Accordion.Item>
        )}
      </Accordion>

      {/* 快速统计 */}
      <View className="flex-row gap-2 mt-4 mb-4">
        <Card variant="secondary" className="flex-1">
          <Card.Body className="items-center p-3">
            <Ionicons name="star" size={16} color="#f59e0b" />
            <Text className="text-lg font-bold text-foreground mt-1">
              {statistics.favoritesCount}
            </Text>
            <Text className="text-[10px] text-muted">{t("targets.favorites")}</Text>
          </Card.Body>
        </Card>
        <Card variant="secondary" className="flex-1">
          <Card.Body className="items-center p-3">
            <Ionicons name="pin" size={16} color={mutedColor} />
            <Text className="text-lg font-bold text-foreground mt-1">{statistics.pinnedCount}</Text>
            <Text className="text-[10px] text-muted">{t("targets.pinned")}</Text>
          </Card.Body>
        </Card>
        <Card variant="secondary" className="flex-1">
          <Card.Body className="items-center p-3">
            <Ionicons name="navigate" size={16} color={mutedColor} />
            <Text className="text-lg font-bold text-foreground mt-1">
              {statistics.withCoordinates}
            </Text>
            <Text className="text-[10px] text-muted">{t("targets.coordinates")}</Text>
          </Card.Body>
        </Card>
      </View>
    </ScrollView>
  );
}
