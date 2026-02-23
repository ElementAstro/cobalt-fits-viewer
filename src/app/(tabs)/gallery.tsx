import { View, Text, Alert } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useState, useMemo, useCallback, useEffect } from "react";
import * as Haptics from "expo-haptics";
import { useSelectionMode } from "../../hooks/useSelectionMode";
import { useHapticFeedback } from "../../hooks/useHapticFeedback";
import { Tabs, useThemeColor } from "heroui-native";
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
import { GalleryHeader } from "../../components/gallery/GalleryHeader";
import { AlbumsTabContent } from "../../components/gallery/AlbumsTabContent";
import { CreateAlbumModal } from "../../components/gallery/CreateAlbumModal";
import { AlbumActionSheet } from "../../components/gallery/AlbumActionSheet";
import { AlbumPickerSheet } from "../../components/gallery/AlbumPickerSheet";
import { BatchTagSheet } from "../../components/gallery/BatchTagSheet";
import { BatchRenameSheet } from "../../components/gallery/BatchRenameSheet";
import { IntegrationReportSheet } from "../../components/gallery/IntegrationReportSheet";
import { SmartAlbumModal } from "../../components/gallery/SmartAlbumModal";
import { AlbumStatisticsSheet } from "../../components/gallery/AlbumStatisticsSheet";
import { AlbumMergeSheet } from "../../components/gallery/AlbumMergeSheet";
import { AlbumExportSheet } from "../../components/gallery/AlbumExportSheet";
import { DuplicateImagesSheet } from "../../components/gallery/DuplicateImagesSheet";
import { ThumbnailLoadingBanner } from "../../components/gallery/ThumbnailLoadingBanner";
import { EmptyState } from "../../components/common/EmptyState";
import { GuideTarget } from "../../components/common/GuideTarget";
import { PromptDialog } from "../../components/common/PromptDialog";
import { getFrameTypeDefinitions } from "../../lib/gallery/frameClassifier";
import { routeForMedia } from "../../lib/media/routing";
import type { FitsMetadata, Album } from "../../lib/fits/types";
import type { ThumbnailLoadingSummary } from "../../components/gallery/thumbnailLoading";

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

  const [, mutedColor] = useThemeColor(["success", "muted"]);

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
    reconcileSelection,
  } = useSelectionMode();
  const [activeMainTab, setActiveMainTab] = useState<"images" | "albums">("images");
  const [thumbnailLoadingSummary, setThumbnailLoadingSummary] =
    useState<ThumbnailLoadingSummary | null>(null);
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
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allDisplaySelected =
    displayFiles.length > 0 && displayFiles.every((file) => selectedIdSet.has(file.id));

  const timelineSections = useMemo<TimelineSection[]>(() => {
    if (viewMode !== "timeline") return [];
    return Object.entries(groupedByDate)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, dateFiles]) => ({ date, files: dateFiles }));
  }, [viewMode, groupedByDate]);

  useEffect(() => {
    reconcileSelection(displayFiles.map((file) => file.id));
  }, [displayFiles, reconcileSelection]);

  const handleCreateAlbum = (name: string, description?: string) => {
    createNewAlbum(name, description);
    setShowCreateAlbum(false);
  };

  const handleFilePress = useCallback(
    (file: FitsMetadata) => {
      if (isSelectionMode) {
        toggleSelection(file.id);
      } else {
        router.push(routeForMedia(file));
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

  const handleAlbumPress = useCallback(
    (album: Album) => router.push(`/album/${album.id}`),
    [router],
  );

  const handleAlbumAction = useCallback((album: Album) => {
    setActionAlbum(album);
    setSelectedAlbum(album);
  }, []);

  const handleCompare = useCallback(() => {
    router.push(`/compare?ids=${selectedIds.join(",")}`);
    exitSelectionMode();
  }, [router, selectedIds, exitSelectionMode]);

  const handleOpenMap = useCallback(() => router.push("/map"), [router]);
  const handleOpenAlbumPicker = useCallback(() => setShowAlbumPicker(true), []);
  const handleOpenBatchTag = useCallback(() => setShowBatchTag(true), []);
  const handleOpenBatchRename = useCallback(() => setShowBatchRename(true), []);
  const handleOpenReport = useCallback(() => setShowReport(true), []);

  const galleryHeaderElement = (
    <GuideTarget name="gallery-header" page="gallery" order={1}>
      <GalleryHeader
        totalCount={totalCount}
        displayCount={displayFiles.length}
        viewMode={viewMode}
        searchQuery={searchQuery}
        filterObject={filterObject}
        filterFrameType={filterFrameType}
        filterTargetId={filterTargetId}
        filterFavoriteOnly={filterFavoriteOnly}
        activeFilterCount={activeFilterCount}
        metadataIndex={metadataIndex}
        frameTypes={FRAME_TYPES}
        isLandscape={isLandscape}
        isSelectionMode={isSelectionMode}
        selectedCount={selectedIds.length}
        allDisplaySelected={allDisplaySelected}
        onViewModeChange={setViewMode}
        onSearchChange={setSearchQuery}
        onFilterObjectChange={setFilterObject}
        onFilterFrameTypeChange={setFilterFrameType}
        onFilterTargetIdChange={setFilterTargetId}
        onFilterFavoriteOnlyChange={setFilterFavoriteOnly}
        onClearFilters={clearFilters}
        onSelectAllToggle={handleSelectAllToggle}
        onAddToAlbum={handleOpenAlbumPicker}
        onBatchTag={handleOpenBatchTag}
        onBatchRename={handleOpenBatchRename}
        onCompare={handleCompare}
        onBatchDelete={handleBatchDelete}
        onExitSelection={exitSelectionMode}
        onOpenReport={handleOpenReport}
        onOpenMap={handleOpenMap}
      />
    </GuideTarget>
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

  useEffect(() => {
    if (activeMainTab !== "images" || viewMode === "timeline" || displayFiles.length === 0) {
      setThumbnailLoadingSummary(null);
    }
  }, [activeMainTab, viewMode, displayFiles.length]);

  return (
    <View testID="e2e-screen-tabs__gallery" className="flex-1 bg-background">
      <View
        style={{
          paddingHorizontal: horizontalPadding,
          paddingTop: isLandscape ? 8 : contentPaddingTop,
        }}
      >
        <GuideTarget name="gallery-tabs" page="gallery" order={0}>
          <Tabs
            value={activeMainTab}
            onValueChange={(value) => setActiveMainTab(value as "images" | "albums")}
            variant="secondary"
          >
            <Tabs.List>
              <Tabs.Indicator />
              <Tabs.Trigger value="images" testID="e2e-action-tabs__gallery-tab-images">
                <Ionicons name="images-outline" size={14} color={mutedColor} />
                <Tabs.Label>{t("gallery.imagesTab")}</Tabs.Label>
              </Tabs.Trigger>
              <Tabs.Trigger value="albums" testID="e2e-action-tabs__gallery-tab-albums">
                <Ionicons name="albums-outline" size={14} color={mutedColor} />
                <Tabs.Label>{t("gallery.albumsTab")}</Tabs.Label>
              </Tabs.Trigger>
            </Tabs.List>
          </Tabs>
        </GuideTarget>
      </View>

      {activeMainTab === "images" ? (
        displayFiles.length === 0 ? (
          <FlashList
            data={[]}
            renderItem={() => null}
            ListHeaderComponent={galleryHeaderElement}
            ListEmptyComponent={<EmptyState icon="images-outline" title={t("gallery.noImages")} />}
            contentContainerStyle={{
              paddingHorizontal: horizontalPadding,
              paddingTop: 8,
              paddingBottom: 24,
            }}
            showsVerticalScrollIndicator={false}
          />
        ) : viewMode === "timeline" ? (
          <FlashList
            data={timelineSections}
            renderItem={renderTimelineSection}
            keyExtractor={timelineKeyExtractor}
            ListHeaderComponent={
              <View>
                {galleryHeaderElement}
                <ThumbnailLoadingBanner summary={thumbnailLoadingSummary} />
              </View>
            }
            contentContainerStyle={{
              paddingHorizontal: horizontalPadding,
              paddingTop: 8,
              paddingBottom: 24,
            }}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <View className="flex-1" style={{ paddingHorizontal: horizontalPadding, paddingTop: 8 }}>
            <ThumbnailGrid
              files={displayFiles}
              columns={viewMode === "list" ? 1 : effectiveColumns}
              selectionMode={isSelectionMode}
              selectedIds={selectedIds}
              onPress={handleFilePress}
              onLongPress={handleFileLongPress}
              onSelect={toggleSelection}
              onLoadingSummaryChange={setThumbnailLoadingSummary}
              ListHeaderComponent={
                <View>
                  {galleryHeaderElement}
                  <ThumbnailLoadingBanner summary={thumbnailLoadingSummary} />
                </View>
              }
              showFilename={thumbShowFilename}
              showObject={thumbShowObject}
              showFilter={thumbShowFilter}
              showExposure={thumbShowExposure}
              showLoadProgress
            />
          </View>
        )
      ) : (
        <View
          className="flex-1"
          style={{
            paddingHorizontal: horizontalPadding,
            paddingTop: 8,
          }}
        >
          <AlbumsTabContent
            albums={filteredAlbums}
            searchQuery={albumSearchQuery}
            sortBy={albumSortBy}
            sortOrder={albumSortOrder}
            onSearchChange={setAlbumSearchQuery}
            onSortByChange={setAlbumSortBy}
            onSortOrderChange={setAlbumSortOrder}
            onAlbumPress={handleAlbumPress}
            onAlbumAction={handleAlbumAction}
            onCreateAlbum={() => setShowCreateAlbum(true)}
            onCreateSmartAlbum={() => setShowSmartAlbum(true)}
            onFindDuplicates={() => setShowDuplicates(true)}
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
          router.push(routeForMedia(file));
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
