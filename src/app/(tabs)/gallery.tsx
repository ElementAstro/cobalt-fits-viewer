import { View, Text, ScrollView, Alert, FlatList } from "react-native";
import { useState, useMemo, useCallback } from "react";
import * as Haptics from "expo-haptics";
import { useSelectionMode } from "../../hooks/useSelectionMode";
import { Button, Chip, Input, Separator, TextField, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useI18n } from "../../i18n/useI18n";
import { useScreenOrientation } from "../../hooks/useScreenOrientation";
import { useGallery } from "../../hooks/useGallery";
import { useAlbums } from "../../hooks/useAlbums";
import { useGalleryStore } from "../../stores/useGalleryStore";
import { useFitsStore } from "../../stores/useFitsStore";
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
import { EmptyState } from "../../components/common/EmptyState";
import { PromptDialog } from "../../components/common/PromptDialog";
import type { GalleryViewMode, FitsMetadata, Album, FrameType } from "../../lib/fits/types";

const VIEW_MODES: { key: GalleryViewMode; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "grid", icon: "grid-outline" },
  { key: "list", icon: "list-outline" },
  { key: "timeline", icon: "time-outline" },
];

type TimelineSection = { date: string; files: FitsMetadata[] };

const FRAME_TYPE_ICONS: Record<FrameType, keyof typeof Ionicons.glyphMap> = {
  light: "sunny-outline",
  dark: "moon-outline",
  flat: "square-outline",
  bias: "pulse-outline",
  unknown: "help-outline",
};

