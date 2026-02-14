import { View, Text } from "react-native";
import { Card, Chip, PressableFeedback, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import type { ObservationSession } from "../../lib/fits/types";
import { useI18n } from "../../i18n/useI18n";
import { formatDuration } from "../../lib/sessions/format";

interface SessionCardProps {
  session: ObservationSession;
  onPress?: () => void;
  onSyncToCalendar?: (session: ObservationSession) => void;
  onUnsyncFromCalendar?: (session: ObservationSession) => void;
  onOpenInCalendar?: (eventId: string) => void;
  onDelete?: (session: ObservationSession) => void;
}

export function SessionCard({
  session,
  onPress,
  onSyncToCalendar,
  onUnsyncFromCalendar: _onUnsyncFromCalendar,
  onOpenInCalendar,
  onDelete,
}: SessionCardProps) {
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");

  return (
    <PressableFeedback onPress={onPress}>
      <PressableFeedback.Highlight />
      <Card variant="secondary">
        <Card.Body className="gap-2 p-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Ionicons name="moon-outline" size={16} color={mutedColor} />
              <Text className="text-sm font-semibold text-foreground">{session.date}</Text>
              {session.calendarEventId && (
                <PressableFeedback
                  onPress={() => onOpenInCalendar?.(session.calendarEventId!)}
                  hitSlop={8}
                >
                  <PressableFeedback.Highlight />
                  <Ionicons name="calendar" size={13} color={mutedColor} />
                </PressableFeedback>
              )}
            </View>
            <View className="flex-row items-center gap-2">
              {!session.calendarEventId && onSyncToCalendar && (
                <PressableFeedback onPress={() => onSyncToCalendar(session)} hitSlop={8}>
                  <PressableFeedback.Highlight />
                  <Ionicons name="calendar-outline" size={15} color={mutedColor} />
                </PressableFeedback>
              )}
              {onDelete && (
                <PressableFeedback onPress={() => onDelete(session)} hitSlop={8}>
                  <PressableFeedback.Highlight />
                  <Ionicons name="trash-outline" size={14} color={mutedColor} />
                </PressableFeedback>
              )}
              <Text className="text-xs text-muted">{formatDuration(session.duration)}</Text>
            </View>
          </View>

          <View className="flex-row flex-wrap gap-1.5">
            {session.targets.map((target) => (
              <Chip key={target} size="sm" variant="secondary">
                <Chip.Label className="text-[9px]">{target}</Chip.Label>
              </Chip>
            ))}
          </View>

          <View className="flex-row items-center gap-3">
            <View className="flex-row items-center gap-1">
              <Ionicons name="images-outline" size={11} color={mutedColor} />
              <Text className="text-[10px] text-muted">
                {session.imageIds.length} {t("sessions.imageCount").toLowerCase()}
              </Text>
            </View>
            {session.equipment.telescope && (
              <View className="flex-row items-center gap-1">
                <Ionicons name="telescope-outline" size={11} color={mutedColor} />
                <Text className="text-[10px] text-muted" numberOfLines={1}>
                  {session.equipment.telescope}
                </Text>
              </View>
            )}
            {session.location && (
              <View className="flex-row items-center gap-1">
                <Ionicons name="location-outline" size={11} color={mutedColor} />
                <Text className="text-[10px] text-muted" numberOfLines={1}>
                  {session.location.placeName ??
                    session.location.city ??
                    session.location.region ??
                    `${session.location.latitude.toFixed(2)}°, ${session.location.longitude.toFixed(2)}°`}
                </Text>
              </View>
            )}
          </View>

          {session.notes && (
            <Text className="text-[10px] text-muted" numberOfLines={2}>
              {session.notes}
            </Text>
          )}
        </Card.Body>
      </Card>
    </PressableFeedback>
  );
}
