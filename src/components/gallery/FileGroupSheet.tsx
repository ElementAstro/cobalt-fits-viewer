import { useCallback, useMemo, useState } from "react";
import { Alert, ScrollView, View, Text } from "react-native";
import {
  BottomSheet,
  Button,
  Card,
  Chip,
  Dialog,
  Input,
  Label,
  Separator,
  useThemeColor,
} from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "../../i18n/useI18n";
import { useFileGroupStore } from "../../stores/useFileGroupStore";
import { useFitsStore } from "../../stores/useFitsStore";
import { GroupColorPicker, GROUP_COLORS } from "../common/GroupColorPicker";
import { formatFileSize } from "../../lib/utils/fileManager";
import type { FileGroup } from "../../lib/fits/types";

type SheetMode = "select" | "manage";

interface FileGroupSheetProps {
  visible: boolean;
  selectedCount: number;
  onClose: () => void;
  onApplyGroup: (groupId: string) => { success: number; failed: number };
}

export function FileGroupSheet({
  visible,
  selectedCount,
  onClose,
  onApplyGroup,
}: FileGroupSheetProps) {
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");
  const dangerColor = useThemeColor("danger");
  const insets = useSafeAreaInsets();

  const groups = useFileGroupStore((s) => s.groups);
  const createGroup = useFileGroupStore((s) => s.createGroup);
  const updateGroup = useFileGroupStore((s) => s.updateGroup);
  const removeGroup = useFileGroupStore((s) => s.removeGroup);
  const getGroupStats = useFileGroupStore((s) => s.getGroupStats);
  const getChildGroups = useFileGroupStore((s) => s.getChildGroups);
  const getGroupPath = useFileGroupStore((s) => s.getGroupPath);
  const allFiles = useFitsStore((s) => s.files);

  const [mode, setMode] = useState<SheetMode>("select");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [currentParentId, setCurrentParentId] = useState<string | undefined>(undefined);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newColor, setNewColor] = useState(GROUP_COLORS[0]);

  // Edit
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editColor, setEditColor] = useState(GROUP_COLORS[0]);

  // Delete confirm
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null);
  const deleteGroup = deleteGroupId ? groups.find((g) => g.id === deleteGroupId) : null;

  const displayGroups = useMemo(
    () => getChildGroups(currentParentId),
    [getChildGroups, currentParentId],
  );

  const breadcrumb = useMemo(
    () => (currentParentId ? getGroupPath(currentParentId) : []),
    [getGroupPath, currentParentId],
  );

  const handleCreate = useCallback(() => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const groupId = createGroup(trimmed, {
      color: newColor,
      description: newDescription.trim() || undefined,
      parentId: currentParentId,
    });
    setSelectedGroupId(groupId);
    setNewName("");
    setNewDescription("");
    setNewColor(GROUP_COLORS[0]);
    setShowCreate(false);
  }, [createGroup, currentParentId, newColor, newDescription, newName]);

  const startEdit = useCallback((group: FileGroup) => {
    setEditingGroupId(group.id);
    setEditName(group.name);
    setEditDescription(group.description ?? "");
    setEditColor(group.color ?? GROUP_COLORS[0]);
  }, []);

  const saveEdit = useCallback(() => {
    if (!editingGroupId || !editName.trim()) return;
    updateGroup(editingGroupId, {
      name: editName.trim(),
      description: editDescription.trim() || undefined,
      color: editColor,
    });
    setEditingGroupId(null);
  }, [editColor, editDescription, editName, editingGroupId, updateGroup]);

  const handleClose = useCallback(() => {
    setSelectedGroupId("");
    setShowCreate(false);
    setEditingGroupId(null);
    setCurrentParentId(undefined);
    setMode("select");
    onClose();
  }, [onClose]);

  const handleApply = useCallback(() => {
    if (!selectedGroupId) return;
    const result = onApplyGroup(selectedGroupId);
    if (result.success > 0) {
      Alert.alert(
        t("common.success"),
        t("files.groupPartial", { success: result.success, failed: result.failed }),
      );
      handleClose();
      return;
    }
    Alert.alert(
      t("common.error"),
      t("files.groupPartial", { success: result.success, failed: result.failed }),
    );
  }, [selectedGroupId, onApplyGroup, t, handleClose]);

  const navigateInto = useCallback((groupId: string) => {
    setCurrentParentId(groupId);
  }, []);

  const navigateUp = useCallback(() => {
    if (!currentParentId) return;
    const parent = groups.find((g) => g.id === currentParentId);
    setCurrentParentId(parent?.parentId);
  }, [currentParentId, groups]);

  return (
    <BottomSheet isOpen={visible} onOpenChange={(open) => !open && handleClose()}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content
          detached
          bottomInset={insets.bottom + 8}
          snapPoints={["85%"]}
          className="mx-4"
          backgroundClassName="rounded-[28px] bg-background"
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: insets.bottom + 20,
            }}
          >
            {/* Header */}
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-1">
                <BottomSheet.Title>{t("files.groupFiles")}</BottomSheet.Title>
                {selectedCount > 0 && (
                  <Text className="text-xs text-muted">
                    {selectedCount} {t("common.selected")}
                  </Text>
                )}
              </View>
              <View className="flex-row gap-1">
                <Chip
                  size="sm"
                  variant={mode === "select" ? "primary" : "secondary"}
                  onPress={() => setMode("select")}
                >
                  <Chip.Label className="text-[10px]">{t("common.select")}</Chip.Label>
                </Chip>
                <Chip
                  size="sm"
                  variant={mode === "manage" ? "primary" : "secondary"}
                  onPress={() => setMode("manage")}
                >
                  <Chip.Label className="text-[10px]">{t("common.manage")}</Chip.Label>
                </Chip>
              </View>
            </View>

            {/* Breadcrumb */}
            {(currentParentId || breadcrumb.length > 0) && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2">
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

            {/* Create New Group (manage mode) */}
            {mode === "manage" && (
              <>
                {!showCreate ? (
                  <Button variant="outline" className="mb-3" onPress={() => setShowCreate(true)}>
                    <Ionicons name="add" size={16} color={mutedColor} />
                    <Button.Label>{t("files.createGroup")}</Button.Label>
                  </Button>
                ) : (
                  <Card variant="secondary" className="mb-3">
                    <Card.Body className="p-4 gap-3">
                      <Label>{t("common.name")}</Label>
                      <Input
                        placeholder={t("files.groupNamePlaceholder")}
                        value={newName}
                        onChangeText={setNewName}
                        autoFocus
                        autoCorrect={false}
                      />
                      <Label>{t("common.description")}</Label>
                      <Input
                        placeholder={t("common.optional")}
                        value={newDescription}
                        onChangeText={setNewDescription}
                        autoCorrect={false}
                      />
                      <Label>{t("common.color")}</Label>
                      <GroupColorPicker selectedColor={newColor} onSelect={setNewColor} />
                      <View className="flex-row gap-2 mt-2">
                        <Button
                          variant="ghost"
                          className="flex-1"
                          onPress={() => setShowCreate(false)}
                        >
                          <Button.Label>{t("common.cancel")}</Button.Label>
                        </Button>
                        <Button
                          variant="primary"
                          className="flex-1"
                          onPress={handleCreate}
                          isDisabled={!newName.trim()}
                        >
                          <Button.Label>{t("common.confirm")}</Button.Label>
                        </Button>
                      </View>
                    </Card.Body>
                  </Card>
                )}
              </>
            )}

            <Separator className="mb-3" />

            {/* Group List */}
            {displayGroups.length === 0 ? (
              <View className="items-center py-6">
                <Ionicons name="folder-outline" size={32} color={mutedColor} />
                <Text className="text-sm text-muted mt-2">{t("files.noGroups")}</Text>
              </View>
            ) : (
              <View className="gap-2">
                {currentParentId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onPress={navigateUp}
                    className="self-start mb-1"
                  >
                    <Ionicons name="arrow-back" size={14} color={mutedColor} />
                    <Button.Label className="text-xs">{t("common.back")}</Button.Label>
                  </Button>
                )}
                {displayGroups.map((group) => {
                  const stats = getGroupStats(group.id, allFiles);
                  const childCount = getChildGroups(group.id).length;
                  const isEditing = editingGroupId === group.id;

                  return (
                    <Card
                      key={group.id}
                      variant="secondary"
                      className={selectedGroupId === group.id ? "border border-success" : ""}
                    >
                      <Card.Body className="p-3">
                        {isEditing ? (
                          <View className="gap-2">
                            <Input
                              value={editName}
                              onChangeText={setEditName}
                              autoCorrect={false}
                            />
                            <Input
                              value={editDescription}
                              onChangeText={setEditDescription}
                              placeholder={t("common.description")}
                              autoCorrect={false}
                            />
                            <GroupColorPicker selectedColor={editColor} onSelect={setEditColor} />
                            <View className="flex-row gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onPress={() => setEditingGroupId(null)}
                              >
                                <Button.Label>{t("common.cancel")}</Button.Label>
                              </Button>
                              <Button
                                variant="primary"
                                size="sm"
                                onPress={saveEdit}
                                isDisabled={!editName.trim()}
                              >
                                <Button.Label>{t("common.save")}</Button.Label>
                              </Button>
                            </View>
                          </View>
                        ) : (
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
                                {group.description && (
                                  <Text className="text-xs text-muted" numberOfLines={1}>
                                    {group.description}
                                  </Text>
                                )}
                                <Text className="text-[10px] text-muted mt-0.5">
                                  {stats.fileCount} {t("album.images")}
                                  {stats.totalSize > 0 && ` · ${formatFileSize(stats.totalSize)}`}
                                  {childCount > 0 && ` · ${childCount} ${t("files.subfolders")}`}
                                </Text>
                              </View>
                            </View>
                            <View className="flex-row gap-0.5">
                              {childCount > 0 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  isIconOnly
                                  onPress={() => navigateInto(group.id)}
                                >
                                  <Ionicons name="chevron-forward" size={14} color={mutedColor} />
                                </Button>
                              )}
                              {mode === "select" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  isIconOnly
                                  onPress={() =>
                                    setSelectedGroupId(selectedGroupId === group.id ? "" : group.id)
                                  }
                                >
                                  <Ionicons
                                    name={
                                      selectedGroupId === group.id
                                        ? "checkmark-circle"
                                        : "add-circle-outline"
                                    }
                                    size={18}
                                    color={selectedGroupId === group.id ? "#22c55e" : mutedColor}
                                  />
                                </Button>
                              )}
                              {mode === "manage" && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    isIconOnly
                                    onPress={() => startEdit(group)}
                                  >
                                    <Ionicons name="create-outline" size={14} color={mutedColor} />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    isIconOnly
                                    onPress={() => setDeleteGroupId(group.id)}
                                  >
                                    <Ionicons name="trash-outline" size={14} color={dangerColor} />
                                  </Button>
                                </>
                              )}
                            </View>
                          </View>
                        )}
                      </Card.Body>
                    </Card>
                  );
                })}
              </View>
            )}
          </ScrollView>

          {/* Bottom Actions (select mode) */}
          {mode === "select" && (
            <>
              <Separator />
              <View className="px-4 py-3 flex-row gap-2">
                <Button variant="outline" className="flex-1" onPress={handleClose}>
                  <Button.Label>{t("common.cancel")}</Button.Label>
                </Button>
                <Button
                  variant="primary"
                  className="flex-1"
                  onPress={handleApply}
                  isDisabled={!selectedGroupId}
                >
                  <Button.Label>{t("files.applyGroup")}</Button.Label>
                </Button>
              </View>
            </>
          )}

          {/* Delete Confirmation Dialog */}
          <Dialog
            isOpen={deleteGroupId !== null}
            onOpenChange={(open) => {
              if (!open) setDeleteGroupId(null);
            }}
          >
            <Dialog.Portal>
              <Dialog.Overlay />
              <Dialog.Content>
                <Dialog.Title>{t("files.deleteGroup")}</Dialog.Title>
                {deleteGroup && (
                  <Dialog.Description>
                    {t("files.deleteGroupConfirm", { name: deleteGroup.name })}
                  </Dialog.Description>
                )}
                <View className="mt-4 flex-row justify-end gap-2">
                  <Button variant="outline" size="sm" onPress={() => setDeleteGroupId(null)}>
                    <Button.Label>{t("common.cancel")}</Button.Label>
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onPress={() => {
                      if (deleteGroupId) removeGroup(deleteGroupId);
                      setDeleteGroupId(null);
                    }}
                  >
                    <Button.Label>{t("common.delete")}</Button.Label>
                  </Button>
                </View>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
