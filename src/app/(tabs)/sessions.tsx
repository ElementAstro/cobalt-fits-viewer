import { View, Text, FlatList, ScrollView, Alert } from "react-native";
import { useState, useMemo, useCallback } from "react";
import { Button, Card, Chip, Input, Separator, TextField, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useI18n } from "../../i18n/useI18n";
import { useScreenOrientation } from "../../hooks/useScreenOrientation";
import { useSessions } from "../../hooks/useSessions";
import { formatDuration } from "../../lib/sessions/format";
import { useCalendar } from "../../hooks/useCalendar";
import { useFitsStore } from "../../stores/useFitsStore";
import { useSessionStore } from "../../stores/useSessionStore";
import { SessionCard } from "../../components/sessions/SessionCard";
import { ObservationCalendar } from "../../components/sessions/ObservationCalendar";
import { PlanObservationSheet } from "../../components/sessions/PlanObservationSheet";
import { PlanCard } from "../../components/sessions/PlanCard";
import { ActiveSessionBanner } from "../../components/sessions/ActiveSessionBanner";
import { CreateSessionSheet } from "../../components/sessions/CreateSessionSheet";
import { SessionStatsCard } from "../../components/sessions/SessionStatsCard";
import { MonthlyActivityChart } from "../../components/sessions/MonthlyActivityChart";
import { EmptyState } from "../../components/common/EmptyState";

