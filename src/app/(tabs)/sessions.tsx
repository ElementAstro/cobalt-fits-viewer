import { View, Text, ScrollView, Alert } from "react-native";
import { useState } from "react";
import { Button, Card, Separator, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useI18n } from "../../i18n/useI18n";
import { useSessions } from "../../hooks/useSessions";
import { useCalendar } from "../../hooks/useCalendar";
import { useFitsStore } from "../../stores/useFitsStore";
import { useSessionStore } from "../../stores/useSessionStore";
import { SessionCard } from "../../components/sessions/SessionCard";
import { ObservationCalendar } from "../../components/sessions/ObservationCalendar";
import { PlanObservationSheet } from "../../components/sessions/PlanObservationSheet";
import { EmptyState } from "../../components/common/EmptyState";

export default function SessionsScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");

  const { sessions, autoDetectSessions, getObservationDates } = useSessions();

  const { syncSession, syncAllSessions, openInCalendar, syncing } = useCalendar();
  const getPlannedDates = useSessionStore((s) => s.getPlannedDates);

  const files = useFitsStore((s) => s.files);

  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [showPlanSheet, setShowPlanSheet] = useState(false);
  const [planDate, setPlanDate] = useState<Date | undefined>(undefined);
  const observationDates = getObservationDates(calYear, calMonth);
  const plannedDates = getPlannedDates(calYear, calMonth);

  const totalDuration = sessions.reduce((sum, s) => sum + s.duration, 0);
  const totalImages = sessions.reduce((sum, s) => sum + s.imageIds.length, 0);

  const formatDuration = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const handleSyncAll = async () => {
    const unsyncedCount = sessions.filter((s) => !s.calendarEventId).length;
    if (unsyncedCount === 0) {
      Alert.alert(t("common.success"), t("sessions.synced"));
      return;
    }
    const count = await syncAllSessions(sessions);
    if (count > 0) {
      Alert.alert(t("common.success"), `${t("sessions.syncSuccess")} (${count})`);
    }
  };

  const handleDateLongPress = (day: number) => {
    const date = new Date(calYear, calMonth, day);
    setPlanDate(date);
    setShowPlanSheet(true);
  };

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="px-4 py-14">
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-2xl font-bold text-foreground">{t("sessions.title")}</Text>
          <Text className="mt-1 text-sm text-muted">
            {t("sessions.subtitle")} ({sessions.length})
          </Text>
        </View>
        <View className="flex-row gap-2">
          <Button size="sm" variant="outline" onPress={() => setShowPlanSheet(true)}>
            <Ionicons name="calendar-outline" size={14} color={mutedColor} />
          </Button>
          {sessions.length > 0 && (
            <Button size="sm" variant="outline" onPress={handleSyncAll} isDisabled={syncing}>
              <Ionicons name="sync-outline" size={14} color={mutedColor} />
            </Button>
          )}
          <Button size="sm" variant="outline" onPress={autoDetectSessions}>
            <Ionicons name="scan-outline" size={14} color={mutedColor} />
          </Button>
        </View>
      </View>

      <Separator className="my-4" />

      {/* Stats Overview */}
      <View className="flex-row gap-2">
        <Card variant="secondary" className="flex-1">
          <Card.Body className="items-center p-3">
            <Text className="text-xl font-bold text-foreground">{sessions.length}</Text>
            <Text className="text-[10px] text-muted">{t("sessions.session")}</Text>
          </Card.Body>
        </Card>
        <Card variant="secondary" className="flex-1">
          <Card.Body className="items-center p-3">
            <Text className="text-xl font-bold text-foreground">
              {formatDuration(totalDuration)}
            </Text>
            <Text className="text-[10px] text-muted">{t("sessions.totalTime")}</Text>
          </Card.Body>
        </Card>
        <Card variant="secondary" className="flex-1">
          <Card.Body className="items-center p-3">
            <Text className="text-xl font-bold text-foreground">{totalImages}</Text>
            <Text className="text-[10px] text-muted">{t("sessions.imageCount")}</Text>
          </Card.Body>
        </Card>
      </View>

      <Separator className="my-4" />

      {/* Calendar */}
      <Text className="mb-3 text-base font-semibold text-foreground">{t("sessions.calendar")}</Text>
      <ObservationCalendar
        datesWithData={observationDates}
        plannedDates={plannedDates}
        year={calYear}
        month={calMonth}
        onMonthChange={(y, m) => {
          setCalYear(y);
          setCalMonth(m);
        }}
        onDateLongPress={handleDateLongPress}
      />

      <Separator className="my-4" />

      {/* Session List */}
      <Text className="mb-3 text-base font-semibold text-foreground">
        {t("sessions.sessionList")}
      </Text>

      {sessions.length === 0 ? (
        <EmptyState
          icon="calendar-outline"
          title={t("sessions.noSessions")}
          actionLabel={files.length > 0 ? t("sessions.detectSessions") : undefined}
          onAction={files.length > 0 ? autoDetectSessions : undefined}
        />
      ) : (
        <View className="gap-3">
          {sessions
            .sort((a, b) => b.startTime - a.startTime)
            .map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                onPress={() => router.push(`/session/${session.id}`)}
                onSyncToCalendar={syncSession}
                onOpenInCalendar={openInCalendar}
              />
            ))}
        </View>
      )}
      <PlanObservationSheet
        visible={showPlanSheet}
        onClose={() => setShowPlanSheet(false)}
        initialDate={planDate}
      />
    </ScrollView>
  );
}
