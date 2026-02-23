/**
 * 目标列表头部组件
 * 从 targets.tsx 拆分，包含标题、操作按钮、搜索栏、筛选条、排序条
 */

import React from "react";
import { View, Text, ScrollView } from "react-native";
import { Button, Chip, Input, Separator, TextField, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";
import { EmptyState } from "../common/EmptyState";
import { GuideTarget } from "../common/GuideTarget";
import { STATUS_COLORS, TARGET_STATUSES } from "../../lib/targets/targetConstants";
import type { TargetType, TargetStatus, TargetGroup, Target } from "../../lib/fits/types";
import type { SearchConditions } from "../../lib/targets/targetSearch";
import type { ResolvedTargetInteractionUi } from "../../lib/targets/targetInteractionUi";

type SortKey = "name" | "date" | "frames" | "exposure" | "favorite";

interface TargetListHeaderProps {
  targets: Target[];
  filteredTargets: Target[];
  groups: TargetGroup[];
  filesCount: number;

  // Filters
  filterType: TargetType | null;
  filterStatus: TargetStatus | null;
  filterFavorite: boolean;
  filterCategory: string | null;
  filterTag: string | null;
  filterGroupId: string | null;
  onFilterTypeChange: (type: TargetType | null) => void;
  onFilterStatusChange: (status: TargetStatus | null) => void;
  onFilterFavoriteChange: (favorite: boolean) => void;
  onFilterCategoryChange: (category: string | null) => void;
  onFilterTagChange: (tag: string | null) => void;
  onFilterGroupIdChange: (groupId: string | null) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  isAdvancedMode: boolean;
  advancedConditions: SearchConditions;
  allCategories: string[];
  allTags: string[];

  // Sort
  sortBy: SortKey;
  sortOrder: "asc" | "desc";
  onSortByChange: (key: SortKey) => void;
  onSortOrderChange: (order: "asc" | "desc") => void;

  // Actions
  onShowStats: () => void;
  onShowAdvancedSearch: () => void;
  onShowDuplicateMerge: () => void;
  onShowGroupManager: () => void;
  onScanTargets: () => void;
  onShowAddSheet: () => void;

  // Layout
  useCompactHeaderActions: boolean;
  useCompactFilterLayout: boolean;
  interactionUi: ResolvedTargetInteractionUi;
}

interface HeaderAction {
  testID?: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  variant?: "outline" | "primary";
  iconColor?: string;
  showWhen?: boolean;
}

const TargetHeaderActions = React.memo(function TargetHeaderActions({
  actions,
  compact,
  gapClassName,
  buttonSize,
  iconSize,
  title,
  subtitle,
}: {
  actions: HeaderAction[];
  compact: boolean;
  gapClassName: string;
  buttonSize: ResolvedTargetInteractionUi["buttonSize"];
  iconSize: number;
  title: string;
  subtitle: string;
}) {
  const mutedColor = useThemeColor("muted");

  const buttons = actions
    .filter((a) => a.showWhen !== false)
    .map((action) => (
      <Button
        key={action.icon}
        testID={action.testID}
        size={buttonSize}
        isIconOnly
        variant={action.variant ?? "outline"}
        onPress={action.onPress}
      >
        <Ionicons name={action.icon} size={iconSize} color={action.iconColor ?? mutedColor} />
      </Button>
    ));

  if (compact) {
    return (
      <View className="gap-2">
        <View>
          <Text className="text-2xl font-bold text-foreground">{title}</Text>
          <Text className="mt-1 text-sm text-muted">{subtitle}</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className={`flex-row items-center pr-1 ${gapClassName}`}>{buttons}</View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View className="flex-row items-center justify-between">
      <View className="flex-1 pr-2">
        <Text className="text-2xl font-bold text-foreground">{title}</Text>
        <Text className="mt-1 text-sm text-muted">{subtitle}</Text>
      </View>
      <View className={`flex-row ${gapClassName}`}>{buttons}</View>
    </View>
  );
});

const TargetStatusSummary = React.memo(function TargetStatusSummary({
  targets,
  miniIconSize,
  summaryTextClassName,
}: {
  targets: Target[];
  miniIconSize: number;
  summaryTextClassName: string;
}) {
  const { t } = useI18n();

  if (targets.length === 0) return null;

  const favoriteCount = targets.filter((target) => target.isFavorite).length;

  return (
    <View className="mt-3 flex-row gap-2">
      {TARGET_STATUSES.map((status) => {
        const count = targets.filter((target) => target.status === status).length;
        if (count === 0) return null;
        return (
          <View key={status} className="flex-row items-center gap-1">
            <View
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: STATUS_COLORS[status] }}
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
      {favoriteCount > 0 && (
        <View className="flex-row items-center gap-1">
          <Ionicons name="star" size={miniIconSize} color="#f59e0b" />
          <Text className={summaryTextClassName}>
            {favoriteCount} {t("targets.favorites")}
          </Text>
        </View>
      )}
    </View>
  );
});

const TargetFilterChips = React.memo(function TargetFilterChips({
  filterType,
  filterStatus,
  filterFavorite,
  filterCategory,
  filterTag,
  filterGroupId,
  onFilterTypeChange,
  onFilterStatusChange,
  onFilterFavoriteChange,
  onFilterCategoryChange,
  onFilterTagChange,
  onFilterGroupIdChange,
  groups,
  allCategories,
  allTags,
  chipSize,
  chipLabelClassName,
  miniIconSize,
  useCompactLayout,
}: {
  filterType: TargetType | null;
  filterStatus: TargetStatus | null;
  filterFavorite: boolean;
  filterCategory: string | null;
  filterTag: string | null;
  filterGroupId: string | null;
  onFilterTypeChange: (type: TargetType | null) => void;
  onFilterStatusChange: (status: TargetStatus | null) => void;
  onFilterFavoriteChange: (favorite: boolean) => void;
  onFilterCategoryChange: (category: string | null) => void;
  onFilterTagChange: (tag: string | null) => void;
  onFilterGroupIdChange: (groupId: string | null) => void;
  groups: TargetGroup[];
  allCategories: string[];
  allTags: string[];
  chipSize: ResolvedTargetInteractionUi["chipSize"];
  chipLabelClassName: string;
  miniIconSize: number;
  useCompactLayout: boolean;
}) {
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
      <View className={`flex-row items-center pr-1 ${useCompactLayout ? "gap-1.5" : "gap-2"}`}>
        <Chip
          size={chipSize}
          variant={filterFavorite ? "primary" : "secondary"}
          onPress={() => onFilterFavoriteChange(!filterFavorite)}
        >
          <Ionicons name="star" size={miniIconSize} color={filterFavorite ? "#fff" : mutedColor} />
          <Chip.Label className={`${chipLabelClassName} ml-0.5`}>
            {t("targets.favorites")}
          </Chip.Label>
        </Chip>

        <View className="w-px bg-separator mx-1" />

        {(["galaxy", "nebula", "cluster", "planet", "other"] as TargetType[]).map((type) => (
          <Chip
            key={type}
            size={chipSize}
            variant={filterType === type ? "primary" : "secondary"}
            onPress={() => onFilterTypeChange(filterType === type ? null : type)}
          >
            <Chip.Label className={chipLabelClassName}>
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

        {TARGET_STATUSES.map((status) => (
          <Chip
            key={status}
            size={chipSize}
            variant={filterStatus === status ? "primary" : "secondary"}
            onPress={() => onFilterStatusChange(filterStatus === status ? null : status)}
          >
            <Chip.Label className={chipLabelClassName}>
              {t(
                `targets.${status}` as
                  | "targets.planned"
                  | "targets.acquiring"
                  | "targets.completed"
                  | "targets.processed",
              )}
            </Chip.Label>
          </Chip>
        ))}

        {groups.length > 0 && (
          <>
            <View className="w-px bg-separator mx-1" />
            {groups.slice(0, 3).map((group) => (
              <Chip
                key={group.id}
                size={chipSize}
                variant={filterGroupId === group.id ? "primary" : "secondary"}
                onPress={() => onFilterGroupIdChange(filterGroupId === group.id ? null : group.id)}
              >
                <Chip.Label className={chipLabelClassName}>{group.name}</Chip.Label>
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
                size={chipSize}
                variant={filterCategory === category ? "primary" : "secondary"}
                onPress={() =>
                  onFilterCategoryChange(filterCategory === category ? null : category)
                }
              >
                <Chip.Label className={chipLabelClassName}>{category}</Chip.Label>
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
                size={chipSize}
                variant={filterTag === tag ? "primary" : "secondary"}
                onPress={() => onFilterTagChange(filterTag === tag ? null : tag)}
              >
                <Chip.Label className={chipLabelClassName}>{tag}</Chip.Label>
              </Chip>
            ))}
          </>
        )}
      </View>
    </ScrollView>
  );
});

const TargetSortBar = React.memo(function TargetSortBar({
  sortBy,
  sortOrder,
  onSortByChange,
  onSortOrderChange,
  hasActiveFilters,
  onClearFilters,
  isAdvancedMode,
  advancedConditions,
  chipSize,
  chipLabelClassName,
  miniIconSize,
  tinyActionLabelClassName,
}: {
  sortBy: SortKey;
  sortOrder: "asc" | "desc";
  onSortByChange: (key: SortKey) => void;
  onSortOrderChange: (order: "asc" | "desc") => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  isAdvancedMode: boolean;
  advancedConditions: SearchConditions;
  chipSize: ResolvedTargetInteractionUi["chipSize"];
  chipLabelClassName: string;
  miniIconSize: number;
  tinyActionLabelClassName: string;
}) {
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");

  return (
    <View className="mb-3 gap-2">
      <View className="flex-row flex-wrap items-center gap-1.5">
        {hasActiveFilters && (
          <Button size={chipSize} variant="ghost" onPress={onClearFilters}>
            <Ionicons name="close-circle-outline" size={miniIconSize} color={mutedColor} />
            <Button.Label className={tinyActionLabelClassName}>
              {t("targets.clearFilters")}
            </Button.Label>
          </Button>
        )}
        {isAdvancedMode && Object.keys(advancedConditions).length > 0 && (
          <Chip size={chipSize} variant="secondary">
            <Chip.Label className={chipLabelClassName}>{t("targets.search.title")}</Chip.Label>
          </Chip>
        )}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row items-center gap-1.5 pr-1">
          <Ionicons name="swap-vertical-outline" size={miniIconSize} color={mutedColor} />
          {(["date", "name", "frames", "exposure", "favorite"] as SortKey[]).map((sortKey) => (
            <Chip
              key={sortKey}
              size={chipSize}
              variant={sortBy === sortKey ? "primary" : "secondary"}
              onPress={() => onSortByChange(sortKey)}
            >
              <Chip.Label className={chipLabelClassName}>
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
            isIconOnly
            size={chipSize}
            variant="outline"
            onPress={() => onSortOrderChange(sortOrder === "asc" ? "desc" : "asc")}
          >
            <Ionicons
              name={sortOrder === "asc" ? "arrow-up-outline" : "arrow-down-outline"}
              size={miniIconSize}
              color={mutedColor}
            />
          </Button>
        </View>
      </ScrollView>
    </View>
  );
});

export const TargetSearchBar = React.memo(function TargetSearchBar({
  searchQuery,
  onSearchQueryChange,
  interactionUi,
}: {
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  interactionUi: ResolvedTargetInteractionUi;
}) {
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");
  const { buttonSize, compactIconSize } = interactionUi;

  return (
    <View className="px-4 pb-3 bg-background">
      <TextField>
        <View className="w-full flex-row items-center">
          <Input
            className="flex-1 pl-9 pr-9"
            placeholder={t("targets.searchPlaceholder")}
            value={searchQuery}
            onChangeText={onSearchQueryChange}
            autoCorrect={false}
          />
          <Ionicons
            name="search-outline"
            size={compactIconSize}
            color={mutedColor}
            style={{ position: "absolute", left: 12 }}
          />
          {searchQuery.length > 0 && (
            <Button
              size={buttonSize}
              variant="ghost"
              isIconOnly
              onPress={() => onSearchQueryChange("")}
              style={{ position: "absolute", right: 12 }}
            >
              <Ionicons name="close-circle" size={compactIconSize} color={mutedColor} />
            </Button>
          )}
        </View>
      </TextField>
    </View>
  );
});

export const TargetListHeader = React.memo(function TargetListHeader(props: TargetListHeaderProps) {
  const { t } = useI18n();

  const {
    targets,
    filteredTargets,
    filesCount,
    useCompactHeaderActions,
    useCompactFilterLayout,
    interactionUi,
    // actions
    onShowStats,
    onShowAdvancedSearch,
    onShowDuplicateMerge,
    onShowGroupManager,
    onScanTargets,
    onShowAddSheet,
  } = props;

  const {
    buttonSize: headerActionButtonSize,
    iconSize: actionIconSize,
    miniIconSize,
    chipSize,
  } = interactionUi;

  const chipLabelClassName =
    interactionUi.effectivePreset === "accessible"
      ? "text-xs"
      : interactionUi.effectivePreset === "standard"
        ? "text-[11px]"
        : useCompactFilterLayout
          ? "text-[10px]"
          : "text-[11px]";
  const summaryTextClassName =
    interactionUi.effectivePreset === "accessible"
      ? "text-xs text-muted"
      : interactionUi.effectivePreset === "standard"
        ? "text-[11px] text-muted"
        : "text-[10px] text-muted";
  const tinyActionLabelClassName =
    interactionUi.effectivePreset === "accessible"
      ? "text-xs text-muted"
      : "text-[10px] text-muted";

  const headerActionGapClassName =
    interactionUi.effectivePreset === "accessible" ? "gap-2" : "gap-1";

  const headerActions: HeaderAction[] = [
    {
      testID: "e2e-action-tabs__targets-open-stats",
      icon: "stats-chart-outline",
      onPress: onShowStats,
      showWhen: targets.length > 0,
    },
    { icon: "options-outline", onPress: onShowAdvancedSearch },
    { icon: "copy-outline", onPress: onShowDuplicateMerge },
    { icon: "folder-open-outline", onPress: onShowGroupManager },
    {
      testID: "e2e-action-tabs__targets-scan",
      icon: "scan-outline",
      onPress: onScanTargets,
    },
    {
      testID: "e2e-action-tabs__targets-open-add",
      icon: "add",
      onPress: onShowAddSheet,
      variant: "primary",
      iconColor: "#fff",
    },
  ];

  return (
    <View className="px-4">
      <GuideTarget name="targets-add" page="targets" order={0}>
        <TargetHeaderActions
          actions={headerActions}
          compact={useCompactHeaderActions}
          gapClassName={headerActionGapClassName}
          buttonSize={headerActionButtonSize}
          iconSize={actionIconSize}
          title={t("targets.title")}
          subtitle={`${t("targets.subtitle")} (${targets.length})`}
        />
      </GuideTarget>

      <TargetStatusSummary
        targets={targets}
        miniIconSize={miniIconSize}
        summaryTextClassName={summaryTextClassName}
      />

      <Separator className="my-4" />

      <TargetFilterChips
        filterType={props.filterType}
        filterStatus={props.filterStatus}
        filterFavorite={props.filterFavorite}
        filterCategory={props.filterCategory}
        filterTag={props.filterTag}
        filterGroupId={props.filterGroupId}
        onFilterTypeChange={props.onFilterTypeChange}
        onFilterStatusChange={props.onFilterStatusChange}
        onFilterFavoriteChange={props.onFilterFavoriteChange}
        onFilterCategoryChange={props.onFilterCategoryChange}
        onFilterTagChange={props.onFilterTagChange}
        onFilterGroupIdChange={props.onFilterGroupIdChange}
        groups={props.groups}
        allCategories={props.allCategories}
        allTags={props.allTags}
        chipSize={chipSize}
        chipLabelClassName={chipLabelClassName}
        miniIconSize={miniIconSize}
        useCompactLayout={useCompactFilterLayout}
      />

      <TargetSortBar
        sortBy={props.sortBy}
        sortOrder={props.sortOrder}
        onSortByChange={props.onSortByChange}
        onSortOrderChange={props.onSortOrderChange}
        hasActiveFilters={props.hasActiveFilters}
        onClearFilters={props.onClearFilters}
        isAdvancedMode={props.isAdvancedMode}
        advancedConditions={props.advancedConditions}
        chipSize={chipSize}
        chipLabelClassName={chipLabelClassName}
        miniIconSize={miniIconSize}
        tinyActionLabelClassName={tinyActionLabelClassName}
      />

      {/* Empty states */}
      {filteredTargets.length === 0 && targets.length === 0 && (
        <EmptyState
          icon="telescope-outline"
          title={t("targets.noTargets")}
          description={t("targets.autoDetected")}
          actionLabel={filesCount > 0 ? t("targets.scanNow") : undefined}
          onAction={filesCount > 0 ? onScanTargets : undefined}
        />
      )}
      {targets.length > 0 && filteredTargets.length === 0 && (
        <EmptyState icon="search-outline" title={t("targets.noResults")} />
      )}
    </View>
  );
});
