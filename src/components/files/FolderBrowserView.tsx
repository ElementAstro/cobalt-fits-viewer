import { useCallback, useMemo, useState } from "react";
import { ScrollView, View, Text, Pressable } from "react-native";
import { Button, Card, Chip, Separator, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";
import { useFileGroupStore } from "../../stores/useFileGroupStore";
import { useFitsStore } from "../../stores/useFitsStore";
import { ThumbnailGrid } from "../gallery/ThumbnailGrid";
import { EmptyState } from "../common/EmptyState";
import type { FitsMetadata } from "../../lib/fits/types";

interface FolderBrowserViewProps {
  horizontalPadding: number;
  contentPaddingTop: number;
  isLandscape: boolean;
  isSelectionMode: boolean;
  selectedIds: string[];
  gridColumns: number;
  onFilePress: (file: FitsMetadata) => void;
  onFileLongPress: (file: FitsMetadata) => void;
  onToggleSelection: (id: string) => void;
  onImport: () => void;
  onManageFolders: () => void;
}

export function FolderBrowserView({
  horizontalPadding,
  contentPaddingTop,
  isLandscape,
  isSelectionMode,
  selectedIds,
  gridColumns,
  onFilePress,
  onFileLongPress,
  onToggleSelection,
  onImport,
  onManageFolders,
}: FolderBrowserViewProps) {
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");
  const allFiles = useFitsStore((s) => s.files);

  const groups = useFileGroupStore((s) => s.groups);
  const fileGroupMap = useFileGroupStore((s) => s.fileGroupMap);
  const getChildGroups = useFileGroupStore((s) => s.getChildGroups);
  const getGroupStats = useFileGroupStore((s) => s.getGroupStats);

  const [currentParentId, setCurrentParentId] = useState<string | undefined>(undefined);
  const getGroupPath = useFileGroupStore((s) => s.getGroupPath);

  const breadcrumb = useMemo(
    () => (currentParentId ? getGroupPath(currentParentId) : []),
    [getGroupPath, currentParentId],
  );

  const currentGroups = useMemo(
    () => getChildGroups(currentParentId),
    [getChildGroups, currentParentId],
  );

  const filesInCurrentGroup = useMemo(() => {
    if (!currentParentId) {
      const assignedFileIds = new Set(Object.keys(fileGroupMap));
      return allFiles.filter((f) => !assignedFileIds.has(f.id));
    }
    const fileIds = new Set<string>();
    for (const [fileId, groupIds] of Object.entries(fileGroupMap)) {
      if (groupIds.includes(currentParentId)) {
        fileIds.add(fileId);
      }
    }
    return allFiles.filter((f) => fileIds.has(f.id));
  }, [allFiles, currentParentId, fileGroupMap]);

  const navigateUp = useCallback(() => {
    if (!currentParentId) return;
    const parent = groups.find((g) => g.id === currentParentId);
    setCurrentParentId(parent?.parentId);
  }, [currentParentId, groups]);

  if (groups.length === 0 && allFiles.length === 0) {
    return (
      <View
        className="flex-1"
        style={{ paddingHorizontal: horizontalPadding, paddingTop: contentPaddingTop }}
      >
        <EmptyState
          icon="folder-outline"
          title={t("files.emptyState")}
          description={t("files.emptyHint")}
          actionLabel={t("files.importFile")}
          onAction={onImport}
        />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{
        paddingHorizontal: horizontalPadding,
        paddingTop: isLandscape ? 8 : contentPaddingTop,
        paddingBottom: 24,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* Breadcrumb */}
      <View className="flex-row items-center justify-between mb-2">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-1">
          <View className="flex-row items-center gap-1">
            <Chip
              size="sm"
              variant={!currentParentId ? "primary" : "secondary"}
              onPress={() => setCurrentParentId(undefined)}
            >
              <Ionicons
                name="home-outline"
                size={10}
                color={!currentParentId ? "#fff" : mutedColor}
              />
              <Chip.Label className="text-[10px]">{t("common.root")}</Chip.Label>
            </Chip>
            {breadcrumb.map((g) => (
              <View key={g.id} className="flex-row items-center gap-1">
                <Ionicons name="chevron-forward" size={10} color={mutedColor} />
                <Chip
                  size="sm"
                  variant={g.id === currentParentId ? "primary" : "secondary"}
                  onPress={() => setCurrentParentId(g.id)}
                >
                  <Chip.Label className="text-[10px]">{g.name}</Chip.Label>
                </Chip>
              </View>
            ))}
          </View>
        </ScrollView>
        <Button variant="ghost" size="sm" isIconOnly onPress={onManageFolders}>
          <Ionicons name="settings-outline" size={14} color={mutedColor} />
        </Button>
      </View>

      {/* Back button */}
      {currentParentId && (
        <Button variant="ghost" size="sm" onPress={navigateUp} className="self-start mb-2">
          <Ionicons name="arrow-back" size={14} color={mutedColor} />
          <Button.Label className="text-xs">{t("common.back")}</Button.Label>
        </Button>
      )}

      {/* Sub-folders */}
      {currentGroups.length > 0 && (
        <View className="mb-3 gap-2">
          <Text className="text-[10px] font-semibold uppercase text-muted">
            {t("files.folders")} ({currentGroups.length})
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {currentGroups.map((group) => {
              const stats = getGroupStats(group.id, allFiles);
              const childCount = getChildGroups(group.id).length;
              return (
                <Pressable key={group.id} onPress={() => setCurrentParentId(group.id)}>
                  <Card variant="secondary" style={{ width: isLandscape ? 160 : 140 }}>
                    <Card.Body className="p-3">
                      <View className="flex-row items-center gap-2">
                        <Ionicons
                          name={(group.icon as keyof typeof Ionicons.glyphMap) ?? "folder"}
                          size={20}
                          color={group.color ?? mutedColor}
                        />
                        <View className="flex-1">
                          <Text className="text-xs font-semibold text-foreground" numberOfLines={1}>
                            {group.name}
                          </Text>
                          <Text className="text-[10px] text-muted">
                            {stats.fileCount} {t("album.images")}
                            {childCount > 0 && ` · ${childCount} ${t("files.subfolders")}`}
                          </Text>
                        </View>
                      </View>
                    </Card.Body>
                  </Card>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      <Separator className="mb-3" />

      {/* Files in current folder */}
      <Text className="text-[10px] font-semibold uppercase text-muted mb-2">
        {currentParentId ? t("album.images") : t("files.ungroupedFiles")} (
        {filesInCurrentGroup.length})
      </Text>

      {filesInCurrentGroup.length === 0 ? (
        <View className="items-center py-8">
          <Ionicons name="documents-outline" size={32} color={mutedColor} />
          <Text className="text-sm text-muted mt-2">{t("files.folderEmpty")}</Text>
        </View>
      ) : (
        <ThumbnailGrid
          files={filesInCurrentGroup}
          columns={gridColumns}
          selectionMode={isSelectionMode}
          selectedIds={selectedIds}
          onPress={onFilePress}
          onLongPress={onFileLongPress}
          onSelect={onToggleSelection}
          scrollEnabled={false}
        />
      )}
    </ScrollView>
  );
}
