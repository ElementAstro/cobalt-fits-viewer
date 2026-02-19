/**
 * 目标统计页面
 */

import { View, Text } from "react-native";
import { Button, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useI18n } from "../../i18n/useI18n";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import { useTargetStatistics } from "../../hooks/useTargetStatistics";
import { StatisticsDashboard } from "../../components/targets/StatisticsDashboard";

export default function TargetStatsScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");
  const { contentPaddingTop, horizontalPadding } = useResponsiveLayout();

  const { statistics, monthlyStats } = useTargetStatistics();

  return (
    <View testID="e2e-screen-target__stats" className="flex-1 bg-background">
      {/* Header */}
      <View
        className="flex-row items-center gap-3 pb-4"
        style={{ paddingHorizontal: horizontalPadding, paddingTop: contentPaddingTop }}
      >
        <Button
          testID="e2e-action-target__stats-back"
          size="sm"
          variant="outline"
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={16} color={mutedColor} />
        </Button>
        <Text className="text-lg font-bold text-foreground flex-1">
          {t("targets.statistics.title")}
        </Text>
      </View>

      {/* Dashboard */}
      <StatisticsDashboard statistics={statistics} monthlyStats={monthlyStats} />
    </View>
  );
}
