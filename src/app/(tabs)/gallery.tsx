import { View, Text, ScrollView, Alert, FlatList } from "react-native";
import { useState, useMemo, useCallback } from "react";
import * as Haptics from "expo-haptics";
import { useSelectionMode } from "../../hooks/useSelectionMode";
import { useHapticFeedback } from "../../hooks/useHapticFeedback";
import { Button, Chip, Input, Separator, TextField, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useI18n } from "../../i18n/useI18n";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import { useGallery } from "../../hooks/useGallery";
import { useAlbums } from "../../hooks/useAlbums";
import { useFileManager } from "../../hooks/useFileManager";
import { useGalleryStore } from "../../stores/useGalleryStore";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { ThumbnailGrid } from "../../components/gallery/ThumbnailGrid";
import { AlbumCard } from "../../components/gallery/AlbumCard";
import { CreateAlbumModal } from "../../components/gallery/CreateAlbumModal";
import { AlbumActionSheet } from "../../components/gallery/AlbumActionSheet";
import { AlbumPickerSheet } from "../../components/gallery/AlbumPickerSheet";
import { BatchTagSheet } from "../../components/gallery/BatchTagSheet";
import { BatchRenameSheet } from "../../components/gallery/BatchRenameSheet";
import { IntegrationReportSheet } from "../../components/gallery/IntegrationReportSheet";
import { SmartAlbumModal } from "../../components/gallery/SmartAlbumModal";
import { AlbumSearchBar } from "../../components/gallery/AlbumSearchBar";
import { AlbumSortControl } from "../../components/gallery/AlbumSortControl";
import { AlbumStatisticsSheet } from "../../components/gallery/AlbumStatisticsSheet";
import { AlbumMergeSheet } from "../../components/gallery/AlbumMergeSheet";
import { AlbumExportSheet } from "../../components/gallery/AlbumExportSheet";
import { DuplicateImagesSheet } from "../../components/gallery/DuplicateImagesSheet";
import { EmptyState } from "../../components/common/EmptyState";
import { PromptDialog } from "../../components/common/PromptDialog";
import { getFrameTypeDefinitions } from "../../lib/gallery/frameClassifier";
import type { GalleryViewMode, FitsMetadata, Album } from "../../lib/fits/types";
import type { AlbumSortBy } from "../../stores/useAlbumStore";

const VIEW_MODES: { key: GalleryViewMode; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "grid", icon: "grid-outline" },
  { key: "list", icon: "list-outline" },
  { key: "timeline", icon: "time-outline" },
];

type TimelineSection = { date: string; files: FitsMetadata[] };

const FRAME_TYPE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  light: "sunny-outline",
  dark: "moon-outline",
  flat: "square-outline",
  bias: "pulse-outline",
  darkflat: "layers-outline",
  unknown: "help-outline",
};

function getFrameTypeIcon(type: string): keyof typeof Ionicons.glyphMap {
  return FRAME_TYPE_ICONS[type] ?? "pricetag-outline";
}

