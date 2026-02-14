import { View, Text, FlatList, Alert } from "react-native";
import { useState, useMemo, useCallback } from "react";
import { Button, Card, Input, Separator, TextField, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useI18n } from "../../i18n/useI18n";
import { useSessions } from "../../hooks/useSessions";
import { formatDuration } from "../../lib/sessions/format";
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

  const removeSession = useSessionStore((s) => s.removeSession);
  const files = useFitsStore((s) => s.files);

  const [searchQuery, setSearchQuery] = useState("");
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [showPlanSheet, setShowPlanSheet] = useState(false);
  const [planDate, setPlanDate] = useState<Date | undefined>(undefined);
  const observationDates = getObservationDates(calYear, calMonth);
  const plannedDates = getPlannedDates(calYear, calMonth);

  const totalDuration = sessions.reduce((sum, s) => sum + s.duration, 0);
  const totalImages = sessions.reduce((sum, s) => sum + s.imageIds.length, 0);

  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const q = searchQuery.toLowerCase().trim();
    return sessions.filter(
      (s) =>
        s.date.includes(q) ||
        s.targets.some((tgt) => tgt.toLowerCase().includes(q)) ||
        s.equipment.telescope?.toLowerCase().includes(q) ||
        s.location?.placeName?.toLowerCase().includes(q) ||
        s.location?.city?.toLowerCase().includes(q) ||
        s.notes?.toLowerCase().includes(q),
    );
  }, [sessions, searchQuery]);

  const handleDeleteSession = useCallback(
    (session: import("../../lib/fits/types").ObservationSession) => {
      Alert.alert(t("sessions.deleteSession"), t("sessions.deleteSessionConfirm"), [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: () => removeSession(session.id),
        },
      ]);
    },
    [t, removeSession],
  );

  const handleSyncAll = useCallback(async () => {
    const unsyncedCount = sessions.filter((s) => !s.calendarEventId).length;
    if (unsyncedCount === 0) {
      Alert.alert(t("common.success"), t("sessions.synced"));
      return;
    }
    const count = await syncAllSessions(sessions);
    if (count > 0) {
      Alert.alert(t("common.success"), `${t("sessions.syncSuccess")} (${count})`);
    }
  }, [sessions, syncAllSessions, t]);

  const handleDateLongPress = useCallback(
    (day: number) => {
      const date = new Date(calYear, calMonth, day);
      setPlanDate(date);
      setShowPlanSheet(true);
    },
    [calYear, calMonth],
  );

  const sortedSessions = useMemo(
    () => [...filteredSessions].sort((a, b) => b.startTime - a.startTime),
    [filteredSessions],
  );

  const renderSessionItem = useCallback(
    ({ item: session }: { item: import("../../lib/fits/types").ObservationSession }) => (
      <View className="px-4 mb-3">
        <SessionCard
          session={session}
          onPress={() => router.push(`/session/${session.id}`)}
          onSyncToCalendar={syncSession}
          onOpenInCalendar={openInCalendar}
          onDelete={handleDeleteSession}
        />
      </View>
    ),
    [router, syncSession, openInCalendar, handleDeleteSession],
  );

  const ListHeader = useMemo(
    () => (
      <View className="px-4">
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
            <Button
              size="sm"
              variant="outline"
              onPress={() => {
                const result = autoDetectSessions();
                if (result.newCount > 0) {
                  Alert.alert(
                    t("common.success"),
                    `${t("sessions.detectSessions")}: ${result.newCount} ${t("sessions.session")}`,
                  );
                } else if (result.totalDetected > 0) {
                  Alert.alert(t("common.success"), t("sessions.synced"));
                } else {
                  Alert.alert(t("common.success"), t("sessions.noSessions"));
                }
              }}
            >
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
        <Text className="mb-3 text-base font-semibold text-foreground">
          {t("sessions.calendar")}
        </Text>
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

        {/* Search */}
        {sessions.length > 0 && (
          <View className="mb-3">
            <TextField>
              <View className="w-full flex-row items-center">
                <Input
                  className="flex-1 pl-9 pr-9"
                  placeholder={t("sessions.searchSessions")}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCorrect={false}
                />
                <Ionicons
                  name="search-outline"
                  size={14}
                  color={mutedColor}
                  style={{ position: "absolute", left: 12 }}
                />
                {searchQuery.length > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    isIconOnly
                    onPress={() => setSearchQuery("")}
                    style={{ position: "absolute", right: 12 }}
                  >
                    <Ionicons name="close-circle" size={14} color={mutedColor} />
                  </Button>
                )}
              </View>
            </TextField>
          </View>
        )}

        {sessions.length === 0 && (
          <EmptyState
            icon="calendar-outline"
            title={t("sessions.noSessions")}
            actionLabel={files.length > 0 ? t("sessions.detectSessions") : undefined}
            onAction={files.length > 0 ? autoDetectSessions : undefined}
          />
        )}
        {sessions.length > 0 && filteredSessions.length === 0 && (
          <EmptyState icon="search-outline" title={t("sessions.noResults")} />
        )}
      </View>
    ),
    [
      t,
      sessions,
      mutedColor,
      syncing,
      totalDuration,
      totalImages,
      observationDates,
      plannedDates,
      calYear,
      calMonth,
      searchQuery,
      filteredSessions,
      files,
      autoDetectSessions,
      handleSyncAll,
      handleDateLongPress,
    ],
  );

  return (
    <View className="flex-1 bg-background pt-14">
      <FlatList
        data={sortedSessions}
        keyExtractor={(item) => item.id}
        renderItem={renderSessionItem}
        ListHeaderComponent={ListHeader}
        contentContainerClassName="pb-4"
      />
      <PlanObservationSheet
        visible={showPlanSheet}
        onClose={() => setShowPlanSheet(false)}
        initialDate={planDate}
      />
    </View>
  );
}
