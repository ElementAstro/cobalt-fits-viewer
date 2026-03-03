import { useCallback, useMemo, useState } from "react";
import { Alert, FlatList, ScrollView, Text, View } from "react-native";
import { Button, Card, Chip, Separator, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { EmptyState } from "../../components/common/EmptyState";
import {
  OperationSummaryDialog,
  type SummaryItem,
} from "../../components/common/OperationSummaryDialog";
import { GuideTarget } from "../../components/common/GuideTarget";
import { SearchBar } from "../../components/common/SearchBar";
import { ActiveSessionBanner } from "../../components/sessions/ActiveSessionBanner";
import { CreateSessionSheet } from "../../components/sessions/CreateSessionSheet";
import { MonthlyActivityChart } from "../../components/sessions/MonthlyActivityChart";
import { ObservationCalendar } from "../../components/sessions/ObservationCalendar";
import { PlanCard } from "../../components/sessions/PlanCard";
import { PlanObservationSheet } from "../../components/sessions/PlanObservationSheet";
import { SessionCard } from "../../components/sessions/SessionCard";
import { SessionStatsCard } from "../../components/sessions/SessionStatsCard";
import { SessionActionSheet } from "../../components/sessions/SessionActionSheet";
import { PlanActionSheet } from "../../components/sessions/PlanActionSheet";
import { SessionSelectionBar } from "../../components/sessions/SessionSelectionBar";
import { SessionDateSummary } from "../../components/sessions/SessionDateSummary";
import { useCalendar } from "../../hooks/useCalendar";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import { useSessions } from "../../hooks/useSessions";
import { usePageLogger } from "../../hooks/useLogger";
import { useI18n } from "../../i18n/useI18n";
import type { ObservationPlan, ObservationSession } from "../../lib/fits/types";
import { formatDuration } from "../../lib/sessions/format";
import {
  buildSessionFromPlan,
  filterObservationPlans,
  sortObservationPlans,
  type PlanSortBy,
  type PlanStatusFilter,
} from "../../lib/sessions/planUtils";
import { useFitsStore } from "../../stores/useFitsStore";
import { useSessionStore } from "../../stores/useSessionStore";
import { useTargetStore } from "../../stores/useTargetStore";
import { resolveTargetName } from "../../lib/targets/targetRefs";
import { resolveSessionTargetNames } from "../../lib/sessions/sessionLinking";

const PLAN_STATUS_FILTERS: PlanStatusFilter[] = ["all", "planned", "completed", "cancelled"];
const PLAN_SORT_OPTIONS: PlanSortBy[] = ["startAsc", "startDesc", "target", "status"];

export default function SessionsScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { logAction, logSuccess, logFailure } = usePageLogger("SessionsScreen", {
    screen: "sessions",
  });
  const mutedColor = useThemeColor("muted");
  const { isLandscape, isLandscapeTablet, contentPaddingTop, sidePanelWidth } =
    useResponsiveLayout();

  const {
    sessions,
    autoDetectSessions,
    reconcileSessionsFromLinkedFiles,
    getObservationDates,
    getSessionStats,
    getMonthlyData,
  } = useSessions();
  const {
    calendarSyncEnabled,
    syncSession,
    unsyncSession,
    syncSessionsBatch,
    syncAllSessions,
    unsyncSessionsBatch,
    refreshSessionsBatch,
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
    unsyncObservationPlan,
    plans,
    syncing,
  } = useCalendar();

  const getPlannedDates = useSessionStore((s) => s.getPlannedDates);
  const addSession = useSessionStore((s) => s.addSession);
  const removeSession = useSessionStore((s) => s.removeSession);
  const removeMultipleSessions = useSessionStore((s) => s.removeMultipleSessions);
  const files = useFitsStore((s) => s.files);
  const targetCatalog = useTargetStore((s) => s.targets);

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
  const [actionSession, setActionSession] = useState<ObservationSession | null>(null);
  const [actionPlan, setActionPlan] = useState<ObservationPlan | null>(null);
  const [summaryDialog, setSummaryDialog] = useState<{
    title: string;
    icon?: string;
    status?: "success" | "warning" | "danger" | "default";
    items: SummaryItem[];
    footnote?: string;
  } | null>(null);

  const getSessionTargetNames = useCallback(
    (session: ObservationSession) => resolveSessionTargetNames(session, targetCatalog),
    [targetCatalog],
  );
  const getPlanTargetName = useCallback(
    (plan: ObservationPlan) =>
      resolveTargetName({ targetId: plan.targetId, name: plan.targetName }, targetCatalog),
    [targetCatalog],
  );

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
    logAction("batch_delete_open_confirm", { selectedCount: selectedIds.size });
    Alert.alert(t("common.delete"), `${t("sessions.deleteSessionConfirm")} (${selectedIds.size})`, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: () => {
          removeMultipleSessions([...selectedIds]);
          logSuccess("batch_delete", { selectedCount: selectedIds.size });
          exitSelectionMode();
        },
      },
    ]);
  }, [exitSelectionMode, logAction, logSuccess, removeMultipleSessions, selectedIds, t]);

  const handleDetectSessions = useCallback(() => {
    const result = autoDetectSessions();
    logSuccess("detect_sessions", {
      totalDetected: result.totalDetected,
      newCount: result.newCount,
      updatedCount: result.updatedCount,
      mergedCount: result.mergedCount,
      skippedCount: result.skippedCount,
    });
    setSummaryDialog({
      title: t("sessions.detectSummaryTitle"),
      icon: "scan-outline",
      status: "success",
      items: [
        {
          label: t("sessions.detectSummaryDetected"),
          value: result.totalDetected,
          color: "accent",
          icon: "telescope-outline",
        },
        {
          label: t("sessions.detectSummaryNew"),
          value: result.newCount,
          color: "success",
          icon: "add-circle-outline",
        },
        {
          label: t("sessions.detectSummaryUpdated"),
          value: result.updatedCount,
          color: "accent",
          icon: "create-outline",
        },
        {
          label: t("sessions.detectSummaryMerged"),
          value: result.mergedCount,
          color: "warning",
          icon: "git-merge-outline",
        },
        {
          label: t("sessions.detectSummarySkipped"),
          value: result.skippedCount,
          color: "default",
          icon: "remove-circle-outline",
        },
      ],
    });
  }, [autoDetectSessions, logSuccess, t]);

  const handleReconcileSessions = useCallback(() => {
    const summary = reconcileSessionsFromLinkedFiles();
    logSuccess("reconcile_sessions", {
      processed: summary.processed,
      updated: summary.updated,
      cleared: summary.cleared,
      logsAdded: summary.logsAdded,
      logsRemoved: summary.logsRemoved,
      unchanged: summary.unchanged,
      changed: summary.changed,
    });
    setSummaryDialog({
      title: t("sessions.reconcileSummaryTitle"),
      icon: "construct-outline",
      status: summary.changed ? "success" : "default",
      items: [
        {
          label: t("sessions.reconcileSummaryProcessed"),
          value: summary.processed,
          color: "accent",
          icon: "layers-outline",
        },
        {
          label: t("sessions.reconcileSummaryUpdated"),
          value: summary.updated,
          color: "success",
          icon: "checkmark-circle-outline",
        },
        {
          label: t("sessions.reconcileSummaryCleared"),
          value: summary.cleared,
          color: "warning",
          icon: "close-circle-outline",
        },
        {
          label: t("sessions.reconcileSummaryLogsAdded"),
          value: summary.logsAdded,
          color: "success",
          icon: "add-outline",
        },
        {
          label: t("sessions.reconcileSummaryLogsRemoved"),
          value: summary.logsRemoved,
          color: "danger",
          icon: "trash-outline",
        },
        {
          label: t("sessions.batchSummaryUnchanged"),
          value: summary.unchanged,
          color: "default",
          icon: "ellipsis-horizontal",
        },
      ],
      footnote: !summary.changed ? t("sessions.reconcileNoChanges") : undefined,
    });
  }, [logSuccess, reconcileSessionsFromLinkedFiles, t]);

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
          getSessionTargetNames(s).some((tgt) => tgt.toLowerCase().includes(q)) ||
          s.equipment.telescope?.toLowerCase().includes(q) ||
          s.location?.placeName?.toLowerCase().includes(q) ||
          s.location?.city?.toLowerCase().includes(q) ||
          s.notes?.toLowerCase().includes(q),
      );
    }

    return result;
  }, [sessions, searchQuery, selectedDate, getSessionTargetNames]);

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
          onPress: () => {
            removeSession(session.id);
            logSuccess("delete_session", { sessionId: session.id });
          },
        },
      ]);
    },
    [logSuccess, removeSession, t],
  );

  const handleDeletePlan = useCallback(
    (plan: ObservationPlan) => {
      Alert.alert(t("common.delete"), t("sessions.planDeleteConfirm"), [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: () => {
            deleteObservationPlan(plan.id);
            logSuccess("delete_plan", { planId: plan.id });
          },
        },
      ]);
    },
    [deleteObservationPlan, logSuccess, t],
  );

  const handleSyncAll = useCallback(async () => {
    if (!calendarSyncEnabled) return;
    const unsyncedCount = sessions.filter((s) => !s.calendarEventId).length;
    logAction("sync_all_sessions", { unsyncedCount });
    if (unsyncedCount === 0) {
      logSuccess("sync_all_sessions", { unsyncedCount, synced: 0 });
      Alert.alert(t("common.success"), t("sessions.synced"));
      return;
    }
    const count = await syncAllSessions(sessions);
    if (count > 0) {
      logSuccess("sync_all_sessions", { unsyncedCount, synced: count });
      Alert.alert(t("common.success"), `${t("sessions.syncSuccess")} (${count})`);
    }
  }, [calendarSyncEnabled, logAction, logSuccess, sessions, syncAllSessions, t]);

  const handleSyncAllPlans = useCallback(async () => {
    if (!calendarSyncEnabled) return;
    const unsyncedCount = plans.filter((p) => !p.calendarEventId).length;
    logAction("sync_all_plans", { unsyncedCount });
    if (unsyncedCount === 0) {
      logSuccess("sync_all_plans", { unsyncedCount, synced: 0 });
      Alert.alert(t("common.success"), t("sessions.noUnsyncedPlans"));
      return;
    }
    const count = await syncAllObservationPlans(plans);
    if (count > 0) {
      logSuccess("sync_all_plans", { unsyncedCount, synced: count });
      Alert.alert(t("common.success"), `${t("sessions.syncPlansSuccess")} (${count})`);
    }
  }, [calendarSyncEnabled, logAction, logSuccess, plans, syncAllObservationPlans, t]);

  const handleCleanupCalendarLinks = useCallback(async () => {
    if (!calendarSyncEnabled) return;
    const result = await cleanupMissingCalendarLinks(sessions, plans);
    logSuccess("cleanup_calendar_links", result);
    Alert.alert(
      t("common.success"),
      `${t("sessions.cleanupCalendarLinksDone")} (${result.sessionsCleared + result.plansCleared})`,
    );
  }, [calendarSyncEnabled, cleanupMissingCalendarLinks, logSuccess, plans, sessions, t]);

  const handleRefreshFromCalendar = useCallback(async () => {
    if (!calendarSyncEnabled) return;
    const linkedCount =
      sessions.filter((s) => !!s.calendarEventId).length +
      plans.filter((p) => !!p.calendarEventId).length;
    logAction("refresh_from_calendar", { linkedCount });
    if (linkedCount === 0) {
      logSuccess("refresh_from_calendar", { linkedCount, affected: 0 });
      Alert.alert(t("common.success"), t("sessions.noLinkedCalendarItems"));
      return;
    }

    const result = await refreshAllFromCalendar(sessions, plans);
    if (result.permissionDenied) {
      logFailure("refresh_from_calendar", new Error("permissionDenied"), { linkedCount });
      return;
    }
    const affected =
      result.sessionsUpdated + result.plansUpdated + result.sessionsCleared + result.plansCleared;

    if (affected === 0 && result.errors === 0) {
      logSuccess("refresh_from_calendar", { linkedCount, affected, errors: result.errors });
      Alert.alert(t("common.success"), t("sessions.noChangesFromCalendar"));
      return;
    }

    logSuccess("refresh_from_calendar", { linkedCount, affected, errors: result.errors });
    const suffix = result.errors > 0 ? `, ${t("common.error")}: ${result.errors}` : "";
    Alert.alert(
      t("common.success"),
      `${t("sessions.refreshFromCalendarDone")} (${affected}${suffix})`,
    );
  }, [
    calendarSyncEnabled,
    logAction,
    logFailure,
    logSuccess,
    plans,
    refreshAllFromCalendar,
    sessions,
    t,
  ]);

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
        logSuccess("create_session_from_plan", { planId: plan.id, sessionId: session.id });
        Alert.alert(t("common.success"), t("sessions.planConverted"));
      } catch (error) {
        logFailure("create_session_from_plan", error, { planId: plan.id });
        Alert.alert(t("common.error"), t("sessions.invalidTimeRange"));
      }
    },
    [addSession, logFailure, logSuccess, t, updateObservationPlan],
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

  const selectedSessions = useMemo(
    () => sessions.filter((session) => selectedIds.has(session.id)),
    [sessions, selectedIds],
  );

  const handleBatchSyncSelected = useCallback(async () => {
    if (selectedSessions.length === 0) {
      Alert.alert(t("common.error"), t("sessions.noSelectedSessions"));
      return;
    }

    logAction("batch_sync_selected_sessions", { selectedCount: selectedSessions.length });
    const summary = await syncSessionsBatch(selectedSessions);
    if (summary.permissionDenied) {
      logFailure("batch_sync_selected_sessions", new Error("permissionDenied"), {
        selectedCount: selectedSessions.length,
      });
      Alert.alert(t("common.error"), t("sessions.permissionDenied"));
      return;
    }

    logSuccess("batch_sync_selected_sessions", { ...summary });

    setSummaryDialog({
      title: t("sessions.batchSyncSessions"),
      icon: "sync-outline",
      status: summary.failed > 0 ? "warning" : "success",
      items: [
        { label: t("sessions.batchSummaryTotal"), value: summary.total, color: "accent" },
        { label: t("sessions.batchSummarySuccess"), value: summary.success, color: "success" },
        { label: t("sessions.batchSummarySkipped"), value: summary.skipped, color: "default" },
        { label: t("sessions.batchSummaryFailed"), value: summary.failed, color: "danger" },
      ],
    });
  }, [logAction, logFailure, logSuccess, selectedSessions, syncSessionsBatch, t]);

  const handleBatchUnsyncSelected = useCallback(async () => {
    if (selectedSessions.length === 0) {
      Alert.alert(t("common.error"), t("sessions.noSelectedSessions"));
      return;
    }

    logAction("batch_unsync_selected_sessions", { selectedCount: selectedSessions.length });
    const summary = await unsyncSessionsBatch(selectedSessions);
    logSuccess("batch_unsync_selected_sessions", { ...summary });
    setSummaryDialog({
      title: t("sessions.batchUnsyncSessions"),
      icon: "unlink-outline",
      status: summary.failed > 0 ? "warning" : "success",
      items: [
        { label: t("sessions.batchSummaryTotal"), value: summary.total, color: "accent" },
        { label: t("sessions.batchSummarySuccess"), value: summary.success, color: "success" },
        { label: t("sessions.batchSummarySkipped"), value: summary.skipped, color: "default" },
        { label: t("sessions.batchSummaryFailed"), value: summary.failed, color: "danger" },
      ],
    });
  }, [logAction, logSuccess, selectedSessions, t, unsyncSessionsBatch]);

  const handleBatchRefreshSelected = useCallback(async () => {
    if (selectedSessions.length === 0) {
      Alert.alert(t("common.error"), t("sessions.noSelectedSessions"));
      return;
    }

    logAction("batch_refresh_selected_sessions", { selectedCount: selectedSessions.length });
    const summary = await refreshSessionsBatch(selectedSessions);
    if (summary.permissionDenied) {
      logFailure("batch_refresh_selected_sessions", new Error("permissionDenied"), {
        selectedCount: selectedSessions.length,
      });
      Alert.alert(t("common.error"), t("sessions.permissionDenied"));
      return;
    }

    logSuccess("batch_refresh_selected_sessions", { ...summary });

    setSummaryDialog({
      title: t("sessions.batchRefreshSessions"),
      icon: "refresh-outline",
      status: summary.errors > 0 ? "warning" : "success",
      items: [
        { label: t("sessions.batchSummaryTotal"), value: summary.total, color: "accent" },
        { label: t("sessions.batchSummaryUpdated"), value: summary.updated, color: "success" },
        { label: t("sessions.batchSummaryCleared"), value: summary.cleared, color: "warning" },
        { label: t("sessions.batchSummaryUnchanged"), value: summary.unchanged, color: "default" },
        { label: t("sessions.batchSummarySkipped"), value: summary.skipped, color: "default" },
        { label: t("sessions.batchSummaryErrors"), value: summary.errors, color: "danger" },
      ],
    });
  }, [logAction, logFailure, logSuccess, refreshSessionsBatch, selectedSessions, t]);

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
          compact={isLandscape}
          isSelected={isSelectionMode && selectedIds.has(session.id)}
          onPress={() => {
            if (isSelectionMode) {
              toggleSelect(session.id);
            } else {
              router.push(`/session/${session.id}`);
            }
          }}
          onLongPress={isSelectionMode ? undefined : () => setActionSession(session)}
        />
      </View>
    ),
    [isLandscape, isSelectionMode, selectedIds, mutedColor, toggleSelect, router],
  );

  const dateSummarySection = selectedDate ? (
    <SessionDateSummary
      selectedDate={selectedDate}
      sessionsOnDate={sessionsOnSelectedDate}
      plansOnDate={plansOnSelectedDate}
      onClearDate={() => setSelectedDate(null)}
      onSessionPress={(sessionId) => router.push(`/session/${sessionId}`)}
      onPlanPress={(plan) => {
        setEditingPlan(plan);
        setShowPlanSheet(true);
      }}
      getSessionTargetNames={getSessionTargetNames}
      getPlanTargetName={getPlanTargetName}
    />
  ) : null;

  const planControlsSection = (
    <>
      <View className="mb-2">
        <SearchBar
          value={planSearchQuery}
          onChangeText={setPlanSearchQuery}
          placeholder={t("sessions.searchSessions")}
          compact={isLandscape}
        />
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
      <View className="mb-2 flex-row items-start justify-between gap-2">
        <Text className="text-base font-semibold text-foreground">
          {t("sessions.planObservation")} ({sortedPlans.length}/{plans.length})
        </Text>
        <View className="flex-row flex-wrap justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            onPress={handleSyncAllPlans}
            isDisabled={syncing || !calendarSyncEnabled}
          >
            <Ionicons name="sync-outline" size={12} color={mutedColor} />
            <Button.Label className="text-[10px]">{t("sessions.syncAllPlans")}</Button.Label>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onPress={handleRefreshFromCalendar}
            isDisabled={syncing || !calendarSyncEnabled}
          >
            <Ionicons name="refresh-outline" size={12} color={mutedColor} />
            <Button.Label className="text-[10px]">{t("sessions.refreshFromCalendar")}</Button.Label>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onPress={handleCleanupCalendarLinks}
            isDisabled={syncing || !calendarSyncEnabled}
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
              compact={isLandscape}
              onPress={() => {
                setEditingPlan(plan);
                setShowPlanSheet(true);
              }}
              onLongPress={() => setActionPlan(plan)}
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
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t("sessions.searchSessions")}
            compact={isLandscape}
          />
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
          onAction={files.length > 0 ? handleDetectSessions : undefined}
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
          <GuideTarget name="sessions-create" page="sessions" order={0}>
            <Button
              testID="e2e-action-tabs__sessions-open-create"
              size="sm"
              variant="outline"
              onPress={() => setShowCreateSheet(true)}
            >
              <Ionicons name="add-outline" size={14} color={mutedColor} />
            </Button>
          </GuideTarget>
          <GuideTarget name="sessions-plan" page="sessions" order={1}>
            <Button
              testID="e2e-action-tabs__sessions-open-plan"
              size="sm"
              variant="outline"
              onPress={() => setShowPlanSheet(true)}
            >
              <Ionicons name="calendar-outline" size={14} color={mutedColor} />
            </Button>
          </GuideTarget>
          {sessions.length > 1 && (
            <Button
              testID="e2e-action-tabs__sessions-open-selection"
              size="sm"
              variant="outline"
              onPress={() => setIsSelectionMode(true)}
            >
              <Ionicons name="checkbox-outline" size={14} color={mutedColor} />
            </Button>
          )}
          {sessions.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onPress={handleSyncAll}
              isDisabled={syncing || !calendarSyncEnabled}
            >
              <Ionicons name="sync-outline" size={14} color={mutedColor} />
            </Button>
          )}
          <GuideTarget name="sessions-detect" page="sessions" order={2}>
            <Button size="sm" variant="outline" onPress={handleDetectSessions}>
              <Ionicons name="scan-outline" size={14} color={mutedColor} />
            </Button>
          </GuideTarget>
          <Button
            testID="e2e-action-tabs__sessions-reconcile"
            size="sm"
            variant="outline"
            onPress={handleReconcileSessions}
            accessibilityLabel={t("sessions.reconcileSessions")}
          >
            <Ionicons name="construct-outline" size={14} color={mutedColor} />
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
      <ActiveSessionBanner />
      {plansSection}
      {sessionToolsSection}
    </View>
  );

  const selectionBar = isSelectionMode ? (
    <SessionSelectionBar
      selectedCount={selectedIds.size}
      calendarSyncEnabled={calendarSyncEnabled}
      syncing={syncing}
      isLandscape={isLandscape}
      onClose={exitSelectionMode}
      onToggleSelectAll={() => {
        if (selectedIds.size === sortedSessions.length) {
          setSelectedIds(new Set());
        } else {
          setSelectedIds(new Set(sortedSessions.map((s) => s.id)));
        }
      }}
      onBatchSync={() => void handleBatchSyncSelected()}
      onBatchRefresh={() => void handleBatchRefreshSelected()}
      onBatchUnsync={() => void handleBatchUnsyncSelected()}
      onBatchDelete={handleBatchDelete}
    />
  ) : null;

  return (
    <View
      testID="e2e-screen-tabs__sessions"
      className="flex-1 bg-background"
      style={{ paddingTop: contentPaddingTop }}
    >
      {selectionBar}
      {isLandscape ? (
        <View className="flex-1 flex-row">
          <ScrollView
            style={isLandscapeTablet ? { width: sidePanelWidth } : { flex: 1 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: 16 }}
          >
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-xl font-bold text-foreground">{t("sessions.title")}</Text>
              <View className="flex-row gap-1">
                <Button
                  testID="e2e-action-tabs__sessions-open-create"
                  size="sm"
                  variant="outline"
                  onPress={() => setShowCreateSheet(true)}
                >
                  <Ionicons name="add-outline" size={14} color={mutedColor} />
                </Button>
                <Button
                  testID="e2e-action-tabs__sessions-open-plan"
                  size="sm"
                  variant="outline"
                  onPress={() => setShowPlanSheet(true)}
                >
                  <Ionicons name="calendar-outline" size={14} color={mutedColor} />
                </Button>
                {sessions.length > 1 && (
                  <Button
                    testID="e2e-action-tabs__sessions-open-selection"
                    size="sm"
                    variant="outline"
                    onPress={() => setIsSelectionMode(true)}
                  >
                    <Ionicons name="checkbox-outline" size={14} color={mutedColor} />
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onPress={handleSyncAll}
                  isDisabled={syncing || !calendarSyncEnabled}
                >
                  <Ionicons name="sync-outline" size={14} color={mutedColor} />
                </Button>
                <Button size="sm" variant="outline" onPress={handleDetectSessions}>
                  <Ionicons name="scan-outline" size={14} color={mutedColor} />
                </Button>
                <Button
                  testID="e2e-action-tabs__sessions-reconcile"
                  size="sm"
                  variant="outline"
                  onPress={handleReconcileSessions}
                  accessibilityLabel={t("sessions.reconcileSessions")}
                >
                  <Ionicons name="construct-outline" size={14} color={mutedColor} />
                </Button>
              </View>
            </View>
            <ActiveSessionBanner />
            <View className="mb-3 flex-row gap-2">
              <Card variant="secondary" className="flex-1">
                <Card.Body className="items-center p-1.5">
                  <Text className="text-sm font-bold text-foreground">{sessions.length}</Text>
                  <Text className="text-[9px] text-muted">{t("sessions.session")}</Text>
                </Card.Body>
              </Card>
              <Card variant="secondary" className="flex-1">
                <Card.Body className="items-center p-1.5">
                  <Text className="text-sm font-bold text-foreground">
                    {formatDuration(totalDuration)}
                  </Text>
                  <Text className="text-[9px] text-muted">{t("sessions.totalTime")}</Text>
                </Card.Body>
              </Card>
              <Card variant="secondary" className="flex-1">
                <Card.Body className="items-center p-1.5">
                  <Text className="text-sm font-bold text-foreground">{totalImages}</Text>
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
              compact
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
            removeClippedSubviews
            maxToRenderPerBatch={10}
            windowSize={7}
            initialNumToRender={8}
          />
        </View>
      ) : (
        <FlatList
          data={sortedSessions}
          keyExtractor={(item) => item.id}
          renderItem={renderSessionItem}
          ListHeaderComponent={portraitListHeader}
          contentContainerClassName="pb-4"
          removeClippedSubviews
          maxToRenderPerBatch={10}
          windowSize={7}
          initialNumToRender={8}
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
      <SessionActionSheet
        visible={!!actionSession}
        session={actionSession}
        calendarSyncEnabled={calendarSyncEnabled}
        onClose={() => setActionSession(null)}
        onSyncToCalendar={syncSession}
        onUnsyncFromCalendar={unsyncSession}
        onOpenInCalendar={openSessionInCalendar}
        onRefreshFromCalendar={refreshSessionFromCalendar}
        onEditInCalendar={editSessionInCalendar}
        onCreateViaSystemCalendar={createSessionViaSystemCalendar}
        onDelete={handleDeleteSession}
      />
      <PlanActionSheet
        visible={!!actionPlan}
        plan={actionPlan}
        onClose={() => setActionPlan(null)}
        onSyncToCalendar={calendarSyncEnabled ? (p) => syncObservationPlan(p.id) : undefined}
        onUnsyncFromCalendar={
          calendarSyncEnabled ? (p) => void unsyncObservationPlan(p.id) : undefined
        }
        onOpenInCalendar={calendarSyncEnabled ? openPlanInCalendar : undefined}
        onRefreshFromCalendar={calendarSyncEnabled ? refreshPlanFromCalendar : undefined}
        onEditInCalendar={calendarSyncEnabled ? editPlanInCalendar : undefined}
        onCreateViaSystemCalendar={calendarSyncEnabled ? createPlanViaSystemCalendar : undefined}
        onCreateSession={handleCreateSessionFromPlan}
        onStatusChange={(p, status) => updateObservationPlan(p.id, { status })}
        onEdit={(p) => {
          setActionPlan(null);
          setEditingPlan(p);
          setShowPlanSheet(true);
        }}
        onDelete={handleDeletePlan}
      />
      {summaryDialog && (
        <OperationSummaryDialog
          visible={!!summaryDialog}
          onClose={() => setSummaryDialog(null)}
          title={summaryDialog.title}
          icon={summaryDialog.icon}
          status={summaryDialog.status}
          items={summaryDialog.items}
          footnote={summaryDialog.footnote}
        />
      )}
    </View>
  );
}
