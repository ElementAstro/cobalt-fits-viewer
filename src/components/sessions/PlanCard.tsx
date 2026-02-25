import { memo } from "react";
import { View, Text } from "react-native";
import { Card, Chip, PressableFeedback, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import type { ObservationPlan } from "../../lib/fits/types";
import { useI18n } from "../../i18n/useI18n";
import { formatDuration, formatTimeHHMM } from "../../lib/sessions/format";
import { normalizePlanStatus, toLocalDateKey } from "../../lib/sessions/planUtils";
import { useTargetStore } from "../../stores/useTargetStore";
import { resolveTargetName } from "../../lib/targets/targetRefs";

interface PlanCardProps {
  plan: ObservationPlan;
  onPress?: () => void;
  onLongPress?: () => void;
}

const STATUS_COLOR_CLASS: Record<"planned" | "completed" | "cancelled", string> = {
  planned: "text-primary",
  completed: "text-success",
  cancelled: "text-danger",
};

export const PlanCard = memo(function PlanCard({ plan, onPress, onLongPress }: PlanCardProps) {
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");
  const targets = useTargetStore((s) => s.targets);

  const startDate = new Date(plan.startDate);
  const endDate = new Date(plan.endDate);
  const status = normalizePlanStatus(plan.status);
  const displayTargetName = resolveTargetName(
    { targetId: plan.targetId, name: plan.targetName },
    targets,
  );

  const isPast = endDate.getTime() < Date.now();

  return (
    <PressableFeedback onPress={onPress} onLongPress={onLongPress}>
      <PressableFeedback.Highlight />
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
                {plan.title || displayTargetName}
              </Text>
              {plan.calendarEventId && <Ionicons name="calendar" size={11} color={mutedColor} />}
            </View>
            <Chip size="sm" variant="secondary">
              <Chip.Label className={`text-[9px] ${STATUS_COLOR_CLASS[status]}`}>
                {t(`sessions.status.${status}`)}
              </Chip.Label>
            </Chip>
          </View>

          <View className="flex-row items-center gap-3">
            <View className="flex-row items-center gap-1">
              <Ionicons name="telescope-outline" size={11} color={mutedColor} />
              <Text className="text-[10px] text-muted">{displayTargetName}</Text>
            </View>
            <View className="flex-row items-center gap-1">
              <Ionicons name="time-outline" size={11} color={mutedColor} />
              <Text className="text-[10px] text-muted">
                {toLocalDateKey(startDate)} {formatTimeHHMM(startDate)} - {formatTimeHHMM(endDate)}
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
                {formatDuration(plan.reminderMinutes * 60)}
              </Text>
            </View>
          )}
        </Card.Body>
      </Card>
    </PressableFeedback>
  );
});
