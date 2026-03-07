import { useCallback, useMemo, useState } from "react";
import { ScrollView, View, Text } from "react-native";
import { BottomSheet, Button, Card, Chip, Separator, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";
import { useFileGroupStore } from "../../stores/files/useFileGroupStore";
import { useFitsStore } from "../../stores/files/useFitsStore";
import { formatFileSize } from "../../lib/utils/fileManager";

interface FolderPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (groupId: string) => void;
  title?: string;
  actionLabel?: string;
}

export function FolderPickerSheet({
  visible,
  onClose,
  onSelect,
  title,
  actionLabel,
}: FolderPickerSheetProps) {
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");
  const getChildGroups = useFileGroupStore((s) => s.getChildGroups);
  const getGroupPath = useFileGroupStore((s) => s.getGroupPath);
  const getGroupStats = useFileGroupStore((s) => s.getGroupStats);
  const groups = useFileGroupStore((s) => s.groups);
  const allFiles = useFitsStore((s) => s.files);

  const [currentParentId, setCurrentParentId] = useState<string | undefined>(undefined);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");

  const displayGroups = useMemo(
    () => getChildGroups(currentParentId),
    [getChildGroups, currentParentId],
  );
  const breadcrumb = useMemo(
    () => (currentParentId ? getGroupPath(currentParentId) : []),
    [getGroupPath, currentParentId],
  );

  const handleClose = useCallback(() => {
    setSelectedGroupId("");
    setCurrentParentId(undefined);
    onClose();
  }, [onClose]);

  const handleConfirm = useCallback(() => {
    if (!selectedGroupId) return;
    onSelect(selectedGroupId);
    handleClose();
  }, [selectedGroupId, onSelect, handleClose]);

  const navigateUp = useCallback(() => {
    if (!currentParentId) return;
    const parent = groups.find((g) => g.id === currentParentId);
    setCurrentParentId(parent?.parentId);
  }, [currentParentId, groups]);

  return (
    <BottomSheet isOpen={visible} onOpenChange={(open) => !open && handleClose()}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content snapPoints={["65%"]}>
          <View className="px-4 py-2">
            <BottomSheet.Title>{title ?? t("files.moveToFolder")}</BottomSheet.Title>
          </View>

          {(currentParentId || breadcrumb.length > 0) && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-4 mb-2">
              <View className="flex-row items-center gap-1">
                <Chip size="sm" variant="secondary" onPress={() => setCurrentParentId(undefined)}>
                  <Ionicons name="home-outline" size={10} color={mutedColor} />
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
          )}

          <Separator />

          <ScrollView style={{ maxHeight: 380 }} className="px-4 py-2">
            {currentParentId && (
              <Button variant="ghost" size="sm" onPress={navigateUp} className="self-start mb-2">
                <Ionicons name="arrow-back" size={14} color={mutedColor} />
                <Button.Label className="text-xs">{t("common.back")}</Button.Label>
              </Button>
            )}
            {displayGroups.length === 0 ? (
              <View className="items-center py-8">
                <Ionicons name="folder-outline" size={32} color={mutedColor} />
                <Text className="text-sm text-muted mt-2">{t("files.noGroups")}</Text>
              </View>
            ) : (
              <View className="gap-2">
                {displayGroups.map((group) => {
                  const stats = getGroupStats(group.id, allFiles);
                  const childCount = getChildGroups(group.id).length;
                  const isSelected = selectedGroupId === group.id;
                  return (
                    <Card
                      key={group.id}
                      variant="secondary"
                      className={isSelected ? "border border-success" : ""}
                    >
                      <Card.Body className="p-3">
                        <View className="flex-row items-center justify-between">
                          <View className="flex-row items-center gap-2 flex-1">
                            <View
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: group.color ?? "#888" }}
                            />
                            <View className="flex-1">
                              <Text className="text-sm font-medium text-foreground">
                                {group.name}
                              </Text>
                              <Text className="text-[10px] text-muted">
                                {stats.fileCount} {t("album.images")}
                                {stats.totalSize > 0 && ` · ${formatFileSize(stats.totalSize)}`}
                              </Text>
                            </View>
                          </View>
                          <View className="flex-row gap-1">
                            {childCount > 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                isIconOnly
                                onPress={() => setCurrentParentId(group.id)}
                              >
                                <Ionicons name="chevron-forward" size={14} color={mutedColor} />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              isIconOnly
                              onPress={() => setSelectedGroupId(isSelected ? "" : group.id)}
                            >
                              <Ionicons
                                name={isSelected ? "checkmark-circle" : "radio-button-off"}
                                size={18}
                                color={isSelected ? "#22c55e" : mutedColor}
                              />
                            </Button>
                          </View>
                        </View>
                      </Card.Body>
                    </Card>
                  );
                })}
              </View>
            )}
          </ScrollView>

          <Separator />
          <View className="px-4 py-3 flex-row gap-2">
            <Button variant="outline" className="flex-1" onPress={handleClose}>
              <Button.Label>{t("common.cancel")}</Button.Label>
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onPress={handleConfirm}
              isDisabled={!selectedGroupId}
            >
              <Button.Label>{actionLabel ?? t("files.moveToFolder")}</Button.Label>
            </Button>
          </View>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
