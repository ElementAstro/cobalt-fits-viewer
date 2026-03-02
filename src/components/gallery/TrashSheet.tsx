import { useCallback, useMemo, useState } from "react";
import { ScrollView, View, Text, Pressable } from "react-native";
import { BottomSheet, Button, Chip, Separator, useThemeColor } from "heroui-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";
import type { TrashedFitsRecord } from "../../lib/fits/types";
import { formatFileSize } from "../../lib/utils/fileManager";
import { resolveThumbnailUri } from "../../lib/gallery/thumbnailCache";

type TrashSortBy = "deletedAt" | "filename" | "fileSize";

interface TrashSheetProps {
  visible: boolean;
  items: TrashedFitsRecord[];
  onClose: () => void;
  onRestore: (trashIds: string[]) => void;
  onDeleteForever: (trashIds?: string[]) => void;
}

function formatExpireTime(expireAt: number): string {
  const delta = expireAt - Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  if (delta <= 0) return "0d";
  const days = Math.ceil(delta / dayMs);
  return `${days}d`;
}

export function TrashSheet({
  visible,
  items,
  onClose,
  onRestore,
  onDeleteForever,
}: TrashSheetProps) {
  const { t } = useI18n();
  const [mutedColor, dangerColor, successColor] = useThemeColor(["muted", "danger", "success"]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<TrashSortBy>("deletedAt");

  const isSelectionMode = selectedIds.size > 0;

  const toggleSelection = useCallback((trashId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(trashId)) {
        next.delete(trashId);
      } else {
        next.add(trashId);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const sortedItems = useMemo(() => {
    const sorted = [...items];
    switch (sortBy) {
      case "deletedAt":
        sorted.sort((a, b) => b.deletedAt - a.deletedAt);
        break;
      case "filename":
        sorted.sort((a, b) => a.file.filename.localeCompare(b.file.filename));
        break;
      case "fileSize":
        sorted.sort((a, b) => b.file.fileSize - a.file.fileSize);
        break;
    }
    return sorted;
  }, [items, sortBy]);

  const totalSize = useMemo(
    () => items.reduce((sum, item) => sum + item.file.fileSize, 0),
    [items],
  );

  const handleRestoreSelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    onRestore([...selectedIds]);
    clearSelection();
  }, [selectedIds, onRestore, clearSelection]);

  const handleDeleteSelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    onDeleteForever([...selectedIds]);
    clearSelection();
  }, [selectedIds, onDeleteForever, clearSelection]);

  return (
    <BottomSheet isOpen={visible} onOpenChange={(open) => !open && onClose()}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content snapPoints={["70%"]}>
          <View className="px-4 py-1">
            <BottomSheet.Title>{t("files.trashTitle")}</BottomSheet.Title>
            <Text className="text-xs text-muted">
              {t("files.filesCount", { count: items.length })} · {formatFileSize(totalSize)}
            </Text>
          </View>

          {items.length > 0 && (
            <View className="flex-row items-center gap-1.5 px-4 py-1">
              <Chip
                size="sm"
                variant={sortBy === "deletedAt" ? "primary" : "secondary"}
                onPress={() => setSortBy("deletedAt")}
              >
                <Chip.Label className="text-[10px]">{t("common.date")}</Chip.Label>
              </Chip>
              <Chip
                size="sm"
                variant={sortBy === "filename" ? "primary" : "secondary"}
                onPress={() => setSortBy("filename")}
              >
                <Chip.Label className="text-[10px]">{t("common.name")}</Chip.Label>
              </Chip>
              <Chip
                size="sm"
                variant={sortBy === "fileSize" ? "primary" : "secondary"}
                onPress={() => setSortBy("fileSize")}
              >
                <Chip.Label className="text-[10px]">{t("common.size")}</Chip.Label>
              </Chip>
              {isSelectionMode && (
                <Chip size="sm" variant="secondary" onPress={clearSelection}>
                  <Chip.Label className="text-[10px]">
                    {t("common.cancel")} ({selectedIds.size})
                  </Chip.Label>
                </Chip>
              )}
            </View>
          )}

          <Separator className="my-1" />

          {items.length === 0 ? (
            <View className="items-center py-12">
              <Ionicons name="trash-bin-outline" size={32} color={mutedColor} />
              <Text className="mt-3 text-sm text-muted">{t("files.trashEmpty")}</Text>
            </View>
          ) : (
            <ScrollView style={{ maxHeight: 400 }}>
              <View className="gap-2 px-4 pb-2">
                {sortedItems.map((item) => {
                  const selected = selectedIds.has(item.trashId);
                  const thumbUri = resolveThumbnailUri(item.file.id, item.file.thumbnailUri);
                  return (
                    <Pressable
                      key={item.trashId}
                      onLongPress={() => toggleSelection(item.trashId)}
                      onPress={isSelectionMode ? () => toggleSelection(item.trashId) : undefined}
                    >
                      <View
                        className={`rounded-xl bg-surface-secondary px-3 py-2.5 flex-row items-center gap-2 ${selected ? "border border-success" : ""}`}
                      >
                        {isSelectionMode && (
                          <Ionicons
                            name={selected ? "checkmark-circle" : "ellipse-outline"}
                            size={20}
                            color={selected ? successColor : mutedColor}
                          />
                        )}
                        <View className="h-9 w-9 items-center justify-center overflow-hidden rounded-md bg-success/10">
                          {thumbUri ? (
                            <Image
                              source={{ uri: thumbUri }}
                              className="h-full w-full"
                              contentFit="cover"
                              cachePolicy="memory-disk"
                            />
                          ) : (
                            <Ionicons name="image-outline" size={16} color={mutedColor} />
                          )}
                        </View>
                        <View className="flex-1">
                          <Text className="text-sm text-foreground" numberOfLines={1}>
                            {item.file.filename}
                          </Text>
                          <Text className="text-[11px] text-muted">
                            {formatFileSize(item.file.fileSize)} · {t("files.trashExpires")}{" "}
                            {formatExpireTime(item.expireAt)}
                          </Text>
                        </View>
                        {!isSelectionMode && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onPress={() => onRestore([item.trashId])}
                            >
                              <Button.Label>{t("files.restore")}</Button.Label>
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onPress={() => onDeleteForever([item.trashId])}
                            >
                              <Ionicons name="trash-outline" size={16} color={dangerColor} />
                            </Button>
                          </>
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          )}

          <Separator className="my-2" />
          <View className="px-4 pb-3 flex-row gap-2">
            {isSelectionMode ? (
              <>
                <Button variant="outline" className="flex-1" onPress={handleRestoreSelected}>
                  <Button.Label>
                    {t("files.restore")} ({selectedIds.size})
                  </Button.Label>
                </Button>
                <Button variant="primary" className="flex-1" onPress={handleDeleteSelected}>
                  <Ionicons name="trash-outline" size={14} color="#fff" />
                  <Button.Label>
                    {t("common.delete")} ({selectedIds.size})
                  </Button.Label>
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  className="flex-1"
                  onPress={() => onRestore(items.map((item) => item.trashId))}
                  isDisabled={items.length === 0}
                >
                  <Button.Label>{t("files.restoreAll")}</Button.Label>
                </Button>
                <Button
                  variant="primary"
                  className="flex-1"
                  onPress={() => onDeleteForever()}
                  isDisabled={items.length === 0}
                >
                  <Button.Label>{t("files.emptyTrash")}</Button.Label>
                </Button>
              </>
            )}
          </View>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