export default function SessionsScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");
  const { isLandscape } = useScreenOrientation();

  const { sessions, autoDetectSessions, getObservationDates, getSessionStats, getMonthlyData } =
    useSessions();

  const { syncSession, syncAllSessions, openInCalendar, deleteObservationPlan, plans, syncing } =
    useCalendar();
  const getPlannedDates = useSessionStore((s) => s.getPlannedDates);

  const removeSession = useSessionStore((s) => s.removeSession);
  const removeMultipleSessions = useSessionStore((s) => s.removeMultipleSessions);
  const files = useFitsStore((s) => s.files);

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [searchQuery, setSearchQuery] = useState("");
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [showPlanSheet, setShowPlanSheet] = useState(false);
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [showDetailedStats, setShowDetailedStats] = useState(false);
  const [planDate, setPlanDate] = useState<Date | undefined>(undefined);
  const [editingPlan, setEditingPlan] = useState<
    import("../../lib/fits/types").ObservationPlan | undefined
  >(undefined);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"date" | "duration" | "images">("date");

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const handleBatchDelete = useCallback(() => {
    if (selectedIds.size === 0) return;
    Alert.alert(t("common.delete"), `${t("sessions.deleteSessionConfirm")} (${selectedIds.size})`, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: () => {
          removeMultipleSessions([...selectedIds]);
          exitSelectionMode();
        },
      },
    ]);
  }, [selectedIds, t, removeMultipleSessions, exitSelectionMode]);
  const observationDates = getObservationDates(calYear, calMonth);
  const plannedDates = getPlannedDates(calYear, calMonth);

  const sessionCountByDate = useMemo(() => {
    const map = new Map<number, number>();
    for (const s of sessions) {
      const d = new Date(s.startTime);
      if (d.getFullYear() === calYear && d.getMonth() === calMonth) {
        map.set(d.getDate(), (map.get(d.getDate()) ?? 0) + 1);
      }
    }
    return map;
  }, [sessions, calYear, calMonth]);

  const stats = useMemo(() => getSessionStats(), [getSessionStats]);
  const monthlyData = useMemo(() => getMonthlyData(6), [getMonthlyData]);

  const totalDuration = sessions.reduce((sum, s) => sum + s.duration, 0);
  const totalImages = sessions.reduce((sum, s) => sum + s.imageIds.length, 0);

  const filteredSessions = useMemo(() => {
    let result = sessions;

    if (selectedDate) {
      result = result.filter((s) => s.date === selectedDate);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (s) =>
          s.date.includes(q) ||
          s.targets.some((tgt) => tgt.toLowerCase().includes(q)) ||
          s.equipment.telescope?.toLowerCase().includes(q) ||
          s.location?.placeName?.toLowerCase().includes(q) ||
          s.location?.city?.toLowerCase().includes(q) ||
          s.notes?.toLowerCase().includes(q),
      );
    }

    return result;
  }, [sessions, searchQuery, selectedDate]);

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

  const handleDatePress = useCallback(
    (day: number) => {
      const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      setSelectedDate((prev) => (prev === dateStr ? null : dateStr));
    },
    [calYear, calMonth],
  );

  const handleDateLongPress = useCallback(
    (day: number) => {
      const date = new Date(calYear, calMonth, day);
      setPlanDate(date);
      setShowPlanSheet(true);
    },
    [calYear, calMonth],
  );

  const sortedSessions = useMemo(() => {
    const sorted = [...filteredSessions];
    switch (sortBy) {
      case "duration":
        return sorted.sort((a, b) => b.duration - a.duration);
      case "images":
        return sorted.sort((a, b) => b.imageIds.length - a.imageIds.length);
      case "date":
      default:
        return sorted.sort((a, b) => b.startTime - a.startTime);
    }
  }, [filteredSessions, sortBy]);

  const renderSessionItem = useCallback(
    ({ item: session }: { item: import("../../lib/fits/types").ObservationSession }) => (
      <View
        className={`px-4 mb-3 ${isSelectionMode && selectedIds.has(session.id) ? "opacity-70" : ""}`}
      >
        {isSelectionMode && (
          <View className="absolute left-5 top-2 z-10">
            <Ionicons
              name={selectedIds.has(session.id) ? "checkbox" : "square-outline"}
              size={20}
              color={selectedIds.has(session.id) ? "#3b82f6" : mutedColor}
            />
          </View>
        )}
        <SessionCard
          session={session}
          onPress={() => {
            if (isSelectionMode) {
              toggleSelect(session.id);
            } else {
              router.push(`/session/${session.id}`);
            }
          }}
          onSyncToCalendar={isSelectionMode ? undefined : syncSession}
          onOpenInCalendar={isSelectionMode ? undefined : openInCalendar}
          onDelete={isSelectionMode ? undefined : handleDeleteSession}
        />
      </View>
    ),
    [
      router,
      syncSession,
      openInCalendar,
      handleDeleteSession,
      isSelectionMode,
      selectedIds,
      toggleSelect,
      mutedColor,
    ],
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
            <Button size="sm" variant="outline" onPress={() => setShowCreateSheet(true)}>
              <Ionicons name="add-outline" size={14} color={mutedColor} />
            </Button>
            <Button size="sm" variant="outline" onPress={() => setShowPlanSheet(true)}>
              <Ionicons name="calendar-outline" size={14} color={mutedColor} />
            </Button>
            {sessions.length > 1 && (
              <Button size="sm" variant="outline" onPress={() => setIsSelectionMode(true)}>
                <Ionicons name="checkbox-outline" size={14} color={mutedColor} />
              </Button>
            )}
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

        <Separator className="my-3" />

        {/* Live Session */}
        <ActiveSessionBanner />

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

        {sessions.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            onPress={() => setShowDetailedStats(!showDetailedStats)}
            className="mt-2"
          >
            <Ionicons
              name={showDetailedStats ? "chevron-up" : "stats-chart-outline"}
              size={14}
              color={mutedColor}
            />
            <Button.Label className="text-[10px] text-muted">
              {showDetailedStats ? t("common.collapse") : t("sessions.stats")}
            </Button.Label>
          </Button>
        )}

        {/* Detailed Statistics */}
        <SessionStatsCard stats={stats} visible={showDetailedStats} />
        <MonthlyActivityChart data={monthlyData} visible={showDetailedStats} />

        <Separator className="my-4" />

        {/* Calendar */}
        <Text className="mb-3 text-base font-semibold text-foreground">
          {t("sessions.calendar")}
        </Text>
        <ObservationCalendar
          datesWithData={observationDates}
          plannedDates={plannedDates}
          sessionCountByDate={sessionCountByDate}
          year={calYear}
          month={calMonth}
          selectedDate={selectedDate}
          onMonthChange={(y, m) => {
            setCalYear(y);
            setCalMonth(m);
          }}
          onDatePress={handleDatePress}
          onDateLongPress={handleDateLongPress}
        />

        {/* Plans */}
        {plans.length > 0 && (
          <>
            <Separator className="my-4" />
            <Text className="mb-3 text-base font-semibold text-foreground">
              {t("sessions.planObservation")} ({plans.length})
            </Text>
            <View className="gap-2 mb-2">
              {plans
                .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
                .map((plan) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    onOpenInCalendar={openInCalendar}
                    onEdit={(p) => {
                      setEditingPlan(p);
                      setShowPlanSheet(true);
                    }}
                    onDelete={(p) => {
                      Alert.alert(t("common.delete"), t("sessions.deleteSessionConfirm"), [
                        { text: t("common.cancel"), style: "cancel" },
                        {
                          text: t("common.delete"),
                          style: "destructive",
                          onPress: () => deleteObservationPlan(p.id),
                        },
                      ]);
                    }}
                  />
                ))}
            </View>
          </>
        )}

        <Separator className="my-4" />

        {/* Session List */}
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-base font-semibold text-foreground">
            {t("sessions.sessionList")}
          </Text>
          {selectedDate && (
            <Button size="sm" variant="outline" onPress={() => setSelectedDate(null)}>
              <Ionicons name="close-circle-outline" size={12} color={mutedColor} />
              <Button.Label className="text-[10px]">{selectedDate}</Button.Label>
            </Button>
          )}
        </View>

        {/* Sort */}
        {sessions.length > 1 && (
          <View className="flex-row gap-2 mb-3">
            {(["date", "duration", "images"] as const).map((key) => (
              <Chip
                key={key}
                size="sm"
                variant={sortBy === key ? "primary" : "secondary"}
                onPress={() => setSortBy(key)}
              >
                <Chip.Label className="text-[9px]">
                  {key === "date"
                    ? t("sessions.calendar")
                    : key === "duration"
                      ? t("sessions.duration")
                      : t("sessions.imageCount")}
                </Chip.Label>
              </Chip>
            ))}
          </View>
        )}

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
      sessionCountByDate,
      plans,
      calYear,
      calMonth,
      searchQuery,
      selectedDate,
      sortBy,
      filteredSessions,
      files,
      stats,
      monthlyData,
      showDetailedStats,
      autoDetectSessions,
      handleSyncAll,
      handleDatePress,
      handleDateLongPress,
      deleteObservationPlan,
      openInCalendar,
    ],
  );

  const selectionBar = isSelectionMode ? (
    <View className="flex-row items-center justify-between bg-surface-secondary px-4 py-2">
      <View className="flex-row items-center gap-2">
        <Button size="sm" variant="ghost" onPress={exitSelectionMode}>
          <Ionicons name="close" size={16} color={mutedColor} />
        </Button>
        <Text className="text-sm font-medium text-foreground">
          {selectedIds.size} {t("common.selected")}
        </Text>
      </View>
      <View className="flex-row items-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          onPress={() => {
            if (selectedIds.size === sortedSessions.length) {
              setSelectedIds(new Set());
            } else {
              setSelectedIds(new Set(sortedSessions.map((s) => s.id)));
            }
          }}
        >
          <Ionicons name="checkmark-done" size={16} color={mutedColor} />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          isDisabled={selectedIds.size === 0}
          onPress={handleBatchDelete}
        >
          <Ionicons name="trash-outline" size={16} color="#ef4444" />
        </Button>
      </View>
    </View>
  ) : null;

  return (
    <View className={`flex-1 bg-background ${isLandscape ? "pt-2" : "pt-14"}`}>
      {selectionBar}
      {isLandscape ? (
        <View className="flex-1 flex-row">
          {/* Left: Calendar + Stats */}
          <ScrollView
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: 16 }}
          >
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-xl font-bold text-foreground">{t("sessions.title")}</Text>
              <View className="flex-row gap-1">
                <Button size="sm" variant="outline" onPress={() => setShowCreateSheet(true)}>
                  <Ionicons name="add-outline" size={14} color={mutedColor} />
                </Button>
                <Button size="sm" variant="outline" onPress={() => setShowPlanSheet(true)}>
                  <Ionicons name="calendar-outline" size={14} color={mutedColor} />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onPress={() => {
                    autoDetectSessions();
                  }}
                >
                  <Ionicons name="scan-outline" size={14} color={mutedColor} />
                </Button>
              </View>
            </View>
            <ActiveSessionBanner />
            <View className="flex-row gap-2 mb-3">
              <Card variant="secondary" className="flex-1">
                <Card.Body className="items-center p-2">
                  <Text className="text-lg font-bold text-foreground">{sessions.length}</Text>
                  <Text className="text-[9px] text-muted">{t("sessions.session")}</Text>
                </Card.Body>
              </Card>
              <Card variant="secondary" className="flex-1">
                <Card.Body className="items-center p-2">
                  <Text className="text-lg font-bold text-foreground">
                    {formatDuration(totalDuration)}
                  </Text>
                  <Text className="text-[9px] text-muted">{t("sessions.totalTime")}</Text>
                </Card.Body>
              </Card>
              <Card variant="secondary" className="flex-1">
                <Card.Body className="items-center p-2">
                  <Text className="text-lg font-bold text-foreground">{totalImages}</Text>
                  <Text className="text-[9px] text-muted">{t("sessions.imageCount")}</Text>
                </Card.Body>
              </Card>
            </View>
            <ObservationCalendar
              datesWithData={observationDates}
              plannedDates={plannedDates}
              sessionCountByDate={sessionCountByDate}
              year={calYear}
              month={calMonth}
              selectedDate={selectedDate}
              onMonthChange={(y, m) => {
                setCalYear(y);
                setCalMonth(m);
              }}
              onDatePress={handleDatePress}
              onDateLongPress={handleDateLongPress}
            />
          </ScrollView>
          {/* Right: Session List */}
          <FlatList
            className="flex-1"
            data={sortedSessions}
            keyExtractor={(item) => item.id}
            renderItem={renderSessionItem}
            contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 16 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <EmptyState icon="calendar-outline" title={t("sessions.noSessions")} />
            }
          />
        </View>
      ) : (
        <FlatList
          data={sortedSessions}
          keyExtractor={(item) => item.id}
          renderItem={renderSessionItem}
          ListHeaderComponent={ListHeader}
          contentContainerClassName="pb-4"
        />
      )}
      <PlanObservationSheet
        visible={showPlanSheet}
        onClose={() => {
          setShowPlanSheet(false);
          setEditingPlan(undefined);
        }}
        initialDate={planDate}
        existingPlan={editingPlan}
      />
      <CreateSessionSheet visible={showCreateSheet} onClose={() => setShowCreateSheet(false)} />
    </View>
  );
}
