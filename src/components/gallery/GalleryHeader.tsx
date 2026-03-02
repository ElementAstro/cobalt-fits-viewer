import { memo } from "react";
import { View, Text, ScrollView } from "react-native";
import { Button, Chip, ScrollShadow, Separator, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useI18n } from "../../i18n/useI18n";
import { SearchBar } from "../common/SearchBar";
import type { GalleryViewMode } from "../../lib/fits/types";
import type { MetadataIndexResult } from "../../lib/gallery/metadataIndex";
import { GalleryFilterChips, type FrameTypeEntry } from "./GalleryFilterChips";
import { GallerySelectionToolbar } from "./GallerySelectionToolbar";

const VIEW_MODES: { key: GalleryViewMode; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "grid", icon: "grid-outline" },
  { key: "list", icon: "list-outline" },
  { key: "timeline", icon: "time-outline" },
];

interface GalleryHeaderProps {
  totalCount: number;
  displayCount: number;
  viewMode: GalleryViewMode;
  searchQuery: string;
  filterObject: string;
  filterFrameType: string;
  filterTargetId: string;
  filterFavoriteOnly: boolean;
  activeFilterCount: number;
  metadataIndex: MetadataIndexResult;
  frameTypes: FrameTypeEntry[];
  isLandscape: boolean;
  isSelectionMode: boolean;
  selectedCount: number;
  selectedImageCount: number;
  allDisplaySelected: boolean;
  onViewModeChange: (mode: GalleryViewMode) => void;
  onSearchChange: (query: string) => void;
  onFilterObjectChange: (value: string) => void;
  onFilterFrameTypeChange: (value: string) => void;
  onFilterTargetIdChange: (value: string) => void;
  onFilterFavoriteOnlyChange: (value: boolean) => void;
  onClearFilters: () => void;
  onSelectAllToggle: () => void;
  onAddToAlbum: () => void;
  onBatchTag: () => void;
  onBatchRename: () => void;
  onCompare: () => void;
  onBatchDelete: () => void;
  onExitSelection: () => void;
  onOpenReport: () => void;
  onOpenMap: () => void;
}

