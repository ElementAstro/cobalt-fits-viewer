import { useState, useMemo, useCallback } from "react";
import { View, Text, FlatList } from "react-native";
import { Button, Card, Dialog, Popover, Separator, Tabs, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useI18n } from "../../i18n/useI18n";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import { useTargets } from "../../hooks/useTargets";
import { useTargetStatistics } from "../../hooks/useTargetStatistics";
import { useFitsStore } from "../../stores/useFitsStore";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { useTargetGroupStore } from "../../stores/useTargetGroupStore";
import { TargetCard } from "../../components/targets/TargetCard";
import { ExposureProgress } from "../../components/targets/ExposureProgress";
import { ObservationTimeline } from "../../components/targets/ObservationTimeline";
import { EmptyState } from "../../components/common/EmptyState";
import { resolveTargetInteractionUi } from "../../lib/targets/targetInteractionUi";
import { sortTargets, quickSearch } from "../../lib/targets/targetSearch";
import { formatExposureHours } from "../../lib/targets/targetStatistics";
import {
  STATUS_COLORS,
  TARGET_STATUSES,
  targetStatusI18nKey,
} from "../../lib/targets/targetConstants";
import type { Target } from "../../lib/fits/types";

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");
  const dangerColor = useThemeColor("danger");
  const { contentPaddingTop, horizontalPadding } = useResponsiveLayout();

  const { targets, toggleFavorite, togglePinned, getTargetStats } = useTargets();
  const { getGroupStats, formatExposureHours: _fmtHours } = useTargetStatistics();
  const files = useFitsStore((s) => s.files);
  const group = useTargetGroupStore((s) => s.groups.find((g) => g.id === id));
  const _updateGroup = useTargetGroupStore((s) => s.updateGroup);
  const removeGroup = useTargetGroupStore((s) => s.removeGroup);
  const removeTargetFromGroup = useTargetGroupStore((s) => s.removeTargetFromGroup);
  const targetActionControlMode = useSettingsStore((s) => s.targetActionControlMode);
  const targetActionSizePreset = useSettingsStore((s) => s.targetActionSizePreset);
  const targetActionAutoScaleFromFont = useSettingsStore((s) => s.targetActionAutoScaleFromFont);
  const timelineGrouping = useSettingsStore((s) => s.timelineGrouping);

  const interactionUi = resolveTargetInteractionUi({
    preset: targetActionSizePreset,
    autoScaleFromFont: targetActionAutoScaleFromFont,
    fontScale: 1,
  });

  const [searchQuery, _setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("targets");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Group targets
  const groupTargets = useMemo(() => {
    if (!group) return [];
    const memberSet = new Set(group.targetIds);
    return targets.filter((t) => memberSet.has(t.id));
  }, [group, targets]);

  // Search within group
  const filteredTargets = useMemo(() => {
    const searched = searchQuery.trim() ? quickSearch(groupTargets, searchQuery) : groupTargets;
    return sortTargets(searched, "name", "asc", (targetId) => {
      const stats = getTargetStats(targetId);
      return stats?.exposureStats.totalExposure ?? 0;
    });
  }, [groupTargets, searchQuery, getTargetStats]);

  // Group files (all files linked to group targets)
  const groupFiles = useMemo(() => {
    const imageIdSet = new Set(groupTargets.flatMap((t) => t.imageIds));
    return files.filter((f) => imageIdSet.has(f.id));
  }, [groupTargets, files]);

  // Group statistics
  const groupStats = useMemo(() => {
    if (!id) return null;
    return getGroupStats(id);
  }, [id, getGroupStats]);

  // Filter progress data for ExposureProgress
  const filterProgressData = useMemo(() => {
    if (!groupStats) return [];
    // Aggregate planned exposure across all group targets
    const plannedByFilter: Record<string, number> = {};
    for (const target of groupTargets) {
      for (const filter of target.plannedFilters) {
        plannedByFilter[filter] =
          (plannedByFilter[filter] ?? 0) + (target.plannedExposure[filter] ?? 0);
      }
    }

    return Object.entries(groupStats.filterBreakdown).map(([filter, data]) => ({
      filter,
      planned: plannedByFilter[filter] ?? 0,
      acquired: data.totalSeconds,
      percent:
        plannedByFilter[filter] && plannedByFilter[filter] > 0
          ? Math.min(100, Math.round((data.totalSeconds / plannedByFilter[filter]) * 100))
          : data.totalSeconds > 0
            ? 100
            : 0,
    }));
  }, [groupStats, groupTargets]);

  const handleDeleteGroup = useCallback(() => {
    if (!id) return;
    removeGroup(id);
    setShowDeleteDialog(false);
    router.back();
  }, [id, removeGroup, router]);

  const _handleRemoveFromGroup = useCallback(
    (targetId: string) => {
      if (!id) return;
      removeTargetFromGroup(id, targetId);
    },
    [id, removeTargetFromGroup],
  );

  const renderTargetItem = useCallback(
    ({ item: target }: { item: Target }) => {
      const stats = getTargetStats(target.id);
      const totalExposureMin = stats ? Math.round(stats.exposureStats.totalExposure / 60) : 0;
      const completion = stats?.completion.overall;

      return (
        <View className="px-4 mb-3">
          <TargetCard
            target={target}
            frameCount={target.imageIds.length}
            totalExposureMinutes={totalExposureMin}
            completionPercent={completion}
            onPress={() => router.push(`/target/${target.id}`)}
            onToggleFavorite={() => toggleFavorite(target.id)}
            onTogglePinned={() => togglePinned(target.id)}
            actionControlMode={targetActionControlMode}
            interactionUi={interactionUi}
          />
        </View>
      );
    },
    [getTargetStats, router, toggleFavorite, togglePinned, targetActionControlMode, interactionUi],
  );

  if (!group) {
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

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: contentPaddingTop }}>
      {/* Header */}
      <View className="px-4 pb-4 gap-3" style={{ paddingHorizontal: horizontalPadding }}>
        <View className="flex-row items-center gap-3">
          <Button
            size={interactionUi.buttonSize}
            isIconOnly
            variant="outline"
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={interactionUi.iconSize} color={mutedColor} />
          </Button>
          <View className="min-w-0 flex-1 flex-row items-center gap-2">
            {group.icon && <Text className="text-lg">{group.icon}</Text>}
            <View
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: group.color ?? "#888" }}
            />
            <Text className="flex-1 text-lg font-bold text-foreground" numberOfLines={1}>
              {group.name}
            </Text>
            {group.isPinned && <Ionicons name="pin" size={14} color={mutedColor} />}
          </View>
          <Popover presentation="bottom-sheet">
            <Popover.Trigger asChild>
              <Button size={interactionUi.buttonSize} isIconOnly variant="outline">
                <Ionicons
                  name="ellipsis-horizontal"
                  size={interactionUi.iconSize}
                  color={mutedColor}
                />
              </Button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Overlay />
              <Popover.Content presentation="bottom-sheet">
                <View className="gap-2 px-2 py-3">
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onPress={() => {
                      // TODO: Open edit group sheet
                    }}
                  >
                    <Ionicons name="create-outline" size={16} color={mutedColor} />
                    <Button.Label>{t("targets.groups.editGroup")}</Button.Label>
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onPress={() => {
                      // TODO: Export group targets
                    }}
                  >
                    <Ionicons name="share-outline" size={16} color={mutedColor} />
                    <Button.Label>{t("targets.groups.exportGroup")}</Button.Label>
                  </Button>
                  <Separator />
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onPress={() => setShowDeleteDialog(true)}
                  >
                    <Ionicons name="trash-outline" size={16} color={dangerColor} />
                    <Button.Label>{t("targets.groups.deleteGroup")}</Button.Label>
                  </Button>
                </View>
              </Popover.Content>
            </Popover.Portal>
          </Popover>
        </View>

        {group.description && <Text className="text-xs text-muted ml-11">{group.description}</Text>}

        {/* Stats cards */}
        {groupStats && (
          <View className="flex-row gap-2">
            <Card variant="secondary" className="flex-1">
              <Card.Body className="items-center p-2">
                <Text className="text-lg font-bold text-foreground">{groupStats.targetCount}</Text>
                <Text className="text-[9px] text-muted">{t("targets.title")}</Text>
              </Card.Body>
            </Card>
            <Card variant="secondary" className="flex-1">
              <Card.Body className="items-center p-2">
                <Text className="text-lg font-bold text-foreground">{groupStats.totalFrames}</Text>
                <Text className="text-[9px] text-muted">{t("targets.frameCount")}</Text>
              </Card.Body>
            </Card>
            <Card variant="secondary" className="flex-1">
              <Card.Body className="items-center p-2">
                <Text className="text-lg font-bold text-foreground">
                  {formatExposureHours(groupStats.totalExposureSeconds)}
                </Text>
                <Text className="text-[9px] text-muted">{t("targets.totalExposure")}</Text>
              </Card.Body>
            </Card>
            <Card variant="secondary" className="flex-1">
              <Card.Body className="items-center p-2">
                <Text className="text-lg font-bold text-foreground">
                  {groupStats.overallCompletion}%
                </Text>
                <Text className="text-[9px] text-muted">{t("targets.groups.completion")}</Text>
              </Card.Body>
            </Card>
          </View>
        )}
      </View>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
        <View className="px-4">
          <Tabs.List>
            <Tabs.Indicator />
            <Tabs.Trigger value="targets">
              <Tabs.Label>{t("targets.groups.targetList")}</Tabs.Label>
            </Tabs.Trigger>
            <Tabs.Trigger value="overview">
              <Tabs.Label>{t("targets.groups.overview")}</Tabs.Label>
            </Tabs.Trigger>
            <Tabs.Trigger value="timeline">
              <Tabs.Label>{t("targets.groups.timeline")}</Tabs.Label>
            </Tabs.Trigger>
          </Tabs.List>
        </View>

        <Tabs.Content value="targets" className="flex-1">
          {groupTargets.length === 0 ? (
            <View className="px-4">
              <EmptyState
                icon="telescope-outline"
                title={t("targets.groups.noTargetsInGroup")}
                description={t("targets.groups.addTargetsHint")}
              />
            </View>
          ) : (
            <FlatList
              data={filteredTargets}
              keyExtractor={(item) => item.id}
              renderItem={renderTargetItem}
              contentContainerClassName="pt-3 pb-4"
              removeClippedSubviews
              windowSize={7}
              maxToRenderPerBatch={10}
              initialNumToRender={10}
            />
          )}
        </Tabs.Content>

        <Tabs.Content value="overview" className="flex-1 px-4 pt-3">
          {/* Status distribution */}
          {groupStats && Object.keys(groupStats.byStatus).length > 0 && (
            <Card variant="secondary" className="mb-4">
              <Card.Header>
                <Card.Title className="text-xs">{t("targets.groups.stats")}</Card.Title>
              </Card.Header>
              <Card.Body className="p-3 pt-0">
                <View className="flex-row gap-2">
                  {TARGET_STATUSES.map((status) => {
                    const count = groupStats.byStatus[status] ?? 0;
                    if (count === 0) return null;
                    return (
                      <View key={status} className="flex-1 items-center">
                        <View
                          className="w-8 h-8 rounded-full items-center justify-center mb-1"
                          style={{ backgroundColor: STATUS_COLORS[status] + "20" }}
                        >
                          <Text
                            className="text-xs font-bold"
                            style={{ color: STATUS_COLORS[status] }}
                          >
                            {count}
                          </Text>
                        </View>
                        <Text className="text-[9px] text-muted text-center">
                          {t(targetStatusI18nKey(status))}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </Card.Body>
            </Card>
          )}

          {/* Exposure progress */}
          {filterProgressData.length > 0 && (
            <View className="mb-4">
              <ExposureProgress
                filters={filterProgressData}
                overallPercent={groupStats?.overallCompletion ?? 0}
              />
            </View>
          )}

          {groupTargets.length === 0 && (
            <EmptyState
              icon="telescope-outline"
              title={t("targets.groups.noTargetsInGroup")}
              description={t("targets.groups.addTargetsHint")}
            />
          )}
        </Tabs.Content>

        <Tabs.Content value="timeline" className="flex-1 px-4 pt-3">
          {groupFiles.length > 0 ? (
            <ObservationTimeline files={groupFiles} grouping={timelineGrouping} />
          ) : (
            <EmptyState icon="time-outline" title={t("targets.groups.noTargetsInGroup")} />
          )}
        </Tabs.Content>
      </Tabs>

      {/* Delete confirmation dialog */}
      <Dialog
        isOpen={showDeleteDialog}
        onOpenChange={(open) => {
          if (!open) setShowDeleteDialog(false);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content>
            <Dialog.Title>{t("targets.groups.deleteTitle")}</Dialog.Title>
            <Dialog.Description>
              {t("targets.groups.deleteConfirm", {
                name: group.name,
                count: group.targetIds.length,
              })}
            </Dialog.Description>
            <View className="mt-4 flex-row justify-end gap-2">
              <Button variant="outline" size="sm" onPress={() => setShowDeleteDialog(false)}>
                <Button.Label>{t("common.cancel")}</Button.Label>
              </Button>
              <Button variant="danger" size="sm" onPress={handleDeleteGroup}>
                <Button.Label>{t("common.delete")}</Button.Label>
              </Button>
            </View>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </View>
  );
}
