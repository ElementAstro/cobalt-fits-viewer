import { View, Text } from "react-native";
import { useI18n } from "../../i18n/useI18n";

interface MonthlyActivityChartProps {
  data: Array<{ month: string; hours: number; sessions: number }>;
  visible: boolean;
}

export function MonthlyActivityChart({ data, visible }: MonthlyActivityChartProps) {
  const { t } = useI18n();
  if (!visible || data.length === 0) return null;

  const maxHours = Math.max(...data.map((d) => d.hours), 1);

  return (
    <View>
      <Text className="mb-3 text-xs font-semibold uppercase text-muted">
        {t("sessions.monthlyActivity")}
      </Text>
      <View className="rounded-xl bg-surface-secondary p-3">
        <View className="flex-row items-end gap-1" style={{ height: 100 }}>
          {data.map((item) => {
            const barHeight = Math.max((item.hours / maxHours) * 80, item.hours > 0 ? 4 : 0);
            const monthLabel = item.month.split("-")[1];
            return (
              <View key={item.month} className="flex-1 items-center">
                <Text className="text-[8px] text-muted mb-0.5">
                  {item.hours > 0 ? `${item.hours}h` : ""}
                </Text>
                <View
                  className="w-full rounded-t-sm bg-primary/60"
                  style={{ height: barHeight, minWidth: 8, maxWidth: 24 }}
                />
                <Text className="text-[8px] text-muted mt-1">{monthLabel}</Text>
              </View>
            );
          })}
        </View>

        {/* Summary line */}
        <View className="flex-row items-center justify-between mt-2 pt-2 border-t border-separator">
          <Text className="text-[10px] text-muted">
            {data.reduce((s, d) => s + d.sessions, 0)} {t("sessions.session").toLowerCase()}
          </Text>
          <Text className="text-[10px] text-muted">
            {data.reduce((s, d) => s + d.hours, 0).toFixed(1)}h{" "}
            {t("sessions.totalTime").toLowerCase()}
          </Text>
        </View>
      </View>
    </View>
  );
}
