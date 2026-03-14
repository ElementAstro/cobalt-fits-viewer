import { memo, useMemo } from "react";
import { View, Text } from "react-native";
import { Button, PressableFeedback, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";

interface ObservationCalendarProps {
  datesWithData: number[];
  plannedDates?: number[];
  overdueDates?: number[];
  sessionCountByDate?: Map<number, number>;
  year: number;
  month: number;
  selectedDate?: string | null;
  onMonthChange: (year: number, month: number) => void;
  onDatePress?: (date: number) => void;
  onDateLongPress?: (date: number) => void;
  /** Compact layout for landscape mode */
  compact?: boolean;
}

const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const MONTH_KEYS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
] as const;

export const ObservationCalendar = memo(function ObservationCalendar({
  datesWithData,
  plannedDates = [],
  overdueDates = [],
  sessionCountByDate,
  year,
  month,
  selectedDate,
  onMonthChange,
  onDatePress,
  onDateLongPress,
  compact = false,
}: ObservationCalendarProps) {
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");

  const weekdayLabels = WEEKDAY_KEYS.map((k: string) => t(`sessions.weekdays.${k}`));
  const monthName = t(`sessions.months.${MONTH_KEYS[month]}`);

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const todayDate = today.getDate();

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = [];

    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    return cells;
  }, [year, month]);

  const goToPrevMonth = () => {
    if (month === 0) onMonthChange(year - 1, 11);
    else onMonthChange(year, month - 1);
  };

  const goToNextMonth = () => {
    if (month === 11) onMonthChange(year + 1, 0);
    else onMonthChange(year, month + 1);
  };

  const goToToday = () => {
    const now = new Date();
    onMonthChange(now.getFullYear(), now.getMonth());
  };

  return (
    <View className="rounded-xl bg-surface-secondary p-3">
      {/* Month Navigation */}
      <View className={`flex-row items-center justify-between ${compact ? "mb-2" : "mb-3"}`}>
        <PressableFeedback onPress={goToPrevMonth} className="rounded-full p-1">
          <PressableFeedback.Highlight />
          <Ionicons name="chevron-back" size={18} color={mutedColor} />
        </PressableFeedback>
        <View className="flex-row items-center gap-2">
          <Text className="text-sm font-semibold text-foreground">
            {monthName} {year}
          </Text>
          {!isCurrentMonth && (
            <Button size="sm" variant="ghost" isIconOnly onPress={goToToday}>
              <Ionicons name="today-outline" size={14} color={mutedColor} />
            </Button>
          )}
        </View>
        <PressableFeedback onPress={goToNextMonth} className="rounded-full p-1">
          <PressableFeedback.Highlight />
          <Ionicons name="chevron-forward" size={18} color={mutedColor} />
        </PressableFeedback>
      </View>

      {/* Weekday Headers */}
      <View className={`flex-row ${compact ? "mb-0.5" : "mb-1"}`}>
        {weekdayLabels.map((label, idx) => (
          <View key={idx} className="flex-1 items-center">
            <Text className="text-[9px] font-semibold text-muted">{label}</Text>
          </View>
        ))}
      </View>

      {/* Legend */}
      <View className={`flex-row items-center ${compact ? "gap-2 mb-1" : "gap-3 mb-2"} px-1`}>
        <View className="flex-row items-center gap-1">
          <View className="h-2 w-2 rounded-full bg-success" />
          <Text className="text-[8px] text-muted">{t("sessions.session")}</Text>
        </View>
        <View className="flex-row items-center gap-1">
          <View className="h-2 w-2 rounded-full bg-accent" />
          <Text className="text-[8px] text-muted">{t("sessions.plans")}</Text>
        </View>
        <View className="flex-row items-center gap-1">
          <View className="h-2 w-2 rounded-full bg-warning" />
          <Text className="text-[8px] text-muted">{t("sessions.planOverdue")}</Text>
        </View>
        {isCurrentMonth && (
          <View className="flex-row items-center gap-1">
            <View className="h-2 w-2 rounded-full border border-primary/50" />
            <Text className="text-[8px] text-muted">{t("sessions.today")}</Text>
          </View>
        )}
      </View>

      {/* Calendar Grid */}
      <View className="flex-row flex-wrap">
        {calendarDays.map((day, i) => {
          const hasData = day !== null && datesWithData.includes(day);
          const hasPlanned = day !== null && plannedDates.includes(day);
          const hasOverdue = day !== null && overdueDates.includes(day);
          const isToday = isCurrentMonth && day === todayDate;
          const isSelected =
            day !== null &&
            selectedDate ===
              `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const sessionCount =
            day !== null && sessionCountByDate ? (sessionCountByDate.get(day) ?? 0) : 0;
          return (
            <PressableFeedback
              key={i}
              className={`w-[14.28%] items-center ${compact ? "py-1" : "py-1.5"}`}
              isDisabled={day === null}
              onPress={() => day !== null && onDatePress?.(day)}
              onLongPress={() => day !== null && onDateLongPress?.(day)}
            >
              <PressableFeedback.Highlight />
              {day !== null ? (
                <View
                  className={`${compact ? "h-6 w-6" : "h-7 w-7"} items-center justify-center rounded-full ${
                    isSelected
                      ? "bg-primary"
                      : hasData
                        ? "bg-success/20"
                        : hasPlanned
                          ? "bg-accent/15"
                          : isToday
                            ? "border border-primary/50"
                            : ""
                  }`}
                >
                  <Text
                    className={`${compact ? "text-[10px]" : "text-xs"} ${
                      isSelected
                        ? "font-bold text-primary-foreground"
                        : hasData
                          ? "font-bold text-success"
                          : hasOverdue
                            ? "font-bold text-warning"
                            : hasPlanned
                              ? "font-medium text-accent"
                              : isToday
                                ? "font-bold text-primary"
                                : "text-foreground"
                    }`}
                  >
                    {day}
                  </Text>
                  <View className="absolute bottom-0.5 flex-row gap-0.5">
                    {hasData && <View className="h-1 w-1 rounded-full bg-success" />}
                    {hasPlanned && <View className="h-1 w-1 rounded-full bg-accent" />}
                    {hasOverdue && <View className="h-1 w-1 rounded-full bg-warning" />}
                    {sessionCount > 1 && (
                      <Text className="text-[6px] font-bold text-success">{sessionCount}</Text>
                    )}
                  </View>
                </View>
              ) : (
                <View className={compact ? "h-6 w-6" : "h-7 w-7"} />
              )}
            </PressableFeedback>
          );
        })}
      </View>
    </View>
  );
});