export default function GalleryScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const haptics = useHapticFeedback();

  const [successColor, mutedColor] = useThemeColor(["success", "muted"]);

  const { isLandscape, isLandscapeTablet, contentPaddingTop, horizontalPadding } =
    useResponsiveLayout();
  const { files, totalCount, viewMode, gridColumns, metadataIndex, groupedByDate, search } =
    useGallery();
  const effectiveColumns = isLandscapeTablet
    ? Math.min(gridColumns + 3, 7)
    : isLandscape
      ? Math.min(gridColumns + 2, 6)
      : gridColumns;

  const {
    albums,
    filteredAlbums,
    createAlbum: createNewAlbum,
    createSmartAlbum,
    removeAlbum,
    updateAlbum,
    addImagesToAlbum,
    getSuggestions,
    albumSearchQuery,
    albumSortBy,
    albumSortOrder,
    setAlbumSearchQuery,
    setAlbumSortBy,
    setAlbumSortOrder,
    toggleAlbumPin,
    mergeAlbums,
    updateAlbumNotes,
    getAlbumStatistics,
    duplicateImages,
  } = useAlbums();
  const { handleDeleteFiles, handleRenameFiles } = useFileManager();
  const setViewMode = useGalleryStore((s) => s.setViewMode);
  const setFilterObject = useGalleryStore((s) => s.setFilterObject);
  const filterObject = useGalleryStore((s) => s.filterObject);
  const setFilterFrameType = useGalleryStore((s) => s.setFilterFrameType);
  const filterFrameType = useGalleryStore((s) => s.filterFrameType);
  const setFilterTargetId = useGalleryStore((s) => s.setFilterTargetId);
  const filterTargetId = useGalleryStore((s) => s.filterTargetId);
  const setFilterFavoriteOnly = useGalleryStore((s) => s.setFilterFavoriteOnly);
  const filterFavoriteOnly = useGalleryStore((s) => s.filterFavoriteOnly);
  const clearFilters = useGalleryStore((s) => s.clearFilters);

  const thumbShowFilename = useSettingsStore((s) => s.thumbnailShowFilename);
  const thumbShowObject = useSettingsStore((s) => s.thumbnailShowObject);
  const thumbShowFilter = useSettingsStore((s) => s.thumbnailShowFilter);
  const thumbShowExposure = useSettingsStore((s) => s.thumbnailShowExposure);
  const frameClassificationConfig = useSettingsStore((s) => s.frameClassificationConfig);

  const frameTypeDefinitions = useMemo(
    () => getFrameTypeDefinitions(frameClassificationConfig),
    [frameClassificationConfig],
  );

  const frameTypeLabels = useMemo(() => {
    const labels = new Map<string, string>();
    for (const definition of frameTypeDefinitions) {
      labels.set(
        definition.key,
        definition.builtin
          ? (t(`gallery.frameTypes.${definition.key}`) ?? definition.label)
          : definition.label || definition.key,
      );
    }
    return labels;
  }, [frameTypeDefinitions, t]);

  const FRAME_TYPES = useMemo(() => {
    const orderMap = new Map(
      frameTypeDefinitions.map((definition, index) => [definition.key, index]),
    );
    const keys = new Set<string>(frameTypeDefinitions.map((definition) => definition.key));
    for (const value of metadataIndex.frameTypes) {
      keys.add(value);
    }

    return [...keys]
      .map((key) => ({
        key,
        label: frameTypeLabels.get(key) ?? key,
        icon: getFrameTypeIcon(key),
      }))
      .sort((a, b) => {
        const ao = orderMap.get(a.key);
        const bo = orderMap.get(b.key);
        if (ao !== undefined && bo !== undefined) return ao - bo;
        if (ao !== undefined) return -1;
        if (bo !== undefined) return 1;
        return a.label.localeCompare(b.label);
      });
  }, [frameTypeDefinitions, frameTypeLabels, metadataIndex.frameTypes]);

  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateAlbum, setShowCreateAlbum] = useState(false);
  const [actionAlbum, setActionAlbum] = useState<Album | null>(null);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const {
    isSelectionMode,
    selectedIds,
    toggleSelection,
    enterSelectionMode,
    exitSelectionMode,
    selectAll,
  } = useSelectionMode();
  const [showAlbumPicker, setShowAlbumPicker] = useState(false);
  const [showSmartAlbum, setShowSmartAlbum] = useState(false);
  const [showRenamePrompt, setShowRenamePrompt] = useState(false);
  const [showBatchTag, setShowBatchTag] = useState(false);
  const [showBatchRename, setShowBatchRename] = useState(false);
  const [showReport, setShowReport] = useState(false);

  // NEW: Album sheet states
  const [showAlbumStats, setShowAlbumStats] = useState(false);
  const [showAlbumMerge, setShowAlbumMerge] = useState(false);
  const [showAlbumExport, setShowAlbumExport] = useState(false);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [showEditNotes, setShowEditNotes] = useState(false);

  const displayFiles = searchQuery ? search(searchQuery) : files;
  const activeFilterCount =
    Number(Boolean(filterObject)) +
    Number(Boolean(filterFrameType)) +
    Number(Boolean(filterTargetId)) +
    Number(filterFavoriteOnly);
  const allDisplaySelected =
    displayFiles.length > 0 && displayFiles.every((file) => selectedIds.includes(file.id));

  const timelineSections = useMemo<TimelineSection[]>(() => {
    if (viewMode !== "timeline") return [];
    return Object.entries(groupedByDate)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, dateFiles]) => ({ date, files: dateFiles }));
  }, [viewMode, groupedByDate]);

  const handleCreateAlbum = (name: string, description?: string) => {
    createNewAlbum(name, description);
    setShowCreateAlbum(false);
  };

  const handleFilePress = useCallback(
    (file: FitsMetadata) => {
      if (isSelectionMode) {
        toggleSelection(file.id);
      } else {
        const route =
          file.mediaKind === "video" || file.sourceType === "video"
            ? `/video/${file.id}`
            : `/viewer/${file.id}`;
        router.push(route);
      }
    },
    [isSelectionMode, toggleSelection, router],
  );

  const handleFileLongPress = useCallback(
    (file: FitsMetadata) => {
      if (!isSelectionMode) {
        haptics.impact();
        enterSelectionMode(file.id);
      }
    },
    [isSelectionMode, enterSelectionMode, haptics],
  );

  const handleAddToAlbum = (albumId: string) => {
    addImagesToAlbum(albumId, selectedIds);
    exitSelectionMode();
  };

  const handleBatchDelete = useCallback(() => {
    if (selectedIds.length === 0) return;
    Alert.alert(t("files.batchDelete"), `${t("files.deleteConfirm")} (${selectedIds.length})`, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: () => {
          haptics.notify(Haptics.NotificationFeedbackType.Warning);
          handleDeleteFiles(selectedIds);
          exitSelectionMode();
        },
      },
    ]);
  }, [selectedIds, t, handleDeleteFiles, exitSelectionMode, haptics]);

  const handleBatchRenameApply = useCallback(
    (operations: Array<{ fileId: string; filename: string }>) => {
      const result = handleRenameFiles(operations);
      if (result.success > 0) {
        exitSelectionMode();
      }
      return result;
    },
    [exitSelectionMode, handleRenameFiles],
  );

  const handleAlbumRename = () => {
    if (!actionAlbum) return;
    setSelectedAlbum(actionAlbum);
    setShowRenamePrompt(true);
  };

  const handleAlbumEditNotes = () => {
    if (!actionAlbum) return;
    setSelectedAlbum(actionAlbum);
    setShowEditNotes(true);
  };

  const handleAlbumViewStats = () => {
    if (!actionAlbum) return;
    setSelectedAlbum(actionAlbum);
    setShowAlbumStats(true);
  };

  const handleAlbumExport = () => {
    if (!actionAlbum) return;
    setSelectedAlbum(actionAlbum);
    setShowAlbumExport(true);
  };

  const handleAlbumMerge = () => {
    if (!actionAlbum) return;
    setSelectedAlbum(actionAlbum);
    setShowAlbumMerge(true);
  };

  const handleAlbumDelete = () => {
    if (!actionAlbum) return;
    const album = actionAlbum;
    Alert.alert(t("album.deleteAlbum"), t("album.deleteConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: () => removeAlbum(album.id),
      },
    ]);
  };

  const handleSelectAllToggle = useCallback(() => {
    if (displayFiles.length === 0) return;
    if (allDisplaySelected) {
      selectAll([]);
      return;
    }
    selectAll(displayFiles.map((file) => file.id));
  }, [allDisplaySelected, displayFiles, selectAll]);

  const GalleryHeader = useMemo(
    () => (
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
                onPress={() => setViewMode(mode.key)}
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
              onPress={() => router.push("/map")}
            >
              <Ionicons name="map-outline" size={16} color={mutedColor} />
            </Button>
          </View>
        </View>

        {/* Search + Filters: side-by-side in landscape */}
        {isLandscape ? (
          <View className="flex-row items-center gap-2">
            <TextField>
              <View className="flex-row items-center" style={{ width: 200 }}>
                <Input
                  className="flex-1 pl-9 pr-9"
                  placeholder={t("gallery.searchPlaceholder") ?? t("files.searchPlaceholder")}
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
                    style={{ position: "absolute", right: 4 }}
                  >
                    <Ionicons name="close-circle" size={14} color={mutedColor} />
                  </Button>
                )}
              </View>
            </TextField>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-1">
              <View className="flex-row gap-1">
                {metadataIndex.objects.length > 0 && (
                  <>
                    <Chip
                      size="sm"
                      variant={!filterObject ? "primary" : "secondary"}
                      onPress={() => setFilterObject("")}
                    >
                      <Chip.Label className="text-[9px]">{t("gallery.allImages")}</Chip.Label>
                    </Chip>
                    {metadataIndex.objects.map((obj) => (
                      <Chip
                        key={obj}
                        size="sm"
                        variant={filterObject === obj ? "primary" : "secondary"}
                        onPress={() => setFilterObject(obj)}
                      >
                        <Chip.Label className="text-[9px]">{obj}</Chip.Label>
                      </Chip>
                    ))}
                    <View className="w-px bg-separator mx-1" />
                  </>
                )}
                <Chip
                  size="sm"
                  variant={!filterFrameType ? "primary" : "secondary"}
                  onPress={() => setFilterFrameType("")}
                >
                  <Chip.Label className="text-[9px]">{t("gallery.allTypes")}</Chip.Label>
                </Chip>
                {FRAME_TYPES.map((ft) => (
                  <Chip
                    key={ft.key}
                    size="sm"
                    variant={filterFrameType === ft.key ? "primary" : "secondary"}
                    onPress={() => setFilterFrameType(ft.key)}
                  >
                    <Ionicons
                      name={ft.icon}
                      size={10}
                      color={filterFrameType === ft.key ? successColor : mutedColor}
                    />
                    <Chip.Label className="text-[9px]">{ft.label}</Chip.Label>
                  </Chip>
                ))}
                <Chip
                  size="sm"
                  variant={filterFavoriteOnly ? "primary" : "secondary"}
                  onPress={() => setFilterFavoriteOnly(!filterFavoriteOnly)}
                >
                  <Ionicons
                    name={filterFavoriteOnly ? "star" : "star-outline"}
                    size={10}
                    color={filterFavoriteOnly ? successColor : mutedColor}
                  />
                  <Chip.Label className="text-[9px]">{t("gallery.favoritesOnly")}</Chip.Label>
                </Chip>
              </View>
            </ScrollView>
          </View>
        ) : (
          <>
            {/* Search Bar */}
            <TextField>
              <View className="w-full flex-row items-center">
                <Input
                  className="flex-1 pl-9 pr-9"
                  placeholder={t("gallery.searchPlaceholder") ?? t("files.searchPlaceholder")}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCorrect={false}
                />
                <Ionicons
                  name="search-outline"
                  size={16}
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
                    <Ionicons name="close-circle" size={16} color={mutedColor} />
                  </Button>
                )}
              </View>
            </TextField>

            <Separator />

            {/* Object Filters */}
            {metadataIndex.objects.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-1.5">
                  <Chip
                    size="sm"
                    variant={!filterObject ? "primary" : "secondary"}
                    onPress={() => setFilterObject("")}
                  >
                    <Chip.Label className="text-[10px]">{t("gallery.allImages")}</Chip.Label>
                  </Chip>
                  {metadataIndex.objects.map((obj) => (
                    <Chip
                      key={obj}
                      size="sm"
                      variant={filterObject === obj ? "primary" : "secondary"}
                      onPress={() => setFilterObject(obj)}
                    >
                      <Chip.Label className="text-[10px]">{obj}</Chip.Label>
                    </Chip>
                  ))}
                </View>
              </ScrollView>
            )}

            {/* Frame Type Filters */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-1.5">
                <Chip
                  size="sm"
                  variant={!filterFrameType ? "primary" : "secondary"}
                  onPress={() => setFilterFrameType("")}
                >
                  <Chip.Label className="text-[10px]">{t("gallery.allTypes")}</Chip.Label>
                </Chip>
                {FRAME_TYPES.map((ft) => (
                  <Chip
                    key={ft.key}
                    size="sm"
                    variant={filterFrameType === ft.key ? "primary" : "secondary"}
                    onPress={() => setFilterFrameType(ft.key)}
                  >
                    <Ionicons
                      name={ft.icon}
                      size={10}
                      color={filterFrameType === ft.key ? successColor : mutedColor}
                    />
                    <Chip.Label className="text-[10px]">{ft.label}</Chip.Label>
                  </Chip>
                ))}
                <Chip
                  size="sm"
                  variant={filterFavoriteOnly ? "primary" : "secondary"}
                  onPress={() => setFilterFavoriteOnly(!filterFavoriteOnly)}
                >
                  <Ionicons
                    name={filterFavoriteOnly ? "star" : "star-outline"}
                    size={10}
                    color={filterFavoriteOnly ? "#fff" : mutedColor}
                  />
                  <Chip.Label className="text-[10px]">{t("gallery.favoritesOnly")}</Chip.Label>
                </Chip>
              </View>
            </ScrollView>

            {/* Target Filter */}
            {filterTargetId && (
              <View className="mt-2">
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View className="flex-row gap-1.5">
                    <Chip size="sm" variant="primary" onPress={() => setFilterTargetId("")}>
                      <Ionicons name="telescope-outline" size={10} color="#fff" />
                      <Chip.Label className="text-[10px]">{t("targets.title")}</Chip.Label>
                      <Ionicons name="close" size={8} color="#fff" />
                    </Chip>
                  </View>
                </ScrollView>
              </View>
            )}
          </>
        )}

        {/* Albums Section */}
        <View className="flex-row items-center justify-between mb-2">
          <Text
            className={
              isLandscape
                ? "text-sm font-semibold text-foreground"
                : "text-base font-semibold text-foreground"
            }
          >
            {t("gallery.albums")} ({filteredAlbums.length})
          </Text>
          <View className="flex-row gap-1">
            <Button size="sm" variant="ghost" isIconOnly onPress={() => setShowDuplicates(true)}>
              <Ionicons name="copy-outline" size={14} color={mutedColor} />
            </Button>
            <Button size="sm" variant="outline" onPress={() => setShowSmartAlbum(true)}>
              <Ionicons name="sparkles-outline" size={14} color={successColor} />
            </Button>
            <Button
              testID="e2e-action-tabs__gallery-open-create-album"
              size="sm"
              variant="outline"
              onPress={() => setShowCreateAlbum(true)}
            >
              <Ionicons name="add-outline" size={14} color={mutedColor} />
              {!isLandscape && (
                <Button.Label className="text-xs">{t("gallery.createAlbum")}</Button.Label>
              )}
            </Button>
          </View>
        </View>

        {/* Album Search & Sort */}
        <View className="mb-2 flex-row items-center gap-2">
          <View className="flex-1">
            <AlbumSearchBar
              value={albumSearchQuery}
              onChangeText={setAlbumSearchQuery}
              compact={isLandscape}
            />
          </View>
          <AlbumSortControl
            sortBy={albumSortBy}
            sortOrder={albumSortOrder}
            onSortByChange={(v) => setAlbumSortBy(v as AlbumSortBy)}
            onSortOrderChange={setAlbumSortOrder}
            compact={isLandscape}
          />
        </View>

        {filteredAlbums.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className={isLandscape ? "flex-row gap-1.5" : "flex-row gap-2"}>
              {filteredAlbums.map((album) => (
                <AlbumCard
                  key={album.id}
                  album={album}
                  compact={isLandscape}
                  onPress={() => router.push(`/album/${album.id}`)}
                  onLongPress={() => {
                    setActionAlbum(album);
                    setSelectedAlbum(album);
                  }}
                />
              ))}
            </View>
          </ScrollView>
        ) : (
          <View
            className={`rounded-xl border border-separator bg-surface-secondary items-center ${isLandscape ? "p-3" : "p-6"}`}
          >
            <Ionicons name="albums-outline" size={isLandscape ? 24 : 32} color={mutedColor} />
            <Text className="mt-1 text-xs text-muted">{t("album.noAlbums")}</Text>
            <Text className="mt-1 text-xs text-muted">{t("album.createFirst")}</Text>
          </View>
        )}

        {!isLandscape && <Separator />}

        {/* Selection Toolbar */}
        {isSelectionMode && (
          <View className="flex-row items-center justify-between rounded-xl bg-surface-secondary px-3 py-2">
            <Text className="text-xs text-foreground">
              {selectedIds.length} {t("album.selected")}
            </Text>
            <View className="flex-row gap-1">
              <Button size="sm" variant="outline" onPress={handleSelectAllToggle}>
                <Ionicons
                  name={allDisplaySelected ? "checkmark-done-outline" : "checkmark-outline"}
                  size={12}
                  color={mutedColor}
                />
                {!isLandscape && (
                  <Button.Label className="text-[10px]">
                    {allDisplaySelected ? t("common.deselectAll") : t("common.selectAll")}
                  </Button.Label>
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onPress={() => setShowAlbumPicker(true)}
                isDisabled={selectedIds.length === 0}
              >
                <Ionicons name="albums-outline" size={12} color={mutedColor} />
                {!isLandscape && (
                  <Button.Label className="text-[10px]">{t("gallery.addToAlbum")}</Button.Label>
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onPress={() => setShowBatchTag(true)}
                isDisabled={selectedIds.length === 0}
              >
                <Ionicons name="pricetag-outline" size={12} color={mutedColor} />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onPress={() => setShowBatchRename(true)}
                isDisabled={selectedIds.length === 0}
              >
                <Ionicons name="text-outline" size={12} color={mutedColor} />
              </Button>
              <Button
                testID="e2e-action-tabs__gallery-open-compare"
                size="sm"
                variant="outline"
                onPress={() => {
                  router.push(`/compare?ids=${selectedIds.join(",")}`);
                  exitSelectionMode();
                }}
                isDisabled={selectedIds.length < 2}
              >
                <Ionicons name="git-compare-outline" size={12} color={mutedColor} />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onPress={handleBatchDelete}
                isDisabled={selectedIds.length === 0}
              >
                <Ionicons name="trash-outline" size={12} color="#ef4444" />
              </Button>
              <Button size="sm" variant="outline" onPress={exitSelectionMode}>
                <Ionicons name="close-outline" size={14} color={mutedColor} />
              </Button>
            </View>
          </View>
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
            {filterObject || t("gallery.allImages")} ({displayFiles.length})
          </Text>
          <View className="flex-row items-center gap-1">
            {activeFilterCount > 0 && (
              <Button size="sm" variant="ghost" onPress={clearFilters}>
                <Ionicons name="funnel-outline" size={14} color={mutedColor} />
                {!isLandscape && (
                  <Button.Label className="text-[10px]">
                    {t("targets.clearFilters")} ({activeFilterCount})
                  </Button.Label>
                )}
              </Button>
            )}
            <Button size="sm" variant="outline" onPress={() => setShowReport(true)}>
              <Ionicons name="stats-chart-outline" size={14} color={successColor} />
            </Button>
          </View>
        </View>
      </View>
    ),
    [
      t,
      totalCount,
      viewMode,
      metadataIndex,
      filterObject,
      filterFrameType,
      filterTargetId,
      filterFavoriteOnly,
      filteredAlbums,
      albumSearchQuery,
      albumSortBy,
      albumSortOrder,
      isSelectionMode,
      selectedIds,
      allDisplaySelected,
      displayFiles.length,
      activeFilterCount,
      successColor,
      mutedColor,
      searchQuery,
      router,
      setViewMode,
      setFilterObject,
      setFilterFrameType,
      setFilterTargetId,
      setFilterFavoriteOnly,
      setAlbumSearchQuery,
      setAlbumSortBy,
      setAlbumSortOrder,
      clearFilters,
      exitSelectionMode,
      handleSelectAllToggle,
      handleBatchDelete,
      isLandscape,
      FRAME_TYPES,
    ],
  );

  const renderTimelineSection = useCallback(
    ({ item }: { item: TimelineSection }) => (
      <View className="mb-4">
        <Text className="mb-2 text-xs font-semibold text-muted">{item.date}</Text>
        <ThumbnailGrid
          files={item.files}
          columns={effectiveColumns}
          selectionMode={isSelectionMode}
          selectedIds={selectedIds}
          onPress={handleFilePress}
          onLongPress={handleFileLongPress}
          onSelect={toggleSelection}
          scrollEnabled={false}
          showFilename={thumbShowFilename}
          showObject={thumbShowObject}
          showFilter={thumbShowFilter}
          showExposure={thumbShowExposure}
        />
      </View>
    ),
    [
      effectiveColumns,
      isSelectionMode,
      selectedIds,
      handleFilePress,
      handleFileLongPress,
      toggleSelection,
      thumbShowFilename,
      thumbShowObject,
      thumbShowFilter,
      thumbShowExposure,
    ],
  );

  const timelineKeyExtractor = useCallback((item: TimelineSection) => item.date, []);

  return (
    <View testID="e2e-screen-tabs__gallery" className="flex-1 bg-background">
      {displayFiles.length === 0 ? (
        <FlatList
          data={[]}
          renderItem={null}
          ListHeaderComponent={GalleryHeader}
          ListEmptyComponent={<EmptyState icon="images-outline" title={t("gallery.noImages")} />}
          contentContainerStyle={{
            paddingHorizontal: horizontalPadding,
            paddingTop: isLandscape ? 8 : contentPaddingTop,
            paddingBottom: 24,
          }}
          showsVerticalScrollIndicator={false}
        />
      ) : viewMode === "timeline" ? (
        <FlatList
          data={timelineSections}
          renderItem={renderTimelineSection}
          keyExtractor={timelineKeyExtractor}
          ListHeaderComponent={GalleryHeader}
          contentContainerStyle={{
            paddingHorizontal: horizontalPadding,
            paddingTop: isLandscape ? 8 : contentPaddingTop,
            paddingBottom: 24,
          }}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View
          className="flex-1"
          style={{ paddingHorizontal: horizontalPadding, paddingTop: contentPaddingTop }}
        >
          <ThumbnailGrid
            files={displayFiles}
            columns={viewMode === "list" ? 1 : effectiveColumns}
            selectionMode={isSelectionMode}
            selectedIds={selectedIds}
            onPress={handleFilePress}
            onLongPress={handleFileLongPress}
            onSelect={toggleSelection}
            ListHeaderComponent={GalleryHeader}
            showFilename={thumbShowFilename}
            showObject={thumbShowObject}
            showFilter={thumbShowFilter}
            showExposure={thumbShowExposure}
          />
        </View>
      )}

      <CreateAlbumModal
        visible={showCreateAlbum}
        onClose={() => setShowCreateAlbum(false)}
        onConfirm={handleCreateAlbum}
      />
      <SmartAlbumModal
        visible={showSmartAlbum}
        onClose={() => setShowSmartAlbum(false)}
        onConfirm={(name, rules, desc) => {
          createSmartAlbum(name, rules, desc);
          setShowSmartAlbum(false);
        }}
        suggestions={getSuggestions()}
      />
      <AlbumPickerSheet
        visible={showAlbumPicker}
        albums={albums}
        onClose={() => setShowAlbumPicker(false)}
        onSelect={handleAddToAlbum}
      />
      <AlbumActionSheet
        visible={!!actionAlbum}
        albumName={actionAlbum?.name ?? ""}
        isPinned={actionAlbum?.isPinned ?? false}
        isSmart={actionAlbum?.isSmart ?? false}
        onClose={() => setActionAlbum(null)}
        onViewDetail={() => actionAlbum && router.push(`/album/${actionAlbum.id}`)}
        onRename={handleAlbumRename}
        onDelete={handleAlbumDelete}
        onTogglePin={() => actionAlbum && toggleAlbumPin(actionAlbum.id)}
        onEditNotes={handleAlbumEditNotes}
        onViewStats={handleAlbumViewStats}
        onExport={handleAlbumExport}
        onMerge={handleAlbumMerge}
      />
      <BatchTagSheet
        visible={showBatchTag}
        selectedIds={selectedIds}
        onClose={() => setShowBatchTag(false)}
      />
      <BatchRenameSheet
        visible={showBatchRename}
        files={files}
        selectedIds={selectedIds}
        onApplyRenames={handleBatchRenameApply}
        onClose={() => setShowBatchRename(false)}
      />
      <IntegrationReportSheet visible={showReport} onClose={() => setShowReport(false)} />

      {/* NEW: Album Sheets */}
      <AlbumStatisticsSheet
        visible={showAlbumStats}
        statistics={selectedAlbum ? getAlbumStatistics(selectedAlbum.id) : null}
        albumName={selectedAlbum?.name ?? ""}
        imageCount={selectedAlbum?.imageIds.length ?? 0}
        onClose={() => setShowAlbumStats(false)}
      />
      <AlbumMergeSheet
        visible={showAlbumMerge}
        sourceAlbum={selectedAlbum}
        albums={albums}
        onClose={() => setShowAlbumMerge(false)}
        onMerge={(targetId) => {
          if (!selectedAlbum) return;
          const merged = mergeAlbums(selectedAlbum.id, targetId);
          Alert.alert(
            merged ? t("common.success") : t("common.error"),
            merged ? t("album.mergeSuccess") : t("album.mergeFailed"),
          );
        }}
      />
      <AlbumExportSheet
        visible={showAlbumExport}
        album={selectedAlbum}
        files={files}
        onClose={() => setShowAlbumExport(false)}
      />
      <DuplicateImagesSheet
        visible={showDuplicates}
        duplicates={duplicateImages}
        files={files}
        onClose={() => setShowDuplicates(false)}
        onImagePress={(imageId) => {
          const file = files.find((item) => item.id === imageId);
          if (!file) return;
          const route =
            file.mediaKind === "video" || file.sourceType === "video"
              ? `/video/${imageId}`
              : `/viewer/${imageId}`;
          router.push(route);
        }}
      />
      <PromptDialog
        visible={showRenamePrompt}
        title={t("album.rename")}
        defaultValue={selectedAlbum?.name ?? ""}
        onConfirm={(newName) => {
          if (selectedAlbum) updateAlbum(selectedAlbum.id, { name: newName });
          setShowRenamePrompt(false);
        }}
        onCancel={() => setShowRenamePrompt(false)}
      />
      <PromptDialog
        visible={showEditNotes}
        title={t("album.editNotes")}
        placeholder={t("album.notesPlaceholder")}
        defaultValue={selectedAlbum?.notes ?? ""}
        onConfirm={(notes) => {
          if (selectedAlbum) updateAlbumNotes(selectedAlbum.id, notes);
          setShowEditNotes(false);
        }}
        onCancel={() => setShowEditNotes(false)}
        multiline
        allowEmpty
      />
    </View>
  );
}
