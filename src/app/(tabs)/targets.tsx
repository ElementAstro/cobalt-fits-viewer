import { useState, useMemo, useCallback } from "react";
import { View, FlatList, Alert, useWindowDimensions } from "react-native";
import { BottomSheet } from "heroui-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "../../i18n/useI18n";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import { useSelectionMode } from "../../hooks/useSelectionMode";
import { useTargets } from "../../hooks/useTargets";
import { useTargetStatistics } from "../../hooks/useTargetStatistics";
import { useTargetSearch, useDuplicateDetection } from "../../hooks/useTargetSearch";
import { useFitsStore } from "../../stores/useFitsStore";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { TargetCard } from "../../components/targets/TargetCard";
import { AddTargetSheet } from "../../components/targets/AddTargetSheet";
import { StatisticsDashboard } from "../../components/targets/StatisticsDashboard";
import { AdvancedSearchSheet } from "../../components/targets/AdvancedSearchSheet";
import { DuplicateMergeSheet } from "../../components/targets/DuplicateMergeSheet";
import { GroupManagerSheet } from "../../components/targets/GroupManagerSheet";
import { TargetListHeader, TargetSearchBar } from "../../components/targets/TargetListHeader";
import { GuideTarget } from "../../components/common/GuideTarget";
import { TargetBatchActionBar } from "../../components/targets/TargetBatchActionBar";
import type { SearchConditions } from "../../lib/targets/targetSearch";
import type { TargetType, TargetStatus } from "../../lib/fits/types";
import { resolveTargetInteractionUi } from "../../lib/targets/targetInteractionUi";

