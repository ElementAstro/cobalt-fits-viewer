/**
 * 相簿合并面板
 */

import { View, Text, ScrollView, Alert } from "react-native";
import { useEffect, useMemo, useState } from "react";
import { BottomSheet, Button, Input, Separator, TextField, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";
import {
  getMergeAddedImageCount,
  getMergedImageCount,
  getMergeTargetAlbums,
} from "../../lib/gallery/albumMerge";
import type { Album } from "../../lib/fits/types";

interface AlbumMergeSheetProps {
  visible: boolean;
  sourceAlbum: Album | null;
  albums: Album[];
  onClose: () => void;
  onMerge: (targetAlbumId: string) => void;
}

export function AlbumMergeSheet({
  visible,
  sourceAlbum,
  albums,
  onClose,
  onMerge,
}: AlbumMergeSheetProps) {
  const { t } = useI18n();
  const [mutedColor, successColor, dangerColor] = useThemeColor(["muted", "success", "danger"]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!visible) {
      setQuery("");
    }
  }, [visible]);

  const targetAlbums = useMemo(
    () => (sourceAlbum ? getMergeTargetAlbums(albums, sourceAlbum, query) : []),
    [albums, sourceAlbum, query],
  );
  if (!sourceAlbum) return null;

  const isSourceSmart = sourceAlbum.isSmart;

  const handleMerge = (target: Album) => {
    Alert.alert(
      t("album.mergeTitle"),
      t("album.mergeConfirm")
        .replace("{source}", sourceAlbum.name)
        .replace("{target}", target.name),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.confirm"),
          onPress: () => {
            onMerge(target.id);
            onClose();
          },
        },
      ],
    );
  };

  return (
    <BottomSheet isOpen={visible} onOpenChange={(open) => !open && onClose()}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content snapPoints={["50%"]}>
          <View className="flex-1 bg-background px-4 pt-2">
            {/* Header */}
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-row items-center gap-2">
                <Ionicons name="git-merge" size={20} color={successColor} />
                <BottomSheet.Title>{t("album.mergeAlbum")}</BottomSheet.Title>
              </View>
              <Button size="sm" variant="ghost" isIconOnly onPress={onClose}>
                <Ionicons name="close" size={20} color={mutedColor} />
              </Button>
            </View>

            {/* Source Album Info */}
            <View className="rounded-xl bg-surface-secondary p-3 mb-4">
              <Text className="text-xs text-muted mb-1">{t("album.mergeTitle")}</Text>
              <View className="flex-row items-center gap-2">
                <Ionicons name="albums-outline" size={16} color={successColor} />
                <Text className="text-base font-semibold text-foreground">{sourceAlbum.name}</Text>
                <Text className="text-xs text-muted">
                  ({sourceAlbum.imageIds.length} {t("album.images")})
                </Text>
              </View>
            </View>

            <Separator className="mb-4" />

            {/* Target Albums */}
            <Text className="text-sm font-semibold text-foreground mb-2">
              {t("album.mergeAlbum")}
            </Text>

            {!isSourceSmart && (
              <View className="mb-3">
                <TextField>
                  <View className="w-full flex-row items-center">
                    <Input
                      testID="merge-target-search"
                      className="flex-1 pl-9 pr-9"
                      placeholder={t("album.mergeSearchPlaceholder")}
                      value={query}
                      onChangeText={setQuery}
                      autoCorrect={false}
                    />
                    <Ionicons
                      name="search-outline"
                      size={16}
                      color={mutedColor}
                      style={{ position: "absolute", left: 12 }}
                    />
                    {query.length > 0 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        isIconOnly
                        onPress={() => setQuery("")}
                        style={{ position: "absolute", right: 12 }}
                      >
                        <Ionicons name="close-circle" size={16} color={mutedColor} />
                      </Button>
                    )}
                  </View>
                </TextField>
              </View>
            )}

            {isSourceSmart ? (
              <View className="flex-1 items-center justify-center py-8">
                <Ionicons name="warning" size={48} color={dangerColor} />
                <Text className="mt-2 text-sm text-danger">{t("album.cannotMergeSmart")}</Text>
              </View>
            ) : targetAlbums.length === 0 ? (
              <View className="flex-1 items-center justify-center py-8">
                <Ionicons name="albums-outline" size={48} color={mutedColor} />
                <Text className="mt-2 text-sm text-muted">
                  {query ? t("album.mergeNoTargets") : t("album.noAlbums")}
                </Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {targetAlbums.map((album) => {
                  const mergedCount = getMergedImageCount(sourceAlbum, album);
                  const addedCount = getMergeAddedImageCount(sourceAlbum, album);

                  return (
                    <Button
                      key={album.id}
                      testID={`merge-target-${album.id}`}
                      variant="ghost"
                      className="w-full justify-start mb-2 p-3 rounded-xl bg-surface-secondary"
                      onPress={() => handleMerge(album)}
                    >
                      <View className="flex-row items-center justify-between flex-1">
                        <View className="flex-row items-center gap-2">
                          <Ionicons name="albums-outline" size={18} color={mutedColor} />
                          <Text className="text-base text-foreground flex-1" numberOfLines={1}>
                            {album.name}
                          </Text>
                          {album.isPinned && <Ionicons name="pin" size={12} color={successColor} />}
                        </View>
                        <View className="flex-row items-center gap-2 shrink-0">
                          <Text className="text-xs text-muted">
                            {album.imageIds.length} {t("album.images")}
                          </Text>
                          <Ionicons name="chevron-forward" size={16} color={mutedColor} />
                        </View>
                      </View>
                      <Text className="mt-1 text-xs text-muted text-left w-full">
                        {t("album.mergeWillContain").replace("{count}", String(mergedCount))}
                      </Text>
                      <Text className="mt-0.5 text-xs text-muted text-left w-full">
                        {addedCount > 0
                          ? t("album.mergeWillAdd").replace("{count}", String(addedCount))
                          : t("album.mergeNoNewImages")}
                      </Text>
                    </Button>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
