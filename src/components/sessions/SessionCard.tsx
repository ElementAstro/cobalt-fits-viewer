import { View, Text, TouchableOpacity } from "react-native";
import { Card, Chip, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import type { ObservationSession } from "../../lib/fits/types";
import { useI18n } from "../../i18n/useI18n";

interface SessionCardProps {
  session: ObservationSession;
  onPress?: () => void;
  onSyncToCalendar?: (session: ObservationSession) => void;
  onUnsyncFromCalendar?: (session: ObservationSession) => void;
  onOpenInCalendar?: (eventId: string) => void;
}

export function SessionCard({
  session,
  onPress,
  onSyncToCalendar,
  onUnsyncFromCalendar: _onUnsyncFromCalendar,
  onOpenInCalendar,
}: SessionCardProps) {
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");

  const formatDuration = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <TouchableOpacity onPress={onPress}>
      <Card variant="secondary">
        <Card.Body className="gap-2 p-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Ionicons name="moon-outline" size={16} color={mutedColor} />
              <Text className="text-sm font-semibold text-foreground">{session.date}</Text>
              {session.calendarEventId && (
                <TouchableOpacity
                  onPress={() => onOpenInCalendar?.(session.calendarEventId!)}
                  hitSlop={8}
                >
                  <Ionicons name="calendar" size={13} color={mutedColor} />
                </TouchableOpacity>
              )}
            </View>
            <View className="flex-row items-center gap-2">
              {!session.calendarEventId && onSyncToCalendar && (
                <TouchableOpacity onPress={() => onSyncToCalendar(session)} hitSlop={8}>
                  <Ionicons name="calendar-outline" size={15} color={mutedColor} />
                </TouchableOpacity>
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
    </TouchableOpacity>
  );
}
