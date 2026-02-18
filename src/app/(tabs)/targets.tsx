import { useState, useMemo, useCallback } from "react";
import { View, Text, ScrollView, FlatList, Alert, useWindowDimensions } from "react-native";
import {
  BottomSheet,
  Button,
  Chip,
  Input,
  Separator,
  TextField,
  useThemeColor,
} from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "../../i18n/useI18n";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
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
import { EmptyState } from "../../components/common/EmptyState";
import type { SearchConditions } from "../../lib/targets/targetSearch";
import type { TargetType, TargetStatus } from "../../lib/fits/types";

type SortKey = "name" | "date" | "frames" | "exposure" | "favorite";

export default function TargetsScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { isLandscapeTablet, contentPaddingTop, horizontalPadding, sidePanelWidth } =
    useResponsiveLayout();
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [showDuplicateMerge, setShowDuplicateMerge] = useState(false);
  const [showGroupManager, setShowGroupManager] = useState(false);

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

  const {
    targets,
    groups,
    addTarget,
    addGroup,
    updateGroup,
    removeGroup,
    scanAndAutoDetect,
    getTargetStats,
    toggleFavorite,
    togglePinned,
    allTags,
    allCategories,
  } = useTargets();

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
    ra?: string;
    dec?: string;
    notes?: string;
    category?: string;
    tags?: string[];
    isFavorite?: boolean;
  }) => {
    const raNum = data.ra ? parseFloat(data.ra) : undefined;
    const decNum = data.dec ? parseFloat(data.dec) : undefined;
    addTarget(data.name, data.type, {
      ra: raNum && !isNaN(raNum) ? raNum : undefined,
      dec: decNum && !isNaN(decNum) ? decNum : undefined,
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
  const useCompactHeaderActions = !isLandscapeTablet && screenWidth < 430;

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

  const renderTargetItem = useCallback(
    ({ item: target }: { item: import("../../lib/fits/types").Target }) => {
      const stats = statsMap.get(target.id);
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
            onToggleFavorite={() => handleToggleFavorite(target.id)}
            onTogglePinned={() => handleTogglePinned(target.id)}
          />
        </View>
      );
    },
    [statsMap, router, handleToggleFavorite, handleTogglePinned],
  );

  const ListHeader = useMemo(
    () => (
      <View className="px-4">
        {useCompactHeaderActions ? (
          <View className="gap-2">
            <View>
              <Text className="text-2xl font-bold text-foreground">{t("targets.title")}</Text>
              <Text className="mt-1 text-sm text-muted">
                {t("targets.subtitle")} ({targets.length})
              </Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row items-center gap-1 pr-1">
                {targets.length > 0 && (
                  <Button size="sm" isIconOnly variant="outline" onPress={() => setShowStats(true)}>
                    <Ionicons name="stats-chart-outline" size={14} color={mutedColor} />
                  </Button>
                )}
                <Button
                  size="sm"
                  isIconOnly
                  variant="outline"
                  onPress={() => setShowAdvancedSearch(true)}
                >
                  <Ionicons name="options-outline" size={14} color={mutedColor} />
                </Button>
                <Button
                  size="sm"
                  isIconOnly
                  variant="outline"
                  onPress={() => {
                    detect();
                    setShowDuplicateMerge(true);
                  }}
                >
                  <Ionicons name="copy-outline" size={14} color={mutedColor} />
                </Button>
                <Button
                  size="sm"
                  isIconOnly
                  variant="outline"
                  onPress={() => setShowGroupManager(true)}
                >
                  <Ionicons name="folder-open-outline" size={14} color={mutedColor} />
                </Button>
                <Button
                  size="sm"
                  isIconOnly
                  variant="outline"
                  onPress={() => {
                    const result = scanAndAutoDetect();
                    Alert.alert(
                      t("common.success"),
                      result.newCount > 0
                        ? `${t("targets.scanNow")}: ${result.newCount} ${t("targets.title")}`
                        : t("targets.noResults"),
                    );
                  }}
                >
                  <Ionicons name="scan-outline" size={14} color={mutedColor} />
                </Button>
                <Button
                  size="sm"
                  isIconOnly
                  variant="primary"
                  onPress={() => setShowAddSheet(true)}
                >
                  <Ionicons name="add" size={14} color="#fff" />
                </Button>
              </View>
            </ScrollView>
          </View>
        ) : (
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-2">
              <Text className="text-2xl font-bold text-foreground">{t("targets.title")}</Text>
              <Text className="mt-1 text-sm text-muted">
                {t("targets.subtitle")} ({targets.length})
              </Text>
            </View>
            <View className="flex-row gap-1">
              {targets.length > 0 && (
                <Button size="sm" isIconOnly variant="outline" onPress={() => setShowStats(true)}>
                  <Ionicons name="stats-chart-outline" size={14} color={mutedColor} />
                </Button>
              )}
              <Button
                size="sm"
                isIconOnly
                variant="outline"
                onPress={() => setShowAdvancedSearch(true)}
              >
                <Ionicons name="options-outline" size={14} color={mutedColor} />
              </Button>
              <Button
                size="sm"
                isIconOnly
                variant="outline"
                onPress={() => {
                  detect();
                  setShowDuplicateMerge(true);
                }}
              >
                <Ionicons name="copy-outline" size={14} color={mutedColor} />
              </Button>
              <Button
                size="sm"
                isIconOnly
                variant="outline"
                onPress={() => setShowGroupManager(true)}
              >
                <Ionicons name="folder-open-outline" size={14} color={mutedColor} />
              </Button>
              <Button
                size="sm"
                isIconOnly
                variant="outline"
                onPress={() => {
                  const result = scanAndAutoDetect();
                  Alert.alert(
                    t("common.success"),
                    result.newCount > 0
                      ? `${t("targets.scanNow")}: ${result.newCount} ${t("targets.title")}`
                      : t("targets.noResults"),
                  );
                }}
              >
                <Ionicons name="scan-outline" size={14} color={mutedColor} />
              </Button>
              <Button size="sm" isIconOnly variant="primary" onPress={() => setShowAddSheet(true)}>
                <Ionicons name="add" size={14} color="#fff" />
              </Button>
            </View>
          </View>
        )}

        {targets.length > 0 && (
          <View className="mt-3 flex-row gap-2">
            {(["planned", "acquiring", "completed", "processed"] as const).map((status) => {
              const count = targets.filter((target) => target.status === status).length;
              if (count === 0) return null;
              const colors = {
                planned: "#6b7280",
                acquiring: "#f59e0b",
                completed: "#22c55e",
                processed: "#3b82f6",
              };
              return (
                <View key={status} className="flex-row items-center gap-1">
                  <View
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: colors[status] }}
                  />
                  <Text className="text-[10px] text-muted">
                    {count}{" "}
                    {t(
                      `targets.${status}` as
                        | "targets.planned"
                        | "targets.acquiring"
                        | "targets.completed"
                        | "targets.processed",
                    )}
                  </Text>
                </View>
              );
            })}
            {targets.filter((target) => target.isFavorite).length > 0 && (
              <View className="flex-row items-center gap-1">
                <Ionicons name="star" size={10} color="#f59e0b" />
                <Text className="text-[10px] text-muted">
                  {targets.filter((target) => target.isFavorite).length} {t("targets.favorites")}
                </Text>
              </View>
            )}
          </View>
        )}

        <Separator className="my-4" />

        <View className="mb-3">
          <TextField>
            <View className="w-full flex-row items-center">
              <Input
                className="flex-1 pl-9 pr-9"
                placeholder={t("targets.searchPlaceholder")}
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

        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
          <View className="flex-row gap-1.5">
            <Chip
              size="sm"
              variant={filterFavorite ? "primary" : "secondary"}
              onPress={() => setFilterFavorite(!filterFavorite)}
            >
              <Ionicons name="star" size={10} color={filterFavorite ? "#fff" : mutedColor} />
              <Chip.Label className="text-[9px] ml-0.5">{t("targets.favorites")}</Chip.Label>
            </Chip>

            <View className="w-px bg-separator mx-1" />

            {(["galaxy", "nebula", "cluster", "planet", "other"] as TargetType[]).map((type) => (
              <Chip
                key={type}
                size="sm"
                variant={filterType === type ? "primary" : "secondary"}
                onPress={() => setFilterType(filterType === type ? null : type)}
              >
                <Chip.Label className="text-[9px]">
                  {t(
                    `targets.types.${type}` as
                      | "targets.types.galaxy"
                      | "targets.types.nebula"
                      | "targets.types.cluster"
                      | "targets.types.planet"
                      | "targets.types.other",
                  )}
                </Chip.Label>
              </Chip>
            ))}

            <View className="w-px bg-separator mx-1" />

            {(["planned", "acquiring", "completed", "processed"] as TargetStatus[]).map(
              (status) => (
                <Chip
                  key={status}
                  size="sm"
                  variant={filterStatus === status ? "primary" : "secondary"}
                  onPress={() => setFilterStatus(filterStatus === status ? null : status)}
                >
                  <Chip.Label className="text-[9px]">
                    {t(
                      `targets.${status}` as
                        | "targets.planned"
                        | "targets.acquiring"
                        | "targets.completed"
                        | "targets.processed",
                    )}
                  </Chip.Label>
                </Chip>
              ),
            )}

            {groups.length > 0 && (
              <>
                <View className="w-px bg-separator mx-1" />
                {groups.slice(0, 3).map((group) => (
                  <Chip
                    key={group.id}
                    size="sm"
                    variant={filterGroupId === group.id ? "primary" : "secondary"}
                    onPress={() => setFilterGroupId(filterGroupId === group.id ? null : group.id)}
                  >
                    <Chip.Label className="text-[9px]">{group.name}</Chip.Label>
                  </Chip>
                ))}
              </>
            )}

            {allCategories.length > 0 && (
              <>
                <View className="w-px bg-separator mx-1" />
                {allCategories.slice(0, 3).map((category) => (
                  <Chip
                    key={category}
                    size="sm"
                    variant={filterCategory === category ? "primary" : "secondary"}
                    onPress={() => setFilterCategory(filterCategory === category ? null : category)}
                  >
                    <Chip.Label className="text-[9px]">{category}</Chip.Label>
                  </Chip>
                ))}
              </>
            )}

            {allTags.length > 0 && (
              <>
                <View className="w-px bg-separator mx-1" />
                {allTags.slice(0, 3).map((tag) => (
                  <Chip
                    key={tag}
                    size="sm"
                    variant={filterTag === tag ? "primary" : "secondary"}
                    onPress={() => setFilterTag(filterTag === tag ? null : tag)}
                  >
                    <Chip.Label className="text-[9px]">{tag}</Chip.Label>
                  </Chip>
                ))}
              </>
            )}
          </View>
        </ScrollView>

        <View className="mb-3 flex-row items-center justify-between">
          <View className="flex-row items-center gap-1.5">
            {hasActiveFilters && (
              <Button size="sm" variant="ghost" onPress={clearFilters}>
                <Ionicons name="close-circle-outline" size={12} color={mutedColor} />
                <Button.Label className="text-[10px] text-muted">
                  {t("targets.clearFilters")}
                </Button.Label>
              </Button>
            )}
            {isAdvancedMode && Object.keys(advancedConditions).length > 0 && (
              <Chip size="sm" variant="secondary">
                <Chip.Label className="text-[9px]">{t("targets.search.title")}</Chip.Label>
              </Chip>
            )}
          </View>
          <View className="flex-row items-center gap-1.5">
            <Ionicons name="swap-vertical-outline" size={12} color={mutedColor} />
            {(["date", "name", "frames", "exposure", "favorite"] as SortKey[]).map((sortKey) => (
              <Chip
                key={sortKey}
                size="sm"
                variant={targetSortBy === sortKey ? "primary" : "secondary"}
                onPress={() => setTargetSortBy(sortKey)}
              >
                <Chip.Label className="text-[9px]">
                  {t(
                    `targets.sort.${sortKey}` as
                      | "targets.sort.date"
                      | "targets.sort.name"
                      | "targets.sort.frames"
                      | "targets.sort.exposure"
                      | "targets.sort.favorite",
                  )}
                </Chip.Label>
              </Chip>
            ))}
            <Button
              size="sm"
              variant="outline"
              onPress={() => setTargetSortOrder(targetSortOrder === "asc" ? "desc" : "asc")}
            >
              <Ionicons
                name={targetSortOrder === "asc" ? "arrow-up-outline" : "arrow-down-outline"}
                size={12}
                color={mutedColor}
              />
            </Button>
          </View>
        </View>

        {filteredTargets.length === 0 && targets.length === 0 && (
          <EmptyState
            icon="telescope-outline"
            title={t("targets.noTargets")}
            description={t("targets.autoDetected")}
            actionLabel={files.length > 0 ? t("targets.scanNow") : undefined}
            onAction={files.length > 0 ? scanAndAutoDetect : undefined}
          />
        )}
        {targets.length > 0 && filteredTargets.length === 0 && (
          <EmptyState icon="search-outline" title={t("targets.noResults")} />
        )}
      </View>
    ),
    [
      t,
      targets,
      mutedColor,
      searchQuery,
      setSearchQuery,
      filterType,
      filterStatus,
      filterFavorite,
      filterCategory,
      filterTag,
      filterGroupId,
      groups,
      targetSortBy,
      targetSortOrder,
      filteredTargets,
      files,
      scanAndAutoDetect,
      allCategories,
      allTags,
      hasActiveFilters,
      isAdvancedMode,
      advancedConditions,
      useCompactHeaderActions,
      detect,
      clearFilters,
      setTargetSortBy,
      setTargetSortOrder,
    ],
  );

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: contentPaddingTop }}>
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