export default function GalleryScreen() {
  const router = useRouter();
  const { t } = useI18n();

  const FRAME_TYPES = useMemo(
    () =>
      (["light", "dark", "flat", "bias"] as FrameType[]).map((key) => ({
        key,
        label: t(`gallery.frameTypes.${key}`) ?? key,
        icon: FRAME_TYPE_ICONS[key],
      })),
    [t],
  );
  const [successColor, mutedColor] = useThemeColor(["success", "muted"]);

  const { isLandscape } = useScreenOrientation();
  const { files, totalCount, viewMode, gridColumns, metadataIndex, groupedByDate, search } =
    useGallery();
  const effectiveColumns = isLandscape ? Math.min(gridColumns + 2, 6) : gridColumns;

  const {
    albums,
    createAlbum: createNewAlbum,
    createSmartAlbum,
    removeAlbum,
    updateAlbum,
    addImagesToAlbum,
    getSuggestions,
  } = useAlbums();
  const setViewMode = useGalleryStore((s) => s.setViewMode);
  const setFilterObject = useGalleryStore((s) => s.setFilterObject);
  const filterObject = useGalleryStore((s) => s.filterObject);
  const setFilterFrameType = useGalleryStore((s) => s.setFilterFrameType);
  const filterFrameType = useGalleryStore((s) => s.filterFrameType);

  const thumbShowFilename = useSettingsStore((s) => s.thumbnailShowFilename);
  const thumbShowObject = useSettingsStore((s) => s.thumbnailShowObject);
  const thumbShowFilter = useSettingsStore((s) => s.thumbnailShowFilter);
  const thumbShowExposure = useSettingsStore((s) => s.thumbnailShowExposure);

  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateAlbum, setShowCreateAlbum] = useState(false);
  const [actionAlbum, setActionAlbum] = useState<Album | null>(null);
  const { isSelectionMode, selectedIds, toggleSelection, enterSelectionMode, exitSelectionMode } =
    useSelectionMode();
  const [showAlbumPicker, setShowAlbumPicker] = useState(false);
  const [showSmartAlbum, setShowSmartAlbum] = useState(false);
  const [showRenamePrompt, setShowRenamePrompt] = useState(false);
  const [showBatchTag, setShowBatchTag] = useState(false);
  const [showBatchRename, setShowBatchRename] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const displayFiles = searchQuery ? search(searchQuery) : files;

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
        router.push(`/viewer/${file.id}`);
      }
    },
    [isSelectionMode, toggleSelection, router],
  );

  const handleFileLongPress = useCallback(
    (file: FitsMetadata) => {
      if (!isSelectionMode) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        enterSelectionMode(file.id);
      }
    },
    [isSelectionMode, enterSelectionMode],
  );

  const removeFiles = useFitsStore((s) => s.removeFiles);

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
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          removeFiles(selectedIds);
          exitSelectionMode();
        },
      },
    ]);
  }, [selectedIds, t, removeFiles, exitSelectionMode]);

  const handleAlbumRename = () => {
    if (!actionAlbum) return;
    setShowRenamePrompt(true);
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
            <Button size="sm" isIconOnly variant="ghost" onPress={() => router.push("/map")}>
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
              </View>
            </ScrollView>
          </>
        )}

        {/* Albums Section */}
        <View className="flex-row items-center justify-between">
          <Text
            className={
              isLandscape
                ? "text-sm font-semibold text-foreground"
                : "text-base font-semibold text-foreground"
            }
          >
            {t("gallery.albums")}
          </Text>
          <View className="flex-row gap-1">
            <Button size="sm" variant="outline" onPress={() => setShowSmartAlbum(true)}>
              <Ionicons name="sparkles-outline" size={14} color={successColor} />
            </Button>
            <Button size="sm" variant="outline" onPress={() => setShowCreateAlbum(true)}>
              <Ionicons name="add-outline" size={14} color={mutedColor} />
              {!isLandscape && (
                <Button.Label className="text-xs">{t("gallery.createAlbum")}</Button.Label>
              )}
            </Button>
          </View>
        </View>

        {albums.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className={isLandscape ? "flex-row gap-1.5" : "flex-row gap-2"}>
              {albums.map((album) => (
                <AlbumCard
                  key={album.id}
                  album={album}
                  compact={isLandscape}
                  onPress={() => router.push(`/album/${album.id}`)}
                  onLongPress={() => setActionAlbum(album)}
                />
              ))}
            </View>
          </ScrollView>
        ) : (
          <View
            className={`rounded-xl border border-separator bg-surface-secondary items-center ${isLandscape ? "p-3" : "p-6"}`}
          >
            <Ionicons name="albums-outline" size={isLandscape ? 24 : 32} color={mutedColor} />
            <Text className="mt-1 text-xs text-muted">{t("gallery.emptyAlbum")}</Text>
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
          <Button size="sm" variant="outline" onPress={() => setShowReport(true)}>
            <Ionicons name="stats-chart-outline" size={14} color={successColor} />
          </Button>
        </View>
      </View>
    ),
    [
      t,
      totalCount,
      viewMode,
      metadataIndex,
      filterObject,
      albums,
      isSelectionMode,
      selectedIds,
      displayFiles.length,
      successColor,
      mutedColor,
      searchQuery,
      router,
      setViewMode,
      setFilterObject,
      filterFrameType,
      setFilterFrameType,
      exitSelectionMode,
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
    <View className="flex-1 bg-background">
      {displayFiles.length === 0 ? (
        <FlatList
          data={[]}
          renderItem={null}
          ListHeaderComponent={GalleryHeader}
          ListEmptyComponent={<EmptyState icon="images-outline" title={t("gallery.noImages")} />}
          contentContainerClassName={`px-4 ${isLandscape ? "py-2" : "py-14"}`}
          showsVerticalScrollIndicator={false}
        />
      ) : viewMode === "timeline" ? (
        <FlatList
          data={timelineSections}
          renderItem={renderTimelineSection}
          keyExtractor={timelineKeyExtractor}
          ListHeaderComponent={GalleryHeader}
          contentContainerClassName={`px-4 ${isLandscape ? "py-2" : "py-14"}`}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View className={`flex-1 px-4 ${isLandscape ? "pt-2" : "pt-14"}`}>
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
        onClose={() => setActionAlbum(null)}
        onViewDetail={() => actionAlbum && router.push(`/album/${actionAlbum.id}`)}
        onRename={handleAlbumRename}
        onDelete={handleAlbumDelete}
      />
      <BatchTagSheet
        visible={showBatchTag}
        selectedIds={selectedIds}
        onClose={() => setShowBatchTag(false)}
      />
      <BatchRenameSheet
        visible={showBatchRename}
        selectedIds={selectedIds}
        onClose={() => setShowBatchRename(false)}
      />
      <IntegrationReportSheet visible={showReport} onClose={() => setShowReport(false)} />
      <PromptDialog
        visible={showRenamePrompt}
        title={t("album.rename")}
        defaultValue={actionAlbum?.name ?? ""}
        onConfirm={(newName) => {
          if (actionAlbum) updateAlbum(actionAlbum.id, { name: newName });
          setShowRenamePrompt(false);
        }}
        onCancel={() => setShowRenamePrompt(false)}
      />
    </View>
  );
}
