import { memo } from "react";
import { View, Text } from "react-native";
import { Card, Chip, PressableFeedback, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import type { ObservationSession } from "../../lib/fits/types";
import { useI18n } from "../../i18n/useI18n";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { useTargetStore } from "../../stores/useTargetStore";
import { formatDuration } from "../../lib/sessions/format";
import { resolveSessionTargetNames } from "../../lib/sessions/sessionLinking";

interface SessionCardProps {
  session: ObservationSession;
  onPress?: () => void;
  onLongPress?: () => void;
  isSelected?: boolean;
}

export const SessionCard = memo(function SessionCard({
  session,
  onPress,
  onLongPress,
  isSelected,
}: SessionCardProps) {
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");
  const showExposureCount = useSettingsStore((s) => s.sessionShowExposureCount);
  const showTotalExposure = useSettingsStore((s) => s.sessionShowTotalExposure);
  const showFilters = useSettingsStore((s) => s.sessionShowFilters);
  const targets = useTargetStore((s) => s.targets);
  const targetNames = resolveSessionTargetNames(session, targets);

  return (
    <PressableFeedback onPress={onPress} onLongPress={onLongPress}>
      <PressableFeedback.Highlight />
      <Card variant="secondary" className={isSelected ? "border border-primary" : ""}>
        <Card.Body className="gap-2 p-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Ionicons name="moon-outline" size={16} color={mutedColor} />
              <Text className="text-sm font-semibold text-foreground">{session.date}</Text>
              {session.calendarEventId && <Ionicons name="calendar" size={12} color={mutedColor} />}
            </View>
            <Text className="text-xs text-muted">{formatDuration(session.duration)}</Text>
          </View>

          {targetNames.length > 0 && (
            <View className="flex-row flex-wrap gap-1.5">
              {targetNames.map((target) => (
                <Chip key={target} size="sm" variant="secondary">
                  <Chip.Label className="text-[9px]">{target}</Chip.Label>
                </Chip>
              ))}
            </View>
          )}

          {showFilters && session.equipment.filters && session.equipment.filters.length > 0 && (
            <View className="flex-row flex-wrap gap-1">
              {session.equipment.filters.map((f) => (
                <Chip key={f} size="sm" variant="secondary">
                  <Chip.Label className="text-[9px]">{f}</Chip.Label>
                </Chip>
              ))}
            </View>
          )}

          <View className="flex-row items-center gap-3">
            {showExposureCount && (
              <View className="flex-row items-center gap-1">
                <Ionicons name="images-outline" size={11} color={mutedColor} />
                <Text className="text-[10px] text-muted">
                  {session.imageIds.length} {t("sessions.imageCount").toLowerCase()}
                </Text>
              </View>
            )}
            {showTotalExposure && (
              <View className="flex-row items-center gap-1">
                <Ionicons name="timer-outline" size={11} color={mutedColor} />
                <Text className="text-[10px] text-muted">{formatDuration(session.duration)}</Text>
              </View>
            )}
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
});
