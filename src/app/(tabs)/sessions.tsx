import { useCallback, useMemo, useState } from "react";
import { Alert, FlatList, ScrollView, Text, View } from "react-native";
import { Button, Card, Chip, Input, Separator, TextField, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { EmptyState } from "../../components/common/EmptyState";
import { ActiveSessionBanner } from "../../components/sessions/ActiveSessionBanner";
import { CreateSessionSheet } from "../../components/sessions/CreateSessionSheet";
import { MonthlyActivityChart } from "../../components/sessions/MonthlyActivityChart";
import { ObservationCalendar } from "../../components/sessions/ObservationCalendar";
import { PlanCard } from "../../components/sessions/PlanCard";
import { PlanObservationSheet } from "../../components/sessions/PlanObservationSheet";
import { SessionCard } from "../../components/sessions/SessionCard";
import { SessionStatsCard } from "../../components/sessions/SessionStatsCard";
import { useCalendar } from "../../hooks/useCalendar";
import { useScreenOrientation } from "../../hooks/useScreenOrientation";
import { useSessions } from "../../hooks/useSessions";
import { useI18n } from "../../i18n/useI18n";
import type { ObservationPlan, ObservationSession } from "../../lib/fits/types";
import { formatDuration } from "../../lib/sessions/format";
import {
  buildSessionFromPlan,
  filterObservationPlans,
  normalizePlanStatus,
  sortObservationPlans,
  type PlanSortBy,
  type PlanStatusFilter,
} from "../../lib/sessions/planUtils";
import { useFitsStore } from "../../stores/useFitsStore";
import { useSessionStore } from "../../stores/useSessionStore";

const PLAN_STATUS_FILTERS: PlanStatusFilter[] = ["all", "planned", "completed", "cancelled"];
const PLAN_SORT_OPTIONS: PlanSortBy[] = ["startAsc", "startDesc", "target", "status"];

export default function SessionsScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");
  const { isLandscape } = useScreenOrientation();

  const { sessions, autoDetectSessions, getObservationDates, getSessionStats, getMonthlyData } =
    useSessions();
  const {
    syncSession,
    syncAllSessions,
    syncAllObservationPlans,
    refreshSessionFromCalendar,
    refreshPlanFromCalendar,
    refreshAllFromCalendar,
    cleanupMissingCalendarLinks,
    openSessionInCalendar,
    openPlanInCalendar,
    editSessionInCalendar,
    editPlanInCalendar,
    createSessionViaSystemCalendar,
    createPlanViaSystemCalendar,
    deleteObservationPlan,
    updateObservationPlan,
    syncObservationPlan,
    plans,
    syncing,
  } = useCalendar();

  const getPlannedDates = useSessionStore((s) => s.getPlannedDates);
  const addSession = useSessionStore((s) => s.addSession);
  const removeSession = useSessionStore((s) => s.removeSession);
  const removeMultipleSessions = useSessionStore((s) => s.removeMultipleSessions);
  const files = useFitsStore((s) => s.files);

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [searchQuery, setSearchQuery] = useState("");
  const [planSearchQuery, setPlanSearchQuery] = useState("");
  const [planStatusFilter, setPlanStatusFilter] = useState<PlanStatusFilter>("all");
  const [planSortBy, setPlanSortBy] = useState<PlanSortBy>("startAsc");

  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [showPlanSheet, setShowPlanSheet] = useState(false);
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [showDetailedStats, setShowDetailedStats] = useState(false);
  const [planDate, setPlanDate] = useState<Date | undefined>(undefined);
  const [editingPlan, setEditingPlan] = useState<ObservationPlan | undefined>(undefined);
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

  const filteredPlans = useMemo(
    () =>
      filterObservationPlans(plans, {
        selectedDate,
        statusFilter: planStatusFilter,
        query: planSearchQuery,
      }),
    [plans, selectedDate, planStatusFilter, planSearchQuery],
  );

  const sortedPlans = useMemo(
    () => sortObservationPlans(filteredPlans, planSortBy),
    [filteredPlans, planSortBy],
  );

  const sessionsOnSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    return sessions
      .filter((s) => s.date === selectedDate)
      .sort((a, b) => a.startTime - b.startTime);
  }, [sessions, selectedDate]);

  const plansOnSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    return sortObservationPlans(filterObservationPlans(plans, { selectedDate }), "startAsc");
  }, [plans, selectedDate]);

  const handleDeleteSession = useCallback(
    (session: ObservationSession) => {
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

  const handleDeletePlan = useCallback(
    (plan: ObservationPlan) => {
      Alert.alert(t("common.delete"), t("sessions.planDeleteConfirm"), [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: () => deleteObservationPlan(plan.id),
        },
      ]);
    },
    [deleteObservationPlan, t],
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

  const handleSyncAllPlans = useCallback(async () => {
    const unsyncedCount = plans.filter((p) => !p.calendarEventId).length;
    if (unsyncedCount === 0) {
      Alert.alert(t("common.success"), t("sessions.noUnsyncedPlans"));
      return;
    }
    const count = await syncAllObservationPlans(plans);
    if (count > 0) {
      Alert.alert(t("common.success"), `${t("sessions.syncPlansSuccess")} (${count})`);
    }
  }, [plans, syncAllObservationPlans, t]);

  const handleCleanupCalendarLinks = useCallback(async () => {
    const result = await cleanupMissingCalendarLinks(sessions, plans);
    Alert.alert(
      t("common.success"),
      `${t("sessions.cleanupCalendarLinksDone")} (${result.sessionsCleared + result.plansCleared})`,
    );
  }, [cleanupMissingCalendarLinks, sessions, plans, t]);

  const handleRefreshFromCalendar = useCallback(async () => {
    const linkedCount =
      sessions.filter((s) => !!s.calendarEventId).length +
      plans.filter((p) => !!p.calendarEventId).length;
    if (linkedCount === 0) {
      Alert.alert(t("common.success"), t("sessions.noLinkedCalendarItems"));
      return;
    }

    const result = await refreshAllFromCalendar(sessions, plans);
    if (result.permissionDenied) {
      return;
    }
    const affected =
      result.sessionsUpdated + result.plansUpdated + result.sessionsCleared + result.plansCleared;

    if (affected === 0 && result.errors === 0) {
      Alert.alert(t("common.success"), t("sessions.noChangesFromCalendar"));
      return;
    }

    const suffix = result.errors > 0 ? `, ${t("common.error")}: ${result.errors}` : "";
    Alert.alert(
      t("common.success"),
      `${t("sessions.refreshFromCalendarDone")} (${affected}${suffix})`,
    );
  }, [plans, refreshAllFromCalendar, sessions, t]);

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

  const handleCreateSessionFromPlan = useCallback(
    async (plan: ObservationPlan) => {
      try {
        const session = buildSessionFromPlan(plan);
        addSession(session);
        await updateObservationPlan(plan.id, { status: "completed" });
        Alert.alert(t("common.success"), t("sessions.planConverted"));
      } catch {
        Alert.alert(t("common.error"), t("sessions.invalidTimeRange"));
      }
    },
    [addSession, updateObservationPlan, t],
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
    ({ item: session }: { item: ObservationSession }) => (
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
          onOpenInCalendar={isSelectionMode ? undefined : openSessionInCalendar}
          onRefreshFromCalendar={isSelectionMode ? undefined : refreshSessionFromCalendar}
          onEditInCalendar={isSelectionMode ? undefined : editSessionInCalendar}
          onCreateViaSystemCalendar={isSelectionMode ? undefined : createSessionViaSystemCalendar}
          onDelete={isSelectionMode ? undefined : handleDeleteSession}
        />
      </View>
    ),
    [
      isSelectionMode,
      selectedIds,
      mutedColor,
      toggleSelect,
      router,
      syncSession,
      openSessionInCalendar,
      refreshSessionFromCalendar,
      editSessionInCalendar,
      createSessionViaSystemCalendar,
      handleDeleteSession,
    ],
  );

  const dateSummarySection = selectedDate ? (
    <>
      <Separator className="my-4" />
      <View className="rounded-xl bg-surface-secondary p-3">
        <View className="mb-2 flex-row items-center justify-between">
          <Text className="text-sm font-semibold text-foreground">
            {t("sessions.dateSummary")} · {selectedDate}
          </Text>
          <Button size="sm" variant="ghost" onPress={() => setSelectedDate(null)}>
            <Ionicons name="close-circle-outline" size={13} color={mutedColor} />
            <Button.Label className="text-[10px]">{t("sessions.clearDateFilter")}</Button.Label>
          </Button>
        </View>
        <View className="mb-2 flex-row gap-2">
          <Card variant="secondary" className="flex-1">
            <Card.Body className="items-center p-2">
              <Text className="text-sm font-bold text-foreground">
                {sessionsOnSelectedDate.length}
              </Text>
              <Text className="text-[9px] text-muted">{t("sessions.sessionsOnDate")}</Text>
            </Card.Body>
          </Card>
          <Card variant="secondary" className="flex-1">
            <Card.Body className="items-center p-2">
              <Text className="text-sm font-bold text-foreground">
                {plansOnSelectedDate.length}
              </Text>
              <Text className="text-[9px] text-muted">{t("sessions.plansOnDate")}</Text>
            </Card.Body>
          </Card>
        </View>
        {sessionsOnSelectedDate.length === 0 && plansOnSelectedDate.length === 0 ? (
          <Text className="text-xs text-muted">{t("sessions.noDateItems")}</Text>
        ) : (
          <View className="gap-1">
            {sessionsOnSelectedDate.slice(0, 3).map((session) => (
              <Button
                key={session.id}
                size="sm"
                variant="ghost"
                onPress={() => router.push(`/session/${session.id}`)}
                className="justify-start"
              >
                <Ionicons name="moon-outline" size={12} color={mutedColor} />
                <Button.Label className="text-[10px]">
                  {new Date(session.startTime).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {" · "}
                  {session.targets.join(", ") || t("sessions.session")}
                </Button.Label>
              </Button>
            ))}
            {plansOnSelectedDate.slice(0, 3).map((plan) => (
              <Button
                key={plan.id}
                size="sm"
                variant="ghost"
                onPress={() => {
                  setEditingPlan(plan);
                  setShowPlanSheet(true);
                }}
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
                  {plan.targetName}
                </Button.Label>
              </Button>
            ))}
          </View>
        )}
      </View>
    </>
  ) : null;

  const planControlsSection = (
    <>
      <View className="mb-2">
        <TextField>
          <View className="w-full flex-row items-center">
            <Input
              className="flex-1 pl-9 pr-9"
              placeholder={t("sessions.searchSessions")}
              value={planSearchQuery}
              onChangeText={setPlanSearchQuery}
              autoCorrect={false}
            />
            <Ionicons
              name="search-outline"
              size={14}
              color={mutedColor}
              style={{ position: "absolute", left: 12 }}
            />
            {planSearchQuery.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                isIconOnly
                onPress={() => setPlanSearchQuery("")}
                style={{ position: "absolute", right: 12 }}
              >
                <Ionicons name="close-circle" size={14} color={mutedColor} />
              </Button>
            )}
          </View>
        </TextField>
      </View>
      <View className="mb-2 flex-row flex-wrap gap-2">
        {PLAN_STATUS_FILTERS.map((status) => (
          <Chip
            key={status}
            size="sm"
            variant={planStatusFilter === status ? "primary" : "secondary"}
            onPress={() => setPlanStatusFilter(status)}
          >
            <Chip.Label>
              {status === "all" ? t("sessions.allStatuses") : t(`sessions.status.${status}`)}
            </Chip.Label>
          </Chip>
        ))}
      </View>
      <View className="mb-3 flex-row flex-wrap gap-2">
        {PLAN_SORT_OPTIONS.map((option) => (
          <Chip
            key={option}
            size="sm"
            variant={planSortBy === option ? "primary" : "secondary"}
            onPress={() => setPlanSortBy(option)}
          >
            <Chip.Label className="text-[9px]">
              {option === "startAsc"
                ? t("sessions.sortStartAsc")
                : option === "startDesc"
                  ? t("sessions.sortStartDesc")
                  : option === "target"
                    ? t("sessions.sortTarget")
                    : t("sessions.sortStatus")}
            </Chip.Label>
          </Chip>
        ))}
      </View>
    </>
  );

  const plansSection = (
    <>
      <Separator className="my-4" />
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-base font-semibold text-foreground">
          {t("sessions.planObservation")} ({sortedPlans.length}/{plans.length})
        </Text>
        <View className="flex-row flex-wrap justify-end gap-2">
          <Button size="sm" variant="outline" onPress={handleSyncAllPlans} isDisabled={syncing}>
            <Ionicons name="sync-outline" size={12} color={mutedColor} />
            <Button.Label className="text-[10px]">{t("sessions.syncAllPlans")}</Button.Label>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onPress={handleRefreshFromCalendar}
            isDisabled={syncing}
          >
            <Ionicons name="refresh-outline" size={12} color={mutedColor} />
            <Button.Label className="text-[10px]">{t("sessions.refreshFromCalendar")}</Button.Label>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onPress={handleCleanupCalendarLinks}
            isDisabled={syncing}
          >
            <Ionicons name="link-outline" size={12} color={mutedColor} />
            <Button.Label className="text-[10px]">
              {t("sessions.cleanupCalendarLinks")}
            </Button.Label>
          </Button>
          <Button size="sm" variant="outline" onPress={() => setShowPlanSheet(true)}>
            <Ionicons name="add-outline" size={12} color={mutedColor} />
            <Button.Label className="text-[10px]">{t("sessions.planObservation")}</Button.Label>
          </Button>
        </View>
      </View>
      {plans.length > 0 && (
        <View className="mb-2 rounded-lg bg-surface-secondary px-3 py-2">
          <Text className="text-[10px] text-muted">
            {t("sessions.syncAllPlans")} · {plans.filter((p) => !p.calendarEventId).length}
          </Text>
        </View>
      )}
      {plans.length > 0 && planControlsSection}
      {plans.length === 0 ? (
        <EmptyState icon="calendar-outline" title={t("sessions.noPlans")} />
      ) : sortedPlans.length === 0 ? (
        <EmptyState icon="search-outline" title={t("sessions.noResults")} />
      ) : (
        <View className="mb-2 gap-2">
          {sortedPlans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              onSyncToCalendar={(p) => syncObservationPlan(p.id)}
              onOpenInCalendar={openPlanInCalendar}
              onRefreshFromCalendar={refreshPlanFromCalendar}
              onEditInCalendar={editPlanInCalendar}
              onCreateViaSystemCalendar={createPlanViaSystemCalendar}
              onCreateSession={handleCreateSessionFromPlan}
              onStatusChange={(p, status) => updateObservationPlan(p.id, { status })}
              onEdit={(p) => {
                setEditingPlan(p);
                setShowPlanSheet(true);
              }}
              onDelete={handleDeletePlan}
            />
          ))}
        </View>
      )}
    </>
  );

  const sessionToolsSection = (
    <>
      <Separator className="my-4" />
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-base font-semibold text-foreground">{t("sessions.sessionList")}</Text>
        {selectedDate && (
          <Button size="sm" variant="outline" onPress={() => setSelectedDate(null)}>
            <Ionicons name="close-circle-outline" size={12} color={mutedColor} />
            <Button.Label className="text-[10px]">{selectedDate}</Button.Label>
          </Button>
        )}
      </View>
      {sessions.length > 1 && (
        <View className="mb-3 flex-row gap-2">
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
      {sessions.length > 0 && filteredSessions.length === 0 && (
        <EmptyState icon="search-outline" title={t("sessions.noResults")} />
      )}
      {sessions.length === 0 && (
        <EmptyState
          icon="calendar-outline"
          title={t("sessions.noSessions")}
          actionLabel={files.length > 0 ? t("sessions.detectSessions") : undefined}
          onAction={files.length > 0 ? autoDetectSessions : undefined}
        />
      )}
    </>
  );

  const portraitListHeader = (
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

      <ActiveSessionBanner />

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

      <SessionStatsCard stats={stats} visible={showDetailedStats} />
      <MonthlyActivityChart data={monthlyData} visible={showDetailedStats} />

      <Separator className="my-4" />

      <Text className="mb-3 text-base font-semibold text-foreground">{t("sessions.calendar")}</Text>
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

      {dateSummarySection}
      {plansSection}
      {sessionToolsSection}
    </View>
  );

  const landscapeListHeader = (
    <View className="px-4 pt-4">
      {plansSection}
      {sessionToolsSection}
    </View>
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
          <ScrollView
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: 16 }}
          >
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-xl font-bold text-foreground">{t("sessions.title")}</Text>
              <View className="flex-row gap-1">
                <Button size="sm" variant="outline" onPress={() => setShowCreateSheet(true)}>
                  <Ionicons name="add-outline" size={14} color={mutedColor} />
                </Button>
                <Button size="sm" variant="outline" onPress={() => setShowPlanSheet(true)}>
                  <Ionicons name="calendar-outline" size={14} color={mutedColor} />
                </Button>
                <Button size="sm" variant="outline" onPress={handleSyncAll} isDisabled={syncing}>
                  <Ionicons name="sync-outline" size={14} color={mutedColor} />
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
            <View className="mb-3 flex-row gap-2">
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
            {sessions.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onPress={() => setShowDetailedStats(!showDetailedStats)}
                className="mb-2"
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
            <SessionStatsCard stats={stats} visible={showDetailedStats} />
            <MonthlyActivityChart data={monthlyData} visible={showDetailedStats} />
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
            {dateSummarySection}
          </ScrollView>
          <FlatList
            className="flex-1"
            data={sortedSessions}
            keyExtractor={(item) => item.id}
            renderItem={renderSessionItem}
            ListHeaderComponent={landscapeListHeader}
            contentContainerStyle={{ paddingBottom: 16 }}
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
          ListHeaderComponent={portraitListHeader}
          contentContainerClassName="pb-4"
        />
      )}
      <PlanObservationSheet
        visible={showPlanSheet}
        onClose={() => {
          setShowPlanSheet(false);
          setEditingPlan(undefined);
          setPlanDate(undefined);
        }}
        initialDate={planDate}
        existingPlan={editingPlan}
      />
      <CreateSessionSheet
        visible={showCreateSheet}
        onClose={() => {
          setShowCreateSheet(false);
        }}
      />
    </View>
  );
}
