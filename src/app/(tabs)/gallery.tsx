import { View, Text, ScrollView, TouchableOpacity, Alert } from "react-native";
import { useState } from "react";
import { Button, Chip, Separator, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useI18n } from "../../i18n/useI18n";
import { useGallery } from "../../hooks/useGallery";
import { useAlbums } from "../../hooks/useAlbums";
import { useGalleryStore } from "../../stores/useGalleryStore";
import { ThumbnailGrid } from "../../components/gallery/ThumbnailGrid";
import { AlbumCard } from "../../components/gallery/AlbumCard";
import { CreateAlbumModal } from "../../components/gallery/CreateAlbumModal";
import { AlbumActionSheet } from "../../components/gallery/AlbumActionSheet";
import { AlbumPickerSheet } from "../../components/gallery/AlbumPickerSheet";
import { SmartAlbumModal } from "../../components/gallery/SmartAlbumModal";
import { EmptyState } from "../../components/common/EmptyState";
import type { GalleryViewMode, FitsMetadata, Album } from "../../lib/fits/types";

const VIEW_MODES: { key: GalleryViewMode; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "grid", icon: "grid-outline" },
  { key: "list", icon: "list-outline" },
  { key: "timeline", icon: "time-outline" },
];

export default function GalleryScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const [successColor, mutedColor] = useThemeColor(["success", "muted"]);

  const {
    files,
    totalCount,
    viewMode,
    gridColumns,
    metadataIndex,
    groupedByDate,
    groupedByObject: _groupedByObject,
    search,
  } = useGallery();

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

  const [searchQuery, _setSearchQuery] = useState("");
  const [showCreateAlbum, setShowCreateAlbum] = useState(false);
  const [actionAlbum, setActionAlbum] = useState<Album | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showAlbumPicker, setShowAlbumPicker] = useState(false);
  const [showSmartAlbum, setShowSmartAlbum] = useState(false);
  const displayFiles = searchQuery ? search(searchQuery) : files;

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id],
    );
  };

  const exitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedIds([]);
  };

  const handleCreateAlbum = (name: string, description?: string) => {
    createNewAlbum(name, description);
    setShowCreateAlbum(false);
  };

  const handleFilePress = (file: FitsMetadata) => {
    if (isSelectionMode) {
      toggleSelection(file.id);
    } else {
      router.push(`/viewer/${file.id}`);
    }
  };

  const handleFileLongPress = (file: FitsMetadata) => {
    if (!isSelectionMode) {
      setIsSelectionMode(true);
      setSelectedIds([file.id]);
    }
  };

  const handleAddToAlbum = (albumId: string) => {
    addImagesToAlbum(albumId, selectedIds);
    exitSelectionMode();
  };

  const handleAlbumRename = () => {
    if (!actionAlbum) return;
    const album = actionAlbum;
    Alert.prompt?.(
      t("album.rename"),
      "",
      (newName: string) => {
        if (newName.trim()) updateAlbum(album.id, { name: newName.trim() });
      },
      "plain-text",
      album.name,
    );
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

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="px-4 py-14">
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-2xl font-bold text-foreground">{t("gallery.title")}</Text>
          <Text className="mt-1 text-sm text-muted">
            {t("gallery.subtitle")} ({totalCount})
          </Text>
        </View>
        <View className="flex-row gap-1">
          {VIEW_MODES.map((mode) => (
            <TouchableOpacity key={mode.key} onPress={() => setViewMode(mode.key)}>
              <View
                className={`h-8 w-8 items-center justify-center rounded-lg ${
                  viewMode === mode.key ? "bg-success/20" : "bg-surface-secondary"
                }`}
              >
                <Ionicons
                  name={mode.icon}
                  size={16}
                  color={viewMode === mode.key ? successColor : mutedColor}
                />
              </View>
            </TouchableOpacity>
          ))}
          <TouchableOpacity onPress={() => router.push("/map")}>
            <View className="h-8 w-8 items-center justify-center rounded-lg bg-surface-secondary">
              <Ionicons name="map-outline" size={16} color={mutedColor} />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <Separator className="my-4" />

      {/* Object Filters */}
      {metadataIndex.objects.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
          <View className="flex-row gap-1.5">
            <TouchableOpacity onPress={() => setFilterObject("")}>
              <Chip size="sm" variant={!filterObject ? "primary" : "secondary"}>
                <Chip.Label className="text-[10px]">{t("gallery.allImages")}</Chip.Label>
              </Chip>
            </TouchableOpacity>
            {metadataIndex.objects.map((obj) => (
              <TouchableOpacity key={obj} onPress={() => setFilterObject(obj)}>
                <Chip size="sm" variant={filterObject === obj ? "primary" : "secondary"}>
                  <Chip.Label className="text-[10px]">{obj}</Chip.Label>
                </Chip>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}

      {/* Albums Section */}
      <View className="flex-row items-center justify-between">
        <Text className="text-base font-semibold text-foreground">{t("gallery.albums")}</Text>
        <View className="flex-row gap-1">
          <Button size="sm" variant="outline" onPress={() => setShowSmartAlbum(true)}>
            <Ionicons name="sparkles-outline" size={14} color={successColor} />
          </Button>
          <Button size="sm" variant="outline" onPress={() => setShowCreateAlbum(true)}>
            <Ionicons name="add-outline" size={14} color={mutedColor} />
            <Button.Label className="text-xs">{t("gallery.createAlbum")}</Button.Label>
          </Button>
        </View>
      </View>

      {albums.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3 mb-2">
          <View className="flex-row gap-2">
            {albums.map((album) => (
              <AlbumCard
                key={album.id}
                album={album}
                onPress={() => router.push(`/album/${album.id}`)}
                onLongPress={() => setActionAlbum(album)}
              />
            ))}
          </View>
        </ScrollView>
      ) : (
        <View className="mt-3 rounded-xl border border-separator bg-surface-secondary p-6 items-center">
          <Ionicons name="albums-outline" size={32} color={mutedColor} />
          <Text className="mt-2 text-xs text-muted">{t("gallery.emptyAlbum")}</Text>
        </View>
      )}

      <Separator className="my-4" />

      {/* Selection Toolbar */}
      {isSelectionMode && (
        <View className="flex-row items-center justify-between mb-3 rounded-xl bg-surface-secondary px-3 py-2">
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
              <Button.Label className="text-[10px]">{t("gallery.addToAlbum")}</Button.Label>
            </Button>
            <Button size="sm" variant="outline" onPress={exitSelectionMode}>
              <Ionicons name="close-outline" size={14} color={mutedColor} />
            </Button>
          </View>
        </View>
      )}

      {/* Images */}
      <Text className="text-base font-semibold text-foreground mb-3">
        {filterObject || t("gallery.allImages")} ({displayFiles.length})
      </Text>

      {displayFiles.length === 0 ? (
        <EmptyState icon="images-outline" title={t("gallery.noImages")} />
      ) : viewMode === "timeline" ? (
        <View className="gap-4">
          {Object.entries(groupedByDate)
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([date, dateFiles]) => (
              <View key={date}>
                <Text className="mb-2 text-xs font-semibold text-muted">{date}</Text>
                <ThumbnailGrid
                  files={dateFiles}
                  columns={gridColumns}
                  selectionMode={isSelectionMode}
                  selectedIds={selectedIds}
                  onPress={handleFilePress}
                  onLongPress={handleFileLongPress}
                  onSelect={toggleSelection}
                />
              </View>
            ))}
        </View>
      ) : (
        <ThumbnailGrid
          files={displayFiles}
          columns={viewMode === "list" ? 1 : gridColumns}
          selectionMode={isSelectionMode}
          selectedIds={selectedIds}
          onPress={handleFilePress}
          onLongPress={handleFileLongPress}
          onSelect={toggleSelection}
        />
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
    </ScrollView>
  );
}
