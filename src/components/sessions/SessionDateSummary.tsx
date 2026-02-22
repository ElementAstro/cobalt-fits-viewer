import { View, Text } from "react-native";
import { Button, Card, Separator, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";
import type { ObservationPlan, ObservationSession } from "../../lib/fits/types";
import { normalizePlanStatus } from "../../lib/sessions/planUtils";

interface SessionDateSummaryProps {
  selectedDate: string;
  sessionsOnDate: ObservationSession[];
  plansOnDate: ObservationPlan[];
  onClearDate: () => void;
  onSessionPress: (sessionId: string) => void;
  onPlanPress: (plan: ObservationPlan) => void;
  getSessionTargetNames: (session: ObservationSession) => string[];
  getPlanTargetName: (plan: ObservationPlan) => string;
}

export function SessionDateSummary({
  selectedDate,
  sessionsOnDate,
  plansOnDate,
  onClearDate,
  onSessionPress,
  onPlanPress,
  getSessionTargetNames,
  getPlanTargetName,
}: SessionDateSummaryProps) {
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");

  return (
    <>
      <Separator className="my-4" />
      <View className="rounded-xl bg-surface-secondary p-3">
        <View className="mb-2 flex-row items-center justify-between">
          <Text className="text-sm font-semibold text-foreground">
            {t("sessions.dateSummary")} · {selectedDate}
          </Text>
          <Button size="sm" variant="ghost" onPress={onClearDate}>
            <Ionicons name="close-circle-outline" size={13} color={mutedColor} />
            <Button.Label className="text-[10px]">{t("sessions.clearDateFilter")}</Button.Label>
          </Button>
        </View>
        <View className="mb-2 flex-row gap-2">
          <Card variant="secondary" className="flex-1">
            <Card.Body className="items-center p-2">
              <Text className="text-sm font-bold text-foreground">{sessionsOnDate.length}</Text>
              <Text className="text-[9px] text-muted">{t("sessions.sessionsOnDate")}</Text>
            </Card.Body>
          </Card>
          <Card variant="secondary" className="flex-1">
            <Card.Body className="items-center p-2">
              <Text className="text-sm font-bold text-foreground">{plansOnDate.length}</Text>
              <Text className="text-[9px] text-muted">{t("sessions.plansOnDate")}</Text>
            </Card.Body>
          </Card>
        </View>
        {sessionsOnDate.length === 0 && plansOnDate.length === 0 ? (
          <Text className="text-xs text-muted">{t("sessions.noDateItems")}</Text>
        ) : (
          <View className="gap-1">
            {sessionsOnDate.slice(0, 3).map((session) => (
              <Button
                key={session.id}
                size="sm"
                variant="ghost"
                onPress={() => onSessionPress(session.id)}
                className="justify-start"
              >
                <Ionicons name="moon-outline" size={12} color={mutedColor} />
                <Button.Label className="text-[10px]">
                  {new Date(session.startTime).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {" · "}
                  {getSessionTargetNames(session).join(", ") || t("sessions.session")}
                </Button.Label>
              </Button>
            ))}
            {plansOnDate.slice(0, 3).map((plan) => (
              <Button
                key={plan.id}
                size="sm"
                variant="ghost"
                onPress={() => onPlanPress(plan)}
                className="justify-start"
              >
                <Ionicons
                  name={
                    normalizePlanStatus(plan.status) === "completed"
                      ? "checkmark-circle-outline"
                      : normalizePlanStatus(plan.status) === "cancelled"
                        ? "close-circle-outline"
                        : "calendar-outline"
                  }
                  size={12}
                  color={mutedColor}
                />
                <Button.Label className="text-[10px]">
                  {new Date(plan.startDate).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {" · "}
                  {getPlanTargetName(plan)}
                </Button.Label>
              </Button>
            ))}
          </View>
        )}
      </View>
    </>
  );
}
