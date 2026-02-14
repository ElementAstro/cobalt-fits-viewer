import { View, Text, TouchableOpacity } from "react-native";
import { useThemeColor } from "heroui-native";
import { useMemo } from "react";
import { Ionicons } from "@expo/vector-icons";

interface ObservationCalendarProps {
  datesWithData: number[];
  plannedDates?: number[];
  year: number;
  month: number;
  onMonthChange: (year: number, month: number) => void;
  onDatePress?: (date: number) => void;
  onDateLongPress?: (date: number) => void;
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function ObservationCalendar({
  datesWithData,
  plannedDates = [],
  year,
  month,
  onMonthChange,
  onDatePress,
  onDateLongPress,
}: ObservationCalendarProps) {
  const [_successColor, mutedColor, _accentColor] = useThemeColor(["success", "muted", "accent"]);

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

  return (
    <View className="rounded-xl bg-surface-secondary p-3">
      {/* Month Navigation */}
      <View className="flex-row items-center justify-between mb-3">
        <TouchableOpacity onPress={goToPrevMonth}>
          <Ionicons name="chevron-back" size={18} color={mutedColor} />
        </TouchableOpacity>
        <Text className="text-sm font-semibold text-foreground">
          {MONTH_NAMES[month]} {year}
        </Text>
        <TouchableOpacity onPress={goToNextMonth}>
          <Ionicons name="chevron-forward" size={18} color={mutedColor} />
        </TouchableOpacity>
      </View>

      {/* Weekday Headers */}
      <View className="flex-row mb-1">
        {WEEKDAY_LABELS.map((label) => (
          <View key={label} className="flex-1 items-center">
            <Text className="text-[9px] font-semibold text-muted">{label}</Text>
          </View>
        ))}
      </View>

      {/* Calendar Grid */}
      <View className="flex-row flex-wrap">
        {calendarDays.map((day, i) => {
          const hasData = day !== null && datesWithData.includes(day);
          const hasPlanned = day !== null && plannedDates.includes(day);
          return (
            <TouchableOpacity
              key={i}
              className="w-[14.28%] items-center py-1.5"
              disabled={day === null}
              onPress={() => day !== null && onDatePress?.(day)}
              onLongPress={() => day !== null && onDateLongPress?.(day)}
            >
              {day !== null ? (
                <View
                  className={`h-7 w-7 items-center justify-center rounded-full ${
                    hasData ? "bg-success/20" : hasPlanned ? "bg-accent/15" : ""
                  }`}
                >
                  <Text
                    className={`text-xs ${
                      hasData
                        ? "font-bold text-success"
                        : hasPlanned
                          ? "font-medium text-accent"
                          : "text-foreground"
                    }`}
                  >
                    {day}
                  </Text>
                  <View className="absolute bottom-0.5 flex-row gap-0.5">
                    {hasData && <View className="h-1 w-1 rounded-full bg-success" />}
                    {hasPlanned && <View className="h-1 w-1 rounded-full bg-accent" />}
                  </View>
                </View>
              ) : (
                <View className="h-7 w-7" />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