export const GalleryHeader = memo(function GalleryHeader({
  totalCount,
  displayCount,
  viewMode,
  searchQuery,
  filterObject,
  filterFrameType,
  filterTargetId,
  filterFavoriteOnly,
  activeFilterCount,
  metadataIndex,
  frameTypes,
  isLandscape,
  isSelectionMode,
  selectedCount,
  selectedImageCount,
  allDisplaySelected,
  onViewModeChange,
  onSearchChange,
  onFilterObjectChange,
  onFilterFrameTypeChange,
  onFilterTargetIdChange,
  onFilterFavoriteOnlyChange,
  onClearFilters,
  onSelectAllToggle,
  onAddToAlbum,
  onBatchTag,
  onBatchRename,
  onCompare,
  onBatchDelete,
  onExitSelection,
  onOpenReport,
  onOpenMap,
}: GalleryHeaderProps) {
  const { t } = useI18n();
  const [successColor, mutedColor] = useThemeColor(["success", "muted"]);

  return (
    <View className={isLandscape ? "gap-1.5" : "gap-3"}>
      {/* Title + View Modes */}
      <View className="flex-row items-center justify-between">
        <View className={isLandscape ? "flex-row items-baseline gap-2" : ""}>
          <Text
            className={
              isLandscape
                ? "text-lg font-bold text-foreground"
                : "text-2xl font-bold text-foreground"
            }
          >
            {t("gallery.title")}
          </Text>
          <Text className={isLandscape ? "text-xs text-muted" : "mt-1 text-sm text-muted"}>
            {isLandscape ? `(${totalCount})` : `${t("gallery.subtitle")} (${totalCount})`}
          </Text>
        </View>
        <View className="flex-row gap-1">
          {VIEW_MODES.map((mode) => (
            <Button
              key={mode.key}
              size="sm"
              isIconOnly
              variant={viewMode === mode.key ? "secondary" : "ghost"}
              className={viewMode === mode.key ? "bg-success/20" : ""}
              onPress={() => onViewModeChange(mode.key)}
            >
              <Ionicons
                name={mode.icon}
                size={16}
                color={viewMode === mode.key ? successColor : mutedColor}
              />
            </Button>
          ))}
          <Button
            testID="e2e-action-tabs__gallery-open-map"
            size="sm"
            isIconOnly
            variant="ghost"
            onPress={onOpenMap}
          >
            <Ionicons name="map-outline" size={16} color={mutedColor} />
          </Button>
        </View>
      </View>

      {/* Search + Filters */}
      {isLandscape ? (
        <View className="flex-row items-center gap-2">
          <SearchBar
            value={searchQuery}
            onChangeText={onSearchChange}
            placeholder={t("gallery.searchPlaceholder") ?? t("files.searchPlaceholder")}
            compact
          />
          <GalleryFilterChips
            filterObject={filterObject}
            filterFrameType={filterFrameType}
            filterFavoriteOnly={filterFavoriteOnly}
            objects={metadataIndex.objects}
            frameTypes={frameTypes}
            compact
            onFilterObjectChange={onFilterObjectChange}
            onFilterFrameTypeChange={onFilterFrameTypeChange}
            onFilterFavoriteOnlyChange={onFilterFavoriteOnlyChange}
          />
        </View>
      ) : (
        <>
          <SearchBar
            value={searchQuery}
            onChangeText={onSearchChange}
            placeholder={t("gallery.searchPlaceholder") ?? t("files.searchPlaceholder")}
          />

          <Separator />

          <GalleryFilterChips
            filterObject={filterObject}
            filterFrameType={filterFrameType}
            filterFavoriteOnly={filterFavoriteOnly}
            objects={metadataIndex.objects}
            frameTypes={frameTypes}
            onFilterObjectChange={onFilterObjectChange}
            onFilterFrameTypeChange={onFilterFrameTypeChange}
            onFilterFavoriteOnlyChange={onFilterFavoriteOnlyChange}
          />

          {/* Target Filter */}
          {filterTargetId && (
            <View className="mt-2">
              <ScrollShadow LinearGradientComponent={LinearGradient}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View className="flex-row gap-1.5">
                    <Chip size="sm" variant="primary" onPress={() => onFilterTargetIdChange("")}>
                      <Ionicons name="telescope-outline" size={10} color="#fff" />
                      <Chip.Label className="text-[10px]">{t("targets.title")}</Chip.Label>
                      <Ionicons name="close" size={8} color="#fff" />
                    </Chip>
                  </View>
                </ScrollView>
              </ScrollShadow>
            </View>
          )}
        </>
      )}

      {/* Selection Toolbar */}
      {isSelectionMode && (
        <GallerySelectionToolbar
          selectedCount={selectedCount}
          selectedImageCount={selectedImageCount}
          allDisplaySelected={allDisplaySelected}
          isLandscape={isLandscape}
          onSelectAllToggle={onSelectAllToggle}
          onAddToAlbum={onAddToAlbum}
          onBatchTag={onBatchTag}
          onBatchRename={onBatchRename}
          onCompare={onCompare}
          onBatchDelete={onBatchDelete}
          onExitSelection={onExitSelection}
        />
      )}

      {/* Images Title + Report Button */}
      <View className="flex-row items-center justify-between">
        <Text
          className={
            isLandscape
              ? "text-sm font-semibold text-foreground"
              : "text-base font-semibold text-foreground"
          }
        >
          {filterObject || t("gallery.allImages")} ({displayCount})
        </Text>
        <View className="flex-row items-center gap-1">
          {activeFilterCount > 0 && (
            <Button size="sm" variant="ghost" onPress={onClearFilters}>
              <Ionicons name="funnel-outline" size={14} color={mutedColor} />
              {!isLandscape && (
                <Button.Label className="text-[10px]">
                  {t("targets.clearFilters")} ({activeFilterCount})
                </Button.Label>
              )}
            </Button>
          )}
          <Button size="sm" variant="outline" onPress={onOpenReport}>
            <Ionicons name="stats-chart-outline" size={14} color={successColor} />
          </Button>
        </View>
      </View>
    </View>
  );
});
