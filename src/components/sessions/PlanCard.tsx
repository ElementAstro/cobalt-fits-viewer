import { View, Text } from "react-native";
import { Card, Chip, PressableFeedback, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import type { ObservationPlan } from "../../lib/fits/types";
import { useI18n } from "../../i18n/useI18n";
import { normalizePlanStatus } from "../../lib/sessions/planUtils";
import { useTargetStore } from "../../stores/useTargetStore";
import { resolveTargetName } from "../../lib/targets/targetRefs";

interface PlanCardProps {
  plan: ObservationPlan;
  onSyncToCalendar?: (plan: ObservationPlan) => void;
  onOpenInCalendar?: (plan: ObservationPlan) => void;
  onRefreshFromCalendar?: (plan: ObservationPlan) => void;
  onEditInCalendar?: (plan: ObservationPlan) => void;
  onCreateViaSystemCalendar?: (plan: ObservationPlan) => void;
  onCreateSession?: (plan: ObservationPlan) => void;
  onStatusChange?: (plan: ObservationPlan, status: "planned" | "completed" | "cancelled") => void;
  onEdit?: (plan: ObservationPlan) => void;
  onDelete?: (plan: ObservationPlan) => void;
}

const STATUS_COLOR_CLASS: Record<"planned" | "completed" | "cancelled", string> = {
  planned: "text-primary",
  completed: "text-success",
  cancelled: "text-danger",
};

export function PlanCard({
  plan,
  onSyncToCalendar,
  onOpenInCalendar,
  onRefreshFromCalendar,
  onEditInCalendar,
  onCreateViaSystemCalendar,
  onCreateSession,
  onStatusChange,
  onEdit,
  onDelete,
}: PlanCardProps) {
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
              {plan.title || displayTargetName}
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            {!plan.calendarEventId && onSyncToCalendar && (
              <PressableFeedback onPress={() => onSyncToCalendar(plan)} hitSlop={8}>
                <PressableFeedback.Highlight />
                <Ionicons name="sync-outline" size={13} color={mutedColor} />
              </PressableFeedback>
            )}
            {!plan.calendarEventId && onCreateViaSystemCalendar && (
              <PressableFeedback onPress={() => onCreateViaSystemCalendar(plan)} hitSlop={8}>
                <PressableFeedback.Highlight />
                <Ionicons name="add-circle-outline" size={13} color={mutedColor} />
              </PressableFeedback>
            )}
            {plan.calendarEventId && onOpenInCalendar && (
              <PressableFeedback onPress={() => onOpenInCalendar(plan)} hitSlop={8}>
                <PressableFeedback.Highlight />
                <Ionicons name="open-outline" size={13} color={mutedColor} />
              </PressableFeedback>
            )}
            {plan.calendarEventId && onRefreshFromCalendar && (
              <PressableFeedback onPress={() => onRefreshFromCalendar(plan)} hitSlop={8}>
                <PressableFeedback.Highlight />
                <Ionicons name="refresh-outline" size={13} color={mutedColor} />
              </PressableFeedback>
            )}
            {plan.calendarEventId && onEditInCalendar && (
              <PressableFeedback onPress={() => onEditInCalendar(plan)} hitSlop={8}>
                <PressableFeedback.Highlight />
                <Ionicons name="build-outline" size={13} color={mutedColor} />
              </PressableFeedback>
            )}
            {onCreateSession && (
              <PressableFeedback onPress={() => onCreateSession(plan)} hitSlop={8}>
                <PressableFeedback.Highlight />
                <Ionicons name="play-forward-outline" size={13} color={mutedColor} />
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

        <View className="flex-row items-center justify-between">
          <Chip size="sm" variant="secondary">
            <Chip.Label className={`text-[9px] ${STATUS_COLOR_CLASS[status]}`}>
              {t(`sessions.status.${status}`)}
            </Chip.Label>
          </Chip>
          {onStatusChange && (
            <View className="flex-row items-center gap-2">
              {status !== "planned" && (
                <PressableFeedback onPress={() => onStatusChange(plan, "planned")} hitSlop={8}>
                  <PressableFeedback.Highlight />
                  <Ionicons name="refresh-outline" size={12} color={mutedColor} />
                </PressableFeedback>
              )}
              {status !== "completed" && (
                <PressableFeedback onPress={() => onStatusChange(plan, "completed")} hitSlop={8}>
                  <PressableFeedback.Highlight />
                  <Ionicons name="checkmark-circle-outline" size={12} color={mutedColor} />
                </PressableFeedback>
              )}
              {status !== "cancelled" && (
                <PressableFeedback onPress={() => onStatusChange(plan, "cancelled")} hitSlop={8}>
                  <PressableFeedback.Highlight />
                  <Ionicons name="close-circle-outline" size={12} color={mutedColor} />
                </PressableFeedback>
              )}
            </View>
          )}
        </View>

        <View className="flex-row items-center gap-3">
          <View className="flex-row items-center gap-1">
            <Ionicons name="telescope-outline" size={11} color={mutedColor} />
            <Text className="text-[10px] text-muted">{displayTargetName}</Text>
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
