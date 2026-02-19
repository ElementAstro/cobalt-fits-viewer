import { useCallback, useMemo, useState } from "react";
import { View, Text, ScrollView, Share } from "react-native";
import { Button, Card, Chip, PressableFeedback, Separator, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useI18n } from "../../i18n/useI18n";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import {
  useSessionById,
  useLogEntriesBySession,
  useSessionStore,
} from "../../stores/useSessionStore";
import { useTargetStore } from "../../stores/useTargetStore";
import { useFitsStore } from "../../stores/useFitsStore";
import { exportToCSV, exportSessionToJSON } from "../../lib/sessions/observationLog";
import { formatDuration } from "../../lib/sessions/format";
import { ThumbnailGrid } from "../../components/gallery/ThumbnailGrid";
import { EditSessionSheet } from "../../components/sessions/EditSessionSheet";
import { EmptyState } from "../../components/common/EmptyState";
import { PromptDialog } from "../../components/common/PromptDialog";
import type { FitsMetadata, ObservationSession } from "../../lib/fits/types";
import { resolveTargetId, resolveTargetName } from "../../lib/targets/targetRefs";
import { resolveSessionTargetNames } from "../../lib/sessions/sessionLinking";

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");
  const { contentPaddingTop, horizontalPadding, isLandscapeTablet } = useResponsiveLayout();

  const session = useSessionById(id);
  const logEntries = useLogEntriesBySession(id);
  const files = useFitsStore((s) => s.files);
  const updateSession = useSessionStore((s) => s.updateSession);
  const removeSession = useSessionStore((s) => s.removeSession);
  const updateLogEntry = useSessionStore((s) => s.updateLogEntry);
  const targets = useTargetStore((s) => s.targets);

  const [showEditSheet, setShowEditSheet] = useState(false);
  const [editingLogEntry, setEditingLogEntry] = useState<{
    id: string;
    label: string;
    notes: string;
  } | null>(null);

  const handleExportLog = useCallback(async () => {
    const csv = exportToCSV(logEntries);
    await Share.share({
      message: csv,
      title: t("sessions.exportLog"),
    });
  }, [logEntries, t]);

  const handleExportJSON = useCallback(async () => {
    if (!session) return;
    const json = exportSessionToJSON(session, logEntries);
    await Share.share({
      message: json,
      title: `${t("sessions.exportJSON")} - ${session.date}`,
    });
  }, [session, logEntries, t]);

  const handleFilePress = (file: FitsMetadata) => {
    router.push(`/viewer/${file.id}`);
  };

  const getSessionTargetNames = useCallback(
    (currentSession: ObservationSession) => resolveSessionTargetNames(currentSession, targets),
    [targets],
  );

  const handleTargetPress = (targetRef: ObservationSession["targetRefs"][number]) => {
    const targetId = resolveTargetId(targetRef, targets);
    if (!targetId) return;
    router.push(`/target/${targetId}`);
  };

  const handleSave = (updates: Partial<ObservationSession>) => {
    if (id) updateSession(id, updates);
    setShowEditSheet(false);
  };

  const handleDelete = () => {
    if (id) removeSession(id);
    setShowEditSheet(false);
    router.back();
  };

  // Filter breakdown statistics
  const filterStats = useMemo(() => {
    const map = new Map<string, { count: number; totalExp: number }>();
    for (const entry of logEntries) {
      const existing = map.get(entry.filter) ?? { count: 0, totalExp: 0 };
      existing.count += 1;
      existing.totalExp += entry.exptime;
      map.set(entry.filter, existing);
    }
    return [...map.entries()].sort((a, b) => b[1].totalExp - a[1].totalExp);
  }, [logEntries]);

  // Target breakdown statistics
  const targetStats = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of logEntries) {
      map.set(entry.object, (map.get(entry.object) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [logEntries]);

  const handleShare = useCallback(() => {
    if (!session) return;
    const lines = [
      `🔭 ${t("sessions.sessionSummary")}`,
      `📅 ${session.date}`,
      `⏱ ${formatDuration(session.duration)}`,
      `🎯 ${getSessionTargetNames(session).join(", ") || "-"}`,
      `🖼 ${session.imageIds.length} ${t("sessions.frames")}`,
    ];
    if (session.equipment.telescope) lines.push(`🔭 ${session.equipment.telescope}`);
    if (session.equipment.camera) lines.push(`📷 ${session.equipment.camera}`);
    if (session.location) {
      const loc = session.location.placeName ?? session.location.city ?? session.location.region;
      if (loc) lines.push(`📍 ${loc}`);
    }
    if (session.weather) lines.push(`🌤 ${session.weather}`);
    if (session.seeing) lines.push(`👁 ${session.seeing}`);
    if (session.notes) lines.push(`📝 ${session.notes}`);
    Share.share({ message: lines.join("\n") });
  }, [session, t, getSessionTargetNames]);

  if (!session) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Ionicons name="alert-circle-outline" size={48} color={mutedColor} />
        <Text className="mt-4 text-sm text-muted">{t("common.noData")}</Text>
        <Button variant="outline" className="mt-4" onPress={() => router.back()}>
          <Button.Label>{t("common.goHome")}</Button.Label>
        </Button>
      </View>
    );
  }

  const sessionFiles = files.filter((f) => session.imageIds.includes(f.id));

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <>
      <ScrollView
        testID="e2e-screen-session__param_id"
        className="flex-1 bg-background"
        contentContainerStyle={{
          paddingHorizontal: horizontalPadding,
          paddingTop: contentPaddingTop,
          paddingBottom: 24,
        }}
      >
        {/* Top Bar */}
        <View className="flex-row items-center gap-3 mb-4">
          <Button
            testID="e2e-action-session__param_id-back"
            size="sm"
            variant="outline"
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={16} color={mutedColor} />
          </Button>
          <View className="flex-1">
            <Text className="text-lg font-bold text-foreground">
              {t("sessions.session")} - {session.date}
            </Text>
            <Text className="text-[10px] text-muted">
              {formatTime(session.startTime)} - {formatTime(session.endTime)} ·{" "}
              {formatDuration(session.duration)}
            </Text>
          </View>
          <Button
            testID="e2e-action-session__param_id-share"
            size="sm"
            variant="outline"
            onPress={handleShare}
          >
            <Ionicons name="share-outline" size={16} color={mutedColor} />
          </Button>
          <Button
            testID="e2e-action-session__param_id-open-edit"
            size="sm"
            variant="outline"
            onPress={() => setShowEditSheet(true)}
          >
            <Ionicons name="create-outline" size={16} color={mutedColor} />
          </Button>
        </View>

        <Separator className="mb-4" />

        {/* Session Info Cards */}
        <View className="flex-row gap-2 mb-4">
          <Card variant="secondary" className="flex-1">
            <Card.Body className="items-center p-3">
              <Ionicons name="time-outline" size={20} color={mutedColor} />
              <Text className="mt-1 text-sm font-bold text-foreground">
                {formatDuration(session.duration)}
              </Text>
              <Text className="text-[10px] text-muted">{t("sessions.duration")}</Text>
            </Card.Body>
          </Card>
          <Card variant="secondary" className="flex-1">
            <Card.Body className="items-center p-3">
              <Ionicons name="telescope-outline" size={20} color={mutedColor} />
              <Text className="mt-1 text-sm font-bold text-foreground">
                {session.targetRefs.length}
              </Text>
              <Text className="text-[10px] text-muted">{t("targets.title")}</Text>
            </Card.Body>
          </Card>
          <Card variant="secondary" className="flex-1">
            <Card.Body className="items-center p-3">
              <Ionicons name="images-outline" size={20} color={mutedColor} />
              <Text className="mt-1 text-sm font-bold text-foreground">
                {session.imageIds.length}
              </Text>
              <Text className="text-[10px] text-muted">{t("sessions.imageCount")}</Text>
            </Card.Body>
          </Card>
        </View>

        {/* Targets (clickable) */}
        {session.targetRefs.length > 0 && (
          <View className="flex-row flex-wrap gap-1.5 mb-4">
            {session.targetRefs.map((targetRef, index) => {
              const resolvedId = resolveTargetId(targetRef, targets);
              const displayName = resolveTargetName(targetRef, targets);
              const linked = Boolean(resolvedId);
              return (
                <PressableFeedback
                  key={`${targetRef.targetId ?? targetRef.name}-${index}`}
                  onPress={() => handleTargetPress(targetRef)}
                  isDisabled={!linked}
                >
                  <PressableFeedback.Highlight />
                  <Chip size="sm" variant={linked ? "primary" : "secondary"}>
                    <Chip.Label className="text-[9px]">{displayName}</Chip.Label>
                  </Chip>
                </PressableFeedback>
              );
            })}
          </View>
        )}

        {/* Location */}
        {session.location && (
          <View className="mb-4 flex-row items-center gap-2 rounded-lg bg-surface-secondary px-3 py-2">
            <Ionicons name="location-outline" size={14} color={mutedColor} />
            <Text className="text-xs text-foreground">
              {session.location.placeName ??
                session.location.city ??
                session.location.region ??
                `${session.location.latitude.toFixed(4)}°, ${session.location.longitude.toFixed(4)}°`}
            </Text>
          </View>
        )}

        {/* Weather & Seeing */}
        {(session.weather || session.seeing) && (
          <View className="flex-row gap-2 mb-4">
            {session.weather && (
              <View className="flex-1 flex-row items-center gap-2 rounded-lg bg-surface-secondary px-3 py-2">
                <Ionicons name="cloudy-outline" size={14} color={mutedColor} />
                <Text className="text-xs text-foreground">{session.weather}</Text>
              </View>
            )}
            {session.seeing && (
              <View className="flex-1 flex-row items-center gap-2 rounded-lg bg-surface-secondary px-3 py-2">
                <Ionicons name="eye-outline" size={14} color={mutedColor} />
                <Text className="text-xs text-foreground">{session.seeing}</Text>
              </View>
            )}
          </View>
        )}

        {/* Rating & Bortle */}
        {(session.rating != null || session.bortle != null) && (
          <View className="flex-row gap-2 mb-4">
            {session.rating != null && (
              <View className="flex-1 flex-row items-center gap-2 rounded-lg bg-surface-secondary px-3 py-2">
                <View className="flex-row gap-0.5">
                  {[1, 2, 3, 4, 5].map((r) => (
                    <Ionicons
                      key={r}
                      name={session.rating != null && session.rating >= r ? "star" : "star-outline"}
                      size={12}
                      color={session.rating != null && session.rating >= r ? "#f59e0b" : mutedColor}
                    />
                  ))}
                </View>
                <Text className="text-[10px] text-muted">{t("sessions.rating")}</Text>
              </View>
            )}
            {session.bortle != null && (
              <View className="flex-1 flex-row items-center gap-2 rounded-lg bg-surface-secondary px-3 py-2">
                <Text className="text-sm font-bold text-foreground">{session.bortle}</Text>
                <Text className="text-[10px] text-muted">{t("sessions.bortle")}</Text>
              </View>
            )}
          </View>
        )}

        {/* Tags */}
        {session.tags && session.tags.length > 0 && (
          <View className="flex-row flex-wrap gap-1 mb-4">
            {session.tags.map((tag) => (
              <Chip key={tag} size="sm" variant="secondary">
                <Chip.Label className="text-[9px]">#{tag}</Chip.Label>
              </Chip>
            ))}
          </View>
        )}

        {/* Equipment */}
        {(session.equipment.telescope || session.equipment.camera || session.equipment.mount) && (
          <>
            <Text className="mb-2 text-xs font-semibold uppercase text-muted">
              {t("sessions.equipment")}
            </Text>
            <Card variant="secondary" className="mb-4">
              <Card.Body className="gap-1 p-3">
                {session.equipment.telescope && (
                  <View className="flex-row items-center gap-2">
                    <Ionicons name="telescope-outline" size={12} color={mutedColor} />
                    <Text className="text-xs text-foreground">{session.equipment.telescope}</Text>
                  </View>
                )}
                {session.equipment.camera && (
                  <View className="flex-row items-center gap-2">
                    <Ionicons name="camera-outline" size={12} color={mutedColor} />
                    <Text className="text-xs text-foreground">{session.equipment.camera}</Text>
                  </View>
                )}
                {session.equipment.mount && (
                  <View className="flex-row items-center gap-2">
                    <Ionicons name="hardware-chip-outline" size={12} color={mutedColor} />
                    <Text className="text-xs text-foreground">{session.equipment.mount}</Text>
                  </View>
                )}
                {session.equipment.filters && session.equipment.filters.length > 0 && (
                  <View className="flex-row flex-wrap gap-1 mt-1">
                    {session.equipment.filters.map((f) => (
                      <Chip key={f} size="sm" variant="secondary">
                        <Chip.Label className="text-[9px]">{f}</Chip.Label>
                      </Chip>
                    ))}
                  </View>
                )}
              </Card.Body>
            </Card>
          </>
        )}

        {/* Notes */}
        {session.notes && (
          <>
            <Text className="mb-2 text-xs font-semibold uppercase text-muted">
              {t("sessions.notes")}
            </Text>
            <Card variant="secondary" className="mb-4">
              <Card.Body className="p-3">
                <Text className="text-xs text-foreground">{session.notes}</Text>
              </Card.Body>
            </Card>
          </>
        )}

        <Separator className="mb-4" />

        {/* Filter Breakdown */}
        {filterStats.length > 0 && (
          <>
            <Text className="mb-2 text-xs font-semibold uppercase text-muted">
              {t("sessions.filterBreakdown")}
            </Text>
            <View className="gap-1 mb-4">
              {filterStats.map(([filter, stats]) => (
                <View
                  key={filter}
                  className="flex-row items-center justify-between rounded-lg bg-surface-secondary px-3 py-2"
                >
                  <Text className="text-xs font-medium text-foreground">{filter}</Text>
                  <Text className="text-[10px] text-muted">
                    {stats.count} {t("sessions.frames")} · {formatDuration(stats.totalExp)}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Target Breakdown */}
        {targetStats.length > 1 && (
          <>
            <Text className="mb-2 text-xs font-semibold uppercase text-muted">
              {t("sessions.targetBreakdown")}
            </Text>
            <View className="gap-1 mb-4">
              {targetStats.map(([target, count]) => (
                <View
                  key={target}
                  className="flex-row items-center justify-between rounded-lg bg-surface-secondary px-3 py-2"
                >
                  <Text className="text-xs font-medium text-foreground">{target}</Text>
                  <Text className="text-[10px] text-muted">
                    {count} {t("sessions.frames")}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        <Separator className="mb-4" />

        {/* Observation Log */}
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-xs font-semibold uppercase text-muted">
            {t("sessions.log")} ({logEntries.length})
          </Text>
          <View className="flex-row gap-1">
            <Button size="sm" variant="outline" onPress={handleExportJSON}>
              <Ionicons name="code-slash-outline" size={12} color={mutedColor} />
              <Button.Label className="text-[10px]">JSON</Button.Label>
            </Button>
            <Button size="sm" variant="outline" onPress={handleExportLog}>
              <Ionicons name="download-outline" size={12} color={mutedColor} />
              <Button.Label className="text-[10px]">CSV</Button.Label>
            </Button>
          </View>
        </View>

        {logEntries.length > 0 ? (
          <View className="gap-1">
            {logEntries.map((entry) => (
              <PressableFeedback
                key={entry.id}
                onLongPress={() => {
                  setEditingLogEntry({
                    id: entry.id,
                    label: `${entry.object} · ${entry.filter}`,
                    notes: entry.notes ?? "",
                  });
                }}
              >
                <PressableFeedback.Highlight />
                <Card variant="secondary">
                  <Card.Body className="flex-row items-center justify-between p-2">
                    <View className="flex-1">
                      <Text className="text-[10px] font-semibold text-foreground">
                        {entry.object} · {entry.filter}
                      </Text>
                      <Text className="text-[9px] text-muted">
                        {entry.dateTime} · {entry.exptime}s
                        {entry.gain != null && ` · G${entry.gain}`}
                      </Text>
                      {entry.notes && (
                        <Text className="text-[9px] text-accent mt-0.5">📝 {entry.notes}</Text>
                      )}
                    </View>
                  </Card.Body>
                </Card>
              </PressableFeedback>
            ))}
          </View>
        ) : (
          <View className="items-center py-8">
            <Text className="text-xs text-muted">{t("common.noData")}</Text>
          </View>
        )}

        <Separator className="my-4" />

        {/* Image Grid */}
        <Text className="mb-2 text-xs font-semibold uppercase text-muted">
          {t("gallery.allImages")} ({sessionFiles.length})
        </Text>
        {sessionFiles.length === 0 ? (
          <EmptyState icon="images-outline" title={t("gallery.noImages")} />
        ) : (
          <ThumbnailGrid
            files={sessionFiles}
            columns={isLandscapeTablet ? 4 : 3}
            onPress={handleFilePress}
          />
        )}
      </ScrollView>

      {session && (
        <EditSessionSheet
          visible={showEditSheet}
          session={session}
          onClose={() => setShowEditSheet(false)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}

      <PromptDialog
        visible={!!editingLogEntry}
        title={t("sessions.notes")}
        placeholder={editingLogEntry?.label}
        defaultValue={editingLogEntry?.notes ?? ""}
        onConfirm={(text) => {
          if (editingLogEntry) {
            updateLogEntry(editingLogEntry.id, { notes: text || undefined });
          }
          setEditingLogEntry(null);
        }}
        onCancel={() => setEditingLogEntry(null)}
      />
    </>
  );
}
