import { View, Text, Alert } from "react-native";
import { useState, useMemo, useCallback } from "react";
import { Button, Chip, Separator, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useI18n } from "../../i18n/useI18n";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import { useAlbumStore } from "../../stores/useAlbumStore";
import { useFitsStore } from "../../stores/useFitsStore";
import { useSelectionMode } from "../../hooks/useSelectionMode";
import { ThumbnailGrid } from "../../components/gallery/ThumbnailGrid";
import { EmptyState } from "../../components/common/EmptyState";
import { PromptDialog } from "../../components/common/PromptDialog";
import { AlbumStatisticsSheet } from "../../components/gallery/AlbumStatisticsSheet";
import { calculateAlbumStatistics } from "../../lib/gallery/albumStatistics";
import { formatDate } from "../../lib/utils/format";
import type { FitsMetadata, AlbumStatistics } from "../../lib/fits/types";

export default function AlbumDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const [mutedColor, successColor] = useThemeColor(["muted", "success"]);
  const { isLandscape, isLandscapeTablet, contentPaddingTop, horizontalPadding } =
    useResponsiveLayout();

  const album = useAlbumStore((s) => s.getAlbumById(id ?? ""));
  const updateAlbum = useAlbumStore((s) => s.updateAlbum);
  const removeAlbum = useAlbumStore((s) => s.removeAlbum);
  const removeImageFromAlbum = useAlbumStore((s) => s.removeImageFromAlbum);
  const setCoverImage = useAlbumStore((s) => s.setCoverImage);
  const updateAlbumNotes = useAlbumStore((s) => s.updateAlbumNotes);
  const files = useFitsStore((s) => s.files);

  const albumFiles = useMemo(() => {
    if (!album) return [];
    return album.imageIds
      .map((imgId) => files.find((f) => f.id === imgId))
      .filter(Boolean) as FitsMetadata[];
  }, [album, files]);

  // Calculate statistics
  const statistics = useMemo<AlbumStatistics | null>(() => {
    if (!album || albumFiles.length === 0) return null;
    return calculateAlbumStatistics(album, files);
  }, [album, albumFiles.length, files]);

  const {
    isSelectionMode,
    selectedIds,
    toggleSelection,
    enterSelectionMode,
    exitSelectionMode,
    selectAll,
  } = useSelectionMode();
  const [showRenamePrompt, setShowRenamePrompt] = useState(false);
  const [showNotesEdit, setShowNotesEdit] = useState(false);
  const [showStatistics, setShowStatistics] = useState(false);
  const [notesValue, setNotesValue] = useState("");
  const allAlbumSelected =
    albumFiles.length > 0 && albumFiles.every((file) => selectedIds.includes(file.id));

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
        enterSelectionMode(file.id);
      }
    },
    [isSelectionMode, enterSelectionMode],
  );

  const handleRemoveSelected = useCallback(() => {
    if (!album || selectedIds.length === 0) return;
    Alert.alert(
      t("gallery.removeFromAlbum"),
      `${t("album.removeConfirm")} (${selectedIds.length})`,
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: () => {
            for (const imgId of selectedIds) {
              removeImageFromAlbum(album.id, imgId);
            }
            exitSelectionMode();
          },
        },
      ],
    );
  }, [album, selectedIds, t, removeImageFromAlbum, exitSelectionMode]);

  const handleSetCover = useCallback(() => {
    if (!album || selectedIds.length !== 1) return;
    setCoverImage(album.id, selectedIds[0]);
    exitSelectionMode();
  }, [album, selectedIds, setCoverImage, exitSelectionMode]);

  const handleSelectAllToggle = useCallback(() => {
    if (albumFiles.length === 0) return;
    if (allAlbumSelected) {
      selectAll([]);
      return;
    }
    selectAll(albumFiles.map((file) => file.id));
  }, [albumFiles, allAlbumSelected, selectAll]);

  const handleDeleteAlbum = useCallback(() => {
    if (!album) return;
    Alert.alert(t("album.deleteAlbum"), t("album.deleteConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: () => {
          removeAlbum(album.id);
          router.back();
        },
      },
    ]);
  }, [album, t, removeAlbum, router]);

  const handleRename = useCallback(() => {
    if (!album) return;
    setShowRenamePrompt(true);
  }, [album]);

  const handleEditNotes = useCallback(() => {
    if (!album) return;
    setNotesValue(album.notes ?? "");
    setShowNotesEdit(true);
  }, [album]);

  const albumColumns = isLandscapeTablet ? 6 : isLandscape ? 5 : 3;

  const AlbumHeader = useMemo(() => {
    if (!album) return null;
    return (
      <View className={isLandscape ? "gap-1.5" : "gap-3"}>
        {/* Top Bar */}
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <Button size="sm" variant="outline" onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={16} color={mutedColor} />
            </Button>
            {isLandscape && (
              <View className="flex-row items-center gap-1.5">
                <Text className="text-lg font-bold text-foreground" numberOfLines={1}>
                  {album.name}
                </Text>
                {album.isSmart && (
                  <View className="rounded bg-success/20 px-1.5 py-0.5">
                    <Ionicons name="sparkles" size={10} color={successColor} />
                  </View>
                )}
                <Text className="text-xs text-muted">
                  {albumFiles.length} {t("album.images")}
                </Text>
              </View>
            )}
          </View>
          <View className="flex-row gap-1">
            {isLandscape && statistics && (
              <Button size="sm" variant="outline" onPress={() => setShowStatistics(true)}>
                <Ionicons name="stats-chart-outline" size={14} color={successColor} />
              </Button>
            )}
            {isLandscape && (
              <Button size="sm" variant="outline" onPress={handleEditNotes}>
                <Ionicons name="document-text-outline" size={14} color={mutedColor} />
              </Button>
            )}
            <Button size="sm" variant="outline" onPress={handleRename}>
              <Ionicons name="pencil-outline" size={14} color={mutedColor} />
            </Button>
            <Button size="sm" variant="outline" onPress={handleDeleteAlbum}>
              <Ionicons name="trash-outline" size={14} color="#ef4444" />
            </Button>
          </View>
        </View>

        {/* Album Info — full in portrait, hidden in landscape (inline above) */}
        {!isLandscape && (
          <View>
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Text className="text-2xl font-bold text-foreground">{album.name}</Text>
                {album.isSmart && (
                  <View className="rounded bg-success/20 px-2 py-0.5">
                    <Ionicons name="sparkles" size={12} color={successColor} />
                  </View>
                )}
              </View>
              <View className="flex-row gap-1">
                {statistics && (
                  <Button size="sm" variant="ghost" onPress={() => setShowStatistics(true)}>
                    <Ionicons name="stats-chart-outline" size={14} color={successColor} />
                  </Button>
                )}
                <Button size="sm" variant="ghost" onPress={handleEditNotes}>
                  <Ionicons name="document-text-outline" size={14} color={mutedColor} />
                </Button>
              </View>
            </View>
            {album.description && (
              <Text className="mt-1 text-sm text-muted">{album.description}</Text>
            )}
            <View className="mt-2 flex-row items-center gap-3">
              <Text className="text-xs text-muted">
                {albumFiles.length} {t("album.images")}
              </Text>
              <Text className="text-xs text-muted">
                {t("album.created")}: {formatDate(album.createdAt)}
              </Text>
              {album.updatedAt !== album.createdAt && (
                <Text className="text-xs text-muted">
                  {t("album.updated")}: {formatDate(album.updatedAt)}
                </Text>
              )}
            </View>
            {/* Notes Display */}
            {album.notes && (
              <View className="mt-2 rounded-lg bg-surface-secondary p-2">
                <Text className="text-xs text-muted" numberOfLines={3}>
                  {album.notes}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Smart Album Rules */}
        {album.isSmart && album.smartRules && album.smartRules.length > 0 && (
          <View>
            <Text className="text-xs font-semibold text-muted mb-1">{t("album.rules")}</Text>
            <View className="flex-row flex-wrap gap-1">
              {album.smartRules.map((rule, i) => (
                <Chip key={i} size="sm" variant="secondary">
                  <Chip.Label className="text-[9px]">
                    {rule.field} {rule.operator} {String(rule.value)}
                  </Chip.Label>
                </Chip>
              ))}
            </View>
          </View>
        )}

        <Separator />

        {/* Selection Toolbar */}
        {isSelectionMode && (
          <View className="flex-row items-center justify-between rounded-xl bg-surface-secondary px-3 py-2">
            <Text className="text-xs text-foreground">
              {selectedIds.length} {t("album.selected")}
            </Text>
            <View className="flex-row gap-1">
              <Button size="sm" variant="outline" onPress={handleSelectAllToggle}>
                <Ionicons
                  name={allAlbumSelected ? "checkmark-done-outline" : "checkmark-outline"}
                  size={12}
                  color={mutedColor}
                />
                <Button.Label className="text-[10px]">
                  {allAlbumSelected ? t("common.deselectAll") : t("common.selectAll")}
                </Button.Label>
              </Button>
              {selectedIds.length === 1 && (
                <Button size="sm" variant="outline" onPress={handleSetCover}>
                  <Ionicons name="image-outline" size={12} color={mutedColor} />
                  <Button.Label className="text-[10px]">{t("gallery.setCover")}</Button.Label>
                </Button>
              )}
              <Button size="sm" variant="outline" onPress={handleRemoveSelected}>
                <Ionicons name="remove-circle-outline" size={12} color="#ef4444" />
                <Button.Label className="text-[10px]">{t("gallery.removeFromAlbum")}</Button.Label>
              </Button>
              <Button size="sm" variant="outline" onPress={exitSelectionMode}>
                <Ionicons name="close-outline" size={14} color={mutedColor} />
              </Button>
            </View>
          </View>
        )}
      </View>
    );
  }, [
    album,
    albumFiles.length,
    isSelectionMode,
    selectedIds,
    t,
    mutedColor,
    successColor,
    router,
    exitSelectionMode,
    allAlbumSelected,
    handleSelectAllToggle,
    handleSetCover,
    handleRemoveSelected,
    handleRename,
    handleDeleteAlbum,
    handleEditNotes,
    statistics,
    isLandscape,
  ]);

  if (!album) {
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
    <>
      <View
        className="flex-1 bg-background"
        style={{ paddingHorizontal: horizontalPadding, paddingTop: contentPaddingTop }}
      >
        {albumFiles.length === 0 ? (
          <View className="flex-1">
            {AlbumHeader}
            <EmptyState icon="images-outline" title={t("gallery.emptyAlbum")} />
          </View>
        ) : (
          <ThumbnailGrid
            files={albumFiles}
            columns={albumColumns}
            selectionMode={isSelectionMode}
            selectedIds={selectedIds}
            onPress={handleFilePress}
            onLongPress={handleFileLongPress}
            onSelect={toggleSelection}
            ListHeaderComponent={AlbumHeader}
          />
        )}
      </View>

      <PromptDialog
        visible={showRenamePrompt}
        title={t("album.rename")}
        defaultValue={album?.name ?? ""}
        onConfirm={(newName) => {
          if (album) updateAlbum(album.id, { name: newName });
          setShowRenamePrompt(false);
        }}
        onCancel={() => setShowRenamePrompt(false)}
      />

      {/* Notes Edit Dialog */}
      <PromptDialog
        visible={showNotesEdit}
        title={t("album.editNotes")}
        placeholder={t("album.notesPlaceholder")}
        defaultValue={notesValue}
        onConfirm={(notes) => {
          if (album) updateAlbumNotes(album.id, notes);
          setShowNotesEdit(false);
        }}
        onCancel={() => setShowNotesEdit(false)}
        multiline
        allowEmpty
      />

      {/* Statistics Sheet */}
      <AlbumStatisticsSheet
        visible={showStatistics}
        statistics={statistics}
        albumName={album?.name ?? ""}
        imageCount={albumFiles.length}
        onClose={() => setShowStatistics(false)}
      />
    </>
  );
}
