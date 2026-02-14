import { View, Text, ScrollView, Alert } from "react-native";
import { useState, useMemo, useCallback } from "react";
import { Button, Chip, Separator, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useI18n } from "../../i18n/useI18n";
import { useAlbumStore } from "../../stores/useAlbumStore";
import { useFitsStore } from "../../stores/useFitsStore";
import { ThumbnailGrid } from "../../components/gallery/ThumbnailGrid";
import { EmptyState } from "../../components/common/EmptyState";
import type { FitsMetadata } from "../../lib/fits/types";

export default function AlbumDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const [mutedColor, successColor] = useThemeColor(["muted", "success"]);

  const album = useAlbumStore((s) => s.getAlbumById(id ?? ""));
  const updateAlbum = useAlbumStore((s) => s.updateAlbum);
  const removeAlbum = useAlbumStore((s) => s.removeAlbum);
  const removeImageFromAlbum = useAlbumStore((s) => s.removeImageFromAlbum);
  const setCoverImage = useAlbumStore((s) => s.setCoverImage);
  const files = useFitsStore((s) => s.files);

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const albumFiles = useMemo(() => {
    if (!album) return [];
    return album.imageIds
      .map((imgId) => files.find((f) => f.id === imgId))
      .filter(Boolean) as FitsMetadata[];
  }, [album, files]);

  const toggleSelection = useCallback((fileId: string) => {
    setSelectedIds((prev) =>
      prev.includes(fileId) ? prev.filter((id) => id !== fileId) : [...prev, fileId],
    );
  }, []);

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

  const handleRemoveSelected = () => {
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
            setSelectedIds([]);
            setIsSelectionMode(false);
          },
        },
      ],
    );
  };

  const handleSetCover = () => {
    if (!album || selectedIds.length !== 1) return;
    setCoverImage(album.id, selectedIds[0]);
    setSelectedIds([]);
    setIsSelectionMode(false);
  };

  const handleDeleteAlbum = () => {
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
  };

  const handleRename = () => {
    if (!album) return;
    Alert.prompt?.(
      t("album.rename"),
      "",
      (newName: string) => {
        if (newName.trim()) {
          updateAlbum(album.id, { name: newName.trim() });
        }
      },
      "plain-text",
      album.name,
    );
  };

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

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="px-4 py-14">
      {/* Top Bar */}
      <View className="flex-row items-center justify-between mb-4">
        <Button size="sm" variant="outline" onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={16} color={mutedColor} />
        </Button>
        <View className="flex-row gap-1">
          <Button size="sm" variant="outline" onPress={handleRename}>
            <Ionicons name="pencil-outline" size={14} color={mutedColor} />
          </Button>
          <Button size="sm" variant="outline" onPress={handleDeleteAlbum}>
            <Ionicons name="trash-outline" size={14} color="#ef4444" />
          </Button>
        </View>
      </View>

      {/* Album Header */}
      <View className="mb-4">
        <View className="flex-row items-center gap-2">
          <Text className="text-2xl font-bold text-foreground">{album.name}</Text>
          {album.isSmart && (
            <View className="rounded bg-success/20 px-2 py-0.5">
              <Ionicons name="sparkles" size={12} color={successColor} />
            </View>
          )}
        </View>
        {album.description && <Text className="mt-1 text-sm text-muted">{album.description}</Text>}
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
      </View>

      {/* Smart Album Rules */}
      {album.isSmart && album.smartRules && album.smartRules.length > 0 && (
        <View className="mb-4">
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

      <Separator className="mb-4" />

      {/* Selection Toolbar */}
      {isSelectionMode && (
        <View className="flex-row items-center justify-between mb-3 rounded-xl bg-surface-secondary px-3 py-2">
          <Text className="text-xs text-foreground">
            {selectedIds.length} {t("album.selected")}
          </Text>
          <View className="flex-row gap-1">
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
            <Button
              size="sm"
              variant="outline"
              onPress={() => {
                setIsSelectionMode(false);
                setSelectedIds([]);
              }}
            >
              <Ionicons name="close-outline" size={14} color={mutedColor} />
            </Button>
          </View>
        </View>
      )}

      {/* Images Grid */}
      {albumFiles.length === 0 ? (
        <EmptyState icon="images-outline" title={t("gallery.emptyAlbum")} />
      ) : (
        <ThumbnailGrid
          files={albumFiles}
          columns={3}
          selectionMode={isSelectionMode}
          selectedIds={selectedIds}
          onPress={handleFilePress}
          onLongPress={handleFileLongPress}
          onSelect={toggleSelection}
        />
      )}
    </ScrollView>
  );
}
