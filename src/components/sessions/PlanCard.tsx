import { View, Text } from "react-native";
import { Card, PressableFeedback, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import type { ObservationPlan } from "../../lib/fits/types";
import { useI18n } from "../../i18n/useI18n";

interface PlanCardProps {
  plan: ObservationPlan;
  onOpenInCalendar?: (eventId: string) => void;
  onEdit?: (plan: ObservationPlan) => void;
  onDelete?: (plan: ObservationPlan) => void;
}

export function PlanCard({ plan, onOpenInCalendar, onEdit, onDelete }: PlanCardProps) {
  const { t: _t } = useI18n();
  const mutedColor = useThemeColor("muted");

  const startDate = new Date(plan.startDate);
  const endDate = new Date(plan.endDate);

  const formatDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const formatTime = (d: Date) =>
    `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

  const isPast = endDate.getTime() < Date.now();

  return (
    <Card variant="secondary" className={isPast ? "opacity-60" : ""}>
      <Card.Body className="gap-1.5 p-3">
        <View className="flex-row items-center justify-between">
          <View className="flex-1 flex-row items-center gap-2">
            <Ionicons
              name={isPast ? "checkmark-circle-outline" : "calendar-outline"}
              size={14}
              color={mutedColor}
            />
            <Text className="text-xs font-semibold text-foreground" numberOfLines={1}>
              {plan.title || plan.targetName}
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            {plan.calendarEventId && onOpenInCalendar && (
              <PressableFeedback
                onPress={() => onOpenInCalendar(plan.calendarEventId!)}
                hitSlop={8}
              >
                <PressableFeedback.Highlight />
                <Ionicons name="open-outline" size={13} color={mutedColor} />
              </PressableFeedback>
            )}
            {onEdit && (
              <PressableFeedback onPress={() => onEdit(plan)} hitSlop={8}>
                <PressableFeedback.Highlight />
                <Ionicons name="create-outline" size={13} color={mutedColor} />
              </PressableFeedback>
            )}
            {onDelete && (
              <PressableFeedback onPress={() => onDelete(plan)} hitSlop={8}>
                <PressableFeedback.Highlight />
                <Ionicons name="trash-outline" size={13} color={mutedColor} />
              </PressableFeedback>
            )}
          </View>
        </View>

        <View className="flex-row items-center gap-3">
          <View className="flex-row items-center gap-1">
            <Ionicons name="telescope-outline" size={11} color={mutedColor} />
            <Text className="text-[10px] text-muted">{plan.targetName}</Text>
          </View>
          <View className="flex-row items-center gap-1">
            <Ionicons name="time-outline" size={11} color={mutedColor} />
            <Text className="text-[10px] text-muted">
              {formatDate(startDate)} {formatTime(startDate)} - {formatTime(endDate)}
            </Text>
          </View>
        </View>

        {plan.notes && (
          <Text className="text-[10px] text-muted" numberOfLines={1}>
            {plan.notes}
          </Text>
        )}

        {plan.reminderMinutes > 0 && (
          <View className="flex-row items-center gap-1">
            <Ionicons name="notifications-outline" size={10} color={mutedColor} />
            <Text className="text-[9px] text-muted">
              {plan.reminderMinutes >= 60
                ? `${plan.reminderMinutes / 60}h`
                : `${plan.reminderMinutes} min`}
            </Text>
          </View>
        )}
      </Card.Body>
    </Card>
  );
}