export default function TargetsScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { width: screenWidth, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { isLandscapeTablet, contentPaddingTop, horizontalPadding, sidePanelWidth } =
    useResponsiveLayout();
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [showDuplicateMerge, setShowDuplicateMerge] = useState(false);
  const [showGroupManager, setShowGroupManager] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  const [filterType, setFilterType] = useState<TargetType | null>(null);
  const [filterStatus, setFilterStatus] = useState<TargetStatus | null>(null);
  const [filterFavorite, setFilterFavorite] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [filterGroupId, setFilterGroupId] = useState<string | null>(null);

  const targetSortBy = useSettingsStore((s) => s.targetSortBy);
  const targetSortOrder = useSettingsStore((s) => s.targetSortOrder);
  const setTargetSortBy = useSettingsStore((s) => s.setTargetSortBy);
  const setTargetSortOrder = useSettingsStore((s) => s.setTargetSortOrder);
  const targetActionControlMode = useSettingsStore((s) => s.targetActionControlMode);
  const targetActionSizePreset = useSettingsStore((s) => s.targetActionSizePreset);
  const targetActionAutoScaleFromFont = useSettingsStore((s) => s.targetActionAutoScaleFromFont);

  const {
    targets,
    groups,
    addTarget,
    addGroup,
    updateGroup,
    removeGroup,
    removeTarget,
    scanAndAutoDetect,
    getTargetStats,
    toggleFavorite,
    togglePinned,
    allTags,
    allCategories,
  } = useTargets();

  const { isSelectionMode, selectedIds, toggleSelection, exitSelectionMode, selectAll } =
    useSelectionMode();

  const search = useTargetSearch();
  const {
    query: searchQuery,
    setQuery: setSearchQuery,
    conditions: advancedConditions,
    setConditions: setAdvancedConditions,
    isAdvancedMode,
    setIsAdvancedMode,
    results: searchResults,
    clearAllConditions,
  } = search;

  const duplicateDetection = useDuplicateDetection();
  const { detectionResult, isDetecting, detect, mergeDuplicates, clearDetection } =
    duplicateDetection;

  const files = useFitsStore((s) => s.files);
  const { statistics, monthlyStats } = useTargetStatistics();

  const statsMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getTargetStats>>();
    for (const target of targets) {
      map.set(target.id, getTargetStats(target.id));
    }
    return map;
  }, [targets, getTargetStats]);

  const filteredTargets = useMemo(() => {
    const selectedGroup = filterGroupId ? groups.find((group) => group.id === filterGroupId) : null;
    const selectedGroupTargets = selectedGroup ? new Set(selectedGroup.targetIds) : null;

    const filtered = searchResults.filter((target) => {
      if (filterType && target.type !== filterType) return false;
      if (filterStatus && target.status !== filterStatus) return false;
      if (filterFavorite && !target.isFavorite) return false;
      if (filterCategory && target.category !== filterCategory) return false;
      if (filterTag && !target.tags.includes(filterTag)) return false;
      if (filterGroupId) {
        const inGroup = Boolean(selectedGroupTargets?.has(target.id));
        if (!inGroup) return false;
      }
      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;

      let cmp = 0;
      switch (targetSortBy) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "date":
          cmp = a.createdAt - b.createdAt;
          break;
        case "frames":
          cmp = a.imageIds.length - b.imageIds.length;
          break;
        case "exposure": {
          const aExp = statsMap.get(a.id)?.exposureStats.totalExposure ?? 0;
          const bExp = statsMap.get(b.id)?.exposureStats.totalExposure ?? 0;
          cmp = aExp - bExp;
          break;
        }
        case "favorite":
          cmp = Number(a.isFavorite) - Number(b.isFavorite);
          if (cmp === 0) {
            cmp = a.createdAt - b.createdAt;
          }
          break;
      }

      return targetSortOrder === "asc" ? cmp : -cmp;
    });

    return sorted;
  }, [
    searchResults,
    filterGroupId,
    groups,
    filterType,
    filterStatus,
    filterFavorite,
    filterCategory,
    filterTag,
    targetSortBy,
    targetSortOrder,
    statsMap,
  ]);

  const handleAddTarget = (data: {
    name: string;
    type: TargetType;
    ra?: number;
    dec?: number;
    notes?: string;
    category?: string;
    tags?: string[];
    isFavorite?: boolean;
  }) => {
    addTarget(data.name, data.type, {
      ra: data.ra,
      dec: data.dec,
      notes: data.notes,
      category: data.category,
      tags: data.tags,
      isFavorite: data.isFavorite,
    });
    setShowAddSheet(false);
  };

  const handleToggleFavorite = useCallback(
    (targetId: string) => {
      toggleFavorite(targetId);
    },
    [toggleFavorite],
  );

  const handleTogglePinned = useCallback(
    (targetId: string) => {
      togglePinned(targetId);
    },
    [togglePinned],
  );

  const handleBatchDelete = useCallback(() => {
    for (const id of selectedIds) {
      removeTarget(id);
    }
    exitSelectionMode();
  }, [selectedIds, removeTarget, exitSelectionMode]);

  const handleBatchFavorite = useCallback(() => {
    for (const id of selectedIds) {
      toggleFavorite(id);
    }
    exitSelectionMode();
  }, [selectedIds, toggleFavorite, exitSelectionMode]);

  const handleSelectAll = useCallback(() => {
    selectAll(filteredTargets.map((t) => t.id));
  }, [selectAll, filteredTargets]);

  const clearFilters = useCallback(() => {
    setFilterType(null);
    setFilterStatus(null);
    setFilterFavorite(false);
    setFilterCategory(null);
    setFilterTag(null);
    setFilterGroupId(null);
    clearAllConditions();
    setIsAdvancedMode(false);
  }, [clearAllConditions, setIsAdvancedMode]);

  const hasActiveFilters =
    Boolean(filterType) ||
    Boolean(filterStatus) ||
    filterFavorite ||
    Boolean(filterCategory) ||
    Boolean(filterTag) ||
    Boolean(filterGroupId) ||
    Boolean(searchQuery.trim()) ||
    (isAdvancedMode && Object.keys(advancedConditions).length > 0);
  const resolvedInteractionUi = useMemo(
    () =>
      resolveTargetInteractionUi({
        preset: targetActionSizePreset,
        autoScaleFromFont: targetActionAutoScaleFromFont,
        fontScale,
      }),
    [targetActionSizePreset, targetActionAutoScaleFromFont, fontScale],
  );
  const useCompactHeaderActions = !isLandscapeTablet && screenWidth < 430;
  const useCompactFilterLayout = !isLandscapeTablet && screenWidth < 430;

  const handleAdvancedSearch = useCallback(
    (conditions: SearchConditions) => {
      setAdvancedConditions(conditions);
      setIsAdvancedMode(true);
      if (conditions.query) {
        setSearchQuery(conditions.query);
      }
    },
    [setAdvancedConditions, setIsAdvancedMode, setSearchQuery],
  );

  const buildScanSummaryMessage = useCallback(
    (result: {
      scannedCount: number;
      newCount: number;
      updatedCount: number;
      skippedCount: number;
    }) =>
      [
        `${t("targets.scanSummaryScanned")}: ${result.scannedCount}`,
        `${t("targets.scanSummaryAdded")}: ${result.newCount}`,
        `${t("targets.scanSummaryUpdated")}: ${result.updatedCount}`,
        `${t("targets.scanSummarySkipped")}: ${result.skippedCount}`,
      ].join("\n"),
    [t],
  );

  const handleScanTargets = useCallback(() => {
    setIsScanning(true);
    try {
      const result = scanAndAutoDetect();
      Alert.alert(
        t("targets.scanSummaryTitle"),
        buildScanSummaryMessage({
          scannedCount: result.scannedCount,
          newCount: result.newCount,
          updatedCount: result.updatedCount,
          skippedCount: result.skippedCount,
        }),
      );
    } finally {
      setIsScanning(false);
    }
  }, [buildScanSummaryMessage, scanAndAutoDetect, t]);

  const renderTargetItem = useCallback(
    ({ item: target }: { item: import("../../lib/fits/types").Target }) => {
      const stats = statsMap.get(target.id);
      const totalExposureMin = stats ? Math.round(stats.exposureStats.totalExposure / 60) : 0;
      const completion = stats?.completion.overall;
      const isSelected = selectedIds.includes(target.id);

      return (
        <View
          className={`px-4 mb-3 ${isSelected ? "opacity-80" : ""}`}
          style={isSelected ? { backgroundColor: "rgba(59,130,246,0.08)" } : undefined}
        >
          <TargetCard
            target={target}
            frameCount={target.imageIds.length}
            totalExposureMinutes={totalExposureMin}
            completionPercent={completion}
            onPress={
              isSelectionMode
                ? () => toggleSelection(target.id)
                : () => router.push(`/target/${target.id}`)
            }
            onLongPress={() => toggleSelection(target.id)}
            onToggleFavorite={() => handleToggleFavorite(target.id)}
            onTogglePinned={() => handleTogglePinned(target.id)}
            actionControlMode={targetActionControlMode}
            interactionUi={resolvedInteractionUi}
          />
        </View>
      );
    },
    [
      statsMap,
      router,
      handleToggleFavorite,
      handleTogglePinned,
      targetActionControlMode,
      resolvedInteractionUi,
      isSelectionMode,
      selectedIds,
      toggleSelection,
    ],
  );

  const handleShowDuplicateMerge = useCallback(() => {
    detect();
    setShowDuplicateMerge(true);
  }, [detect]);

  const handleShowStats = useCallback(() => setShowStats(true), []);
  const handleShowAdvancedSearch = useCallback(() => setShowAdvancedSearch(true), []);
  const handleShowGroupManager = useCallback(() => setShowGroupManager(true), []);
  const handleShowAddSheet = useCallback(() => setShowAddSheet(true), []);

  const ListHeader = useMemo(
    () => (
      <TargetListHeader
        targets={targets}
        filteredTargets={filteredTargets}
        groups={groups}
        filesCount={files.length}
        filterType={filterType}
        filterStatus={filterStatus}
        filterFavorite={filterFavorite}
        filterCategory={filterCategory}
        filterTag={filterTag}
        filterGroupId={filterGroupId}
        onFilterTypeChange={setFilterType}
        onFilterStatusChange={setFilterStatus}
        onFilterFavoriteChange={setFilterFavorite}
        onFilterCategoryChange={setFilterCategory}
        onFilterTagChange={setFilterTag}
        onFilterGroupIdChange={setFilterGroupId}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
        isAdvancedMode={isAdvancedMode}
        advancedConditions={advancedConditions}
        allCategories={allCategories}
        allTags={allTags}
        sortBy={targetSortBy}
        sortOrder={targetSortOrder}
        onSortByChange={setTargetSortBy}
        onSortOrderChange={setTargetSortOrder}
        onShowStats={handleShowStats}
        onShowAdvancedSearch={handleShowAdvancedSearch}
        onShowDuplicateMerge={handleShowDuplicateMerge}
        onShowGroupManager={handleShowGroupManager}
        onScanTargets={handleScanTargets}
        onShowAddSheet={handleShowAddSheet}
        useCompactHeaderActions={useCompactHeaderActions}
        useCompactFilterLayout={useCompactFilterLayout}
        interactionUi={resolvedInteractionUi}
      />
    ),
    [
      targets,
      filteredTargets,
      groups,
      files.length,
      filterType,
      filterStatus,
      filterFavorite,
      filterCategory,
      filterTag,
      filterGroupId,
      hasActiveFilters,
      clearFilters,
      isAdvancedMode,
      advancedConditions,
      allCategories,
      allTags,
      targetSortBy,
      targetSortOrder,
      setTargetSortBy,
      setTargetSortOrder,
      handleShowStats,
      handleShowAdvancedSearch,
      handleShowDuplicateMerge,
      handleShowGroupManager,
      handleScanTargets,
      handleShowAddSheet,
      useCompactHeaderActions,
      useCompactFilterLayout,
      resolvedInteractionUi,
    ],
  );

  return (
    <View
      testID="e2e-screen-tabs__targets"
      className="flex-1 bg-background"
      style={{ paddingTop: contentPaddingTop }}
    >
      {isSelectionMode ? (
        <TargetBatchActionBar
          selectedCount={selectedIds.length}
          totalCount={filteredTargets.length}
          onSelectAll={handleSelectAll}
          onDeselectAll={exitSelectionMode}
          onBatchDelete={handleBatchDelete}
          onBatchFavorite={handleBatchFavorite}
          onExitSelectionMode={exitSelectionMode}
        />
      ) : (
        <GuideTarget name="targets-scan" page="targets" order={1}>
          <TargetSearchBar
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            interactionUi={resolvedInteractionUi}
          />
        </GuideTarget>
      )}
      {isLandscapeTablet ? (
        <View className="flex-1 flex-row">
          <View style={{ width: sidePanelWidth, paddingHorizontal: horizontalPadding }}>
            <StatisticsDashboard statistics={statistics} monthlyStats={monthlyStats} />
          </View>
          <View className="flex-1">
            <FlatList
              data={filteredTargets}
              keyExtractor={(item) => item.id}
              renderItem={renderTargetItem}
              ListHeaderComponent={ListHeader}
              contentContainerStyle={{ paddingBottom: 4 }}
              removeClippedSubviews
              windowSize={7}
              maxToRenderPerBatch={10}
              initialNumToRender={10}
              refreshing={isScanning}
              onRefresh={handleScanTargets}
            />
          </View>
        </View>
      ) : (
        <FlatList
          data={filteredTargets}
          keyExtractor={(item) => item.id}
          renderItem={renderTargetItem}
          ListHeaderComponent={ListHeader}
          contentContainerClassName="pb-4"
          removeClippedSubviews
          windowSize={7}
          maxToRenderPerBatch={10}
          initialNumToRender={10}
          refreshing={isScanning}
          onRefresh={handleScanTargets}
        />
      )}

      <AddTargetSheet
        visible={showAddSheet}
        allCategories={allCategories}
        allTags={allTags}
        onClose={() => setShowAddSheet(false)}
        onConfirm={handleAddTarget}
      />

      <AdvancedSearchSheet
        visible={showAdvancedSearch}
        initialConditions={advancedConditions}
        allCategories={allCategories}
        allTags={allTags}
        onClose={() => setShowAdvancedSearch(false)}
        onSearch={handleAdvancedSearch}
      />

      <DuplicateMergeSheet
        visible={showDuplicateMerge}
        detectionResult={detectionResult}
        isDetecting={isDetecting}
        onClose={() => {
          setShowDuplicateMerge(false);
          clearDetection();
        }}
        onDetect={detect}
        onMergeGroup={mergeDuplicates}
        getTargetStats={getTargetStats}
      />

      <GroupManagerSheet
        visible={showGroupManager}
        groups={groups}
        selectedGroupId={filterGroupId ?? undefined}
        onClose={() => setShowGroupManager(false)}
        onSelectGroup={(groupId) => setFilterGroupId(groupId ?? null)}
        onCreateGroup={(name, description, color) =>
          addGroup({ name, description, color, targetIds: [] })
        }
        onUpdateGroup={updateGroup}
        onDeleteGroup={removeGroup}
      />

      {!isLandscapeTablet && (
        <BottomSheet
          isOpen={showStats}
          onOpenChange={(open) => {
            if (!open) setShowStats(false);
          }}
        >
          <BottomSheet.Portal>
            <BottomSheet.Overlay />
            <BottomSheet.Content style={{ paddingBottom: insets.bottom + 8 }}>
              <View className="mb-3 flex-row items-center justify-between px-4">
                <BottomSheet.Title>{t("targets.statistics.title")}</BottomSheet.Title>
                <BottomSheet.Close />
              </View>
              <StatisticsDashboard statistics={statistics} monthlyStats={monthlyStats} />
            </BottomSheet.Content>
          </BottomSheet.Portal>
        </BottomSheet>
      )}
    </View>
  );
}
