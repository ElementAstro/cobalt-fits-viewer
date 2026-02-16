import { useState, useMemo, useCallback } from "react";
import { View, Text, ScrollView, FlatList, Alert } from "react-native";
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
import { useI18n } from "../../i18n/useI18n";
import { useScreenOrientation } from "../../hooks/useScreenOrientation";
import { useTargets } from "../../hooks/useTargets";
import { useTargetStatistics } from "../../hooks/useTargetStatistics";
import { useFitsStore } from "../../stores/useFitsStore";
import { TargetCard } from "../../components/targets/TargetCard";
import { AddTargetSheet } from "../../components/targets/AddTargetSheet";
import { StatisticsDashboard } from "../../components/targets/StatisticsDashboard";
import { EmptyState } from "../../components/common/EmptyState";
import type { TargetType, TargetStatus } from "../../lib/fits/types";

type SortKey = "name" | "date" | "frames" | "exposure" | "favorite";

export default function TargetsScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");
  const { isLandscape } = useScreenOrientation();
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<TargetType | null>(null);
  const [filterStatus, setFilterStatus] = useState<TargetStatus | null>(null);
  const [filterFavorite, setFilterFavorite] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("date");

  const {
    targets,
    addTarget,
    scanAndAutoDetect,
    getTargetStats,
    formatExposureTime: _formatExposureTime,
    toggleFavorite,
    togglePinned,
    allTags,
    allCategories,
  } = useTargets();

  const files = useFitsStore((s) => s.files);
  const { statistics, monthlyStats } = useTargetStatistics();

  const statsMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getTargetStats>>();
    for (const t of targets) {
      map.set(t.id, getTargetStats(t.id));
    }
    return map;
  }, [targets, getTargetStats]);

  const filteredTargets = useMemo(() => {
    const result = [...targets];

    // Filter pinned targets to the top
    const pinned = result.filter((t) => t.isPinned);
    const unpinned = result.filter((t) => !t.isPinned);

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const filterFn = (t: (typeof targets)[0]) =>
        t.name.toLowerCase().includes(q) ||
        t.aliases.some((a) => a.toLowerCase().includes(q)) ||
        t.notes?.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q));
      return [...pinned.filter(filterFn), ...unpinned.filter(filterFn)];
    }

    // Type filter
    if (filterType) {
      const filterFn = (t: (typeof targets)[0]) => t.type === filterType;
      return [...pinned.filter(filterFn), ...unpinned.filter(filterFn)];
    }

    // Status filter
    if (filterStatus) {
      const filterFn = (t: (typeof targets)[0]) => t.status === filterStatus;
      return [...pinned.filter(filterFn), ...unpinned.filter(filterFn)];
    }

    // Favorite filter
    if (filterFavorite) {
      const filterFn = (t: (typeof targets)[0]) => t.isFavorite;
      return [...pinned.filter(filterFn), ...unpinned.filter(filterFn)];
    }

    // Category filter
    if (filterCategory) {
      const filterFn = (t: (typeof targets)[0]) => t.category === filterCategory;
      return [...pinned.filter(filterFn), ...unpinned.filter(filterFn)];
    }

    // Tag filter
    if (filterTag) {
      const filterFn = (t: (typeof targets)[0]) => t.tags.includes(filterTag);
      return [...pinned.filter(filterFn), ...unpinned.filter(filterFn)];
    }

    // Sort
    const sortFn = (a: (typeof targets)[0], b: (typeof targets)[0]) => {
      // Pinned always first
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;

      switch (sortKey) {
        case "name":
          return a.name.localeCompare(b.name);
        case "date":
          return b.createdAt - a.createdAt;
        case "frames":
          return b.imageIds.length - a.imageIds.length;
        case "exposure": {
          const aExp = statsMap.get(a.id)?.exposureStats.totalExposure ?? 0;
          const bExp = statsMap.get(b.id)?.exposureStats.totalExposure ?? 0;
          return bExp - aExp;
        }
        case "favorite":
          if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
          return b.createdAt - a.createdAt;
        default:
          return 0;
      }
    };

    result.sort(sortFn);
    return result;
  }, [
    targets,
    searchQuery,
    filterType,
    filterStatus,
    filterFavorite,
    filterCategory,
    filterTag,
    sortKey,
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

  const clearFilters = () => {
    setFilterType(null);
    setFilterStatus(null);
    setFilterFavorite(false);
    setFilterCategory(null);
    setFilterTag(null);
  };

  const hasActiveFilters =
    filterType || filterStatus || filterFavorite || filterCategory || filterTag;

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
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-bold text-foreground">{t("targets.title")}</Text>
            <Text className="mt-1 text-sm text-muted">
              {t("targets.subtitle")} ({targets.length})
            </Text>
          </View>
          <View className="flex-row gap-1">
            {targets.length > 0 && (
              <Button size="sm" variant="outline" onPress={() => setShowStats(true)}>
                <Ionicons name="stats-chart-outline" size={14} color={mutedColor} />
              </Button>
            )}
            <Button
              size="sm"
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
            <Button size="sm" variant="primary" onPress={() => setShowAddSheet(true)}>
              <Ionicons name="add" size={14} color="#fff" />
            </Button>
          </View>
        </View>

        {/* Stats Summary */}
        {targets.length > 0 && (
          <View className="mt-3 flex-row gap-2">
            {(["planned", "acquiring", "completed", "processed"] as const).map((s) => {
              const count = targets.filter((t) => t.status === s).length;
              if (count === 0) return null;
              const colors = {
                planned: "#6b7280",
                acquiring: "#f59e0b",
                completed: "#22c55e",
                processed: "#3b82f6",
              };
              return (
                <View key={s} className="flex-row items-center gap-1">
                  <View className="h-2 w-2 rounded-full" style={{ backgroundColor: colors[s] }} />
                  <Text className="text-[10px] text-muted">
                    {count}{" "}
                    {t(
                      `targets.${s}` as
                        | "targets.planned"
                        | "targets.acquiring"
                        | "targets.completed"
                        | "targets.processed",
                    )}
                  </Text>
                </View>
              );
            })}
            {/* Favorites count */}
            {targets.filter((t) => t.isFavorite).length > 0 && (
              <View className="flex-row items-center gap-1">
                <Ionicons name="star" size={10} color="#f59e0b" />
                <Text className="text-[10px] text-muted">
                  {targets.filter((t) => t.isFavorite).length} {t("targets.favorites")}
                </Text>
              </View>
            )}
          </View>
        )}

        <Separator className="my-4" />

        {/* Search */}
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

        {/* Filter Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
          <View className="flex-row gap-1.5">
            {/* Favorite filter */}
            <Chip
              size="sm"
              variant={filterFavorite ? "primary" : "secondary"}
              onPress={() => setFilterFavorite(!filterFavorite)}
            >
              <Ionicons name="star" size={10} color={filterFavorite ? "#fff" : mutedColor} />
              <Chip.Label className="text-[9px] ml-0.5">{t("targets.favorites")}</Chip.Label>
            </Chip>

            <View className="w-px bg-separator mx-1" />

            {/* Type filters */}
            {(["galaxy", "nebula", "cluster", "planet", "other"] as TargetType[]).map((tt) => (
              <Chip
                key={tt}
                size="sm"
                variant={filterType === tt ? "primary" : "secondary"}
                onPress={() => setFilterType(filterType === tt ? null : tt)}
              >
                <Chip.Label className="text-[9px]">
                  {t(
                    `targets.types.${tt}` as
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

            {/* Status filters */}
            {(["planned", "acquiring", "completed", "processed"] as TargetStatus[]).map((s) => (
              <Chip
                key={s}
                size="sm"
                variant={filterStatus === s ? "primary" : "secondary"}
                onPress={() => setFilterStatus(filterStatus === s ? null : s)}
              >
                <Chip.Label className="text-[9px]">
                  {t(
                    `targets.${s}` as
                      | "targets.planned"
                      | "targets.acquiring"
                      | "targets.completed"
                      | "targets.processed",
                  )}
                </Chip.Label>
              </Chip>
            ))}

            {/* Category filters */}
            {allCategories.length > 0 && (
              <>
                <View className="w-px bg-separator mx-1" />
                {allCategories.slice(0, 3).map((cat) => (
                  <Chip
                    key={cat}
                    size="sm"
                    variant={filterCategory === cat ? "primary" : "secondary"}
                    onPress={() => setFilterCategory(filterCategory === cat ? null : cat)}
                  >
                    <Chip.Label className="text-[9px]">{cat}</Chip.Label>
                  </Chip>
                ))}
              </>
            )}

            {/* Tag filters */}
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

        {/* Clear filters & Sort */}
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
          </View>
          <View className="flex-row items-center gap-1.5">
            <Ionicons name="swap-vertical-outline" size={12} color={mutedColor} />
            {(["date", "name", "frames", "exposure", "favorite"] as SortKey[]).map((sk) => (
              <Chip
                key={sk}
                size="sm"
                variant={sortKey === sk ? "primary" : "secondary"}
                onPress={() => setSortKey(sk)}
              >
                <Chip.Label className="text-[9px]">
                  {t(
                    `targets.sort.${sk}` as
                      | "targets.sort.date"
                      | "targets.sort.name"
                      | "targets.sort.frames"
                      | "targets.sort.exposure"
                      | "targets.sort.favorite",
                  )}
                </Chip.Label>
              </Chip>
            ))}
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
      filterType,
      filterStatus,
      filterFavorite,
      filterCategory,
      filterTag,
      sortKey,
      filteredTargets,
      files,
      scanAndAutoDetect,
      allCategories,
      allTags,
      hasActiveFilters,
    ],
  );

  return (
    <View className={`flex-1 bg-background ${isLandscape ? "pt-2" : "pt-14"}`}>
      <FlatList
        data={filteredTargets}
        keyExtractor={(item) => item.id}
        renderItem={renderTargetItem}
        ListHeaderComponent={ListHeader}
        contentContainerClassName="pb-4"
      />
      <AddTargetSheet
        visible={showAddSheet}
        allCategories={allCategories}
        allTags={allTags}
        onClose={() => setShowAddSheet(false)}
        onConfirm={handleAddTarget}
      />
      <BottomSheet
        isOpen={showStats}
        onOpenChange={(open) => {
          if (!open) setShowStats(false);
        }}
      >
        <BottomSheet.Portal>
          <BottomSheet.Overlay />
          <BottomSheet.Content>
            <View className="mb-3 flex-row items-center justify-between px-4">
              <BottomSheet.Title>{t("targets.statistics.title")}</BottomSheet.Title>
              <BottomSheet.Close />
            </View>
            <StatisticsDashboard statistics={statistics} monthlyStats={monthlyStats} />
          </BottomSheet.Content>
        </BottomSheet.Portal>
      </BottomSheet>
    </View>
  );
}
