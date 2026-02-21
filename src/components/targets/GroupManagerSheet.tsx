/**
 * 分组管理 Sheet
 */

import { useState } from "react";
import { ScrollView, View, Text } from "react-native";
import { BottomSheet, Button, Card, Input, Label, Separator, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "../../i18n/useI18n";
import type { TargetGroup } from "../../lib/fits/types";

interface GroupManagerSheetProps {
  visible: boolean;
  groups: TargetGroup[];
  selectedGroupId?: string;
  onClose: () => void;
  onSelectGroup: (groupId: string | undefined) => void;
  onCreateGroup: (name: string, description?: string, color?: string) => string;
  onUpdateGroup: (id: string, updates: Partial<TargetGroup>) => void;
  onDeleteGroup: (id: string) => void;
}

const GROUP_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#14b8a6", // teal
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
];

export function GroupManagerSheet({
  visible,
  groups,
  selectedGroupId,
  onClose,
  onSelectGroup,
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup,
}: GroupManagerSheetProps) {
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");
  const dangerColor = useThemeColor("danger");
  const insets = useSafeAreaInsets();

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newColor, setNewColor] = useState(GROUP_COLORS[0]);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editColor, setEditColor] = useState(GROUP_COLORS[0]);

  const handleCreate = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    onCreateGroup(trimmed, newDescription.trim() || undefined, newColor);
    setNewName("");
    setNewDescription("");
    setNewColor(GROUP_COLORS[0]);
    setShowCreate(false);
  };

  const handleSelect = (groupId: string) => {
    if (selectedGroupId === groupId) {
      onSelectGroup(undefined);
    } else {
      onSelectGroup(groupId);
    }
  };

  const handleClearSelection = () => {
    onSelectGroup(undefined);
  };

  const startEdit = (group: TargetGroup) => {
    setEditingGroupId(group.id);
    setEditName(group.name);
    setEditDescription(group.description ?? "");
    setEditColor(group.color ?? GROUP_COLORS[0]);
  };

  const saveEdit = () => {
    if (!editingGroupId || !editName.trim()) return;
    onUpdateGroup(editingGroupId, {
      name: editName.trim(),
      description: editDescription.trim() || undefined,
      color: editColor,
    });
    setEditingGroupId(null);
  };

  return (
    <BottomSheet isOpen={visible} onOpenChange={(open) => !open && onClose()}>
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
            <View className="flex-row items-center justify-between mb-4">
              <BottomSheet.Title>{t("targets.groups.title")}</BottomSheet.Title>
              <BottomSheet.Close />
            </View>

            {/* Current Selection */}
            {selectedGroupId && (
              <Card variant="secondary" className="mb-4">
                <Card.Body className="p-3">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2">
                      <Ionicons name="folder" size={16} color={mutedColor} />
                      <Text className="text-sm text-foreground">
                        {groups.find((g) => g.id === selectedGroupId)?.name}
                      </Text>
                    </View>
                    <Button variant="ghost" size="sm" onPress={handleClearSelection}>
                      <Ionicons name="close" size={14} color={mutedColor} />
                    </Button>
                  </View>
                </Card.Body>
              </Card>
            )}

            {/* Create New Group */}
            {!showCreate ? (
              <Button variant="outline" className="mb-4" onPress={() => setShowCreate(true)}>
                <Ionicons name="add" size={16} color={mutedColor} />
                <Button.Label>{t("targets.groups.create")}</Button.Label>
              </Button>
            ) : (
              <Card variant="secondary" className="mb-4">
                <Card.Body className="p-4 gap-3">
                  <Label>{t("targets.groups.name")}</Label>
                  <Input
                    placeholder={t("targets.groups.namePlaceholder")}
                    value={newName}
                    onChangeText={setNewName}
                    autoFocus
                    autoCorrect={false}
                  />

                  <Label>{t("targets.groups.description")}</Label>
                  <Input
                    placeholder={t("targets.groups.descriptionPlaceholder")}
                    value={newDescription}
                    onChangeText={setNewDescription}
                    autoCorrect={false}
                  />

                  <Label>{t("targets.groups.color")}</Label>
                  <View className="flex-row gap-2 flex-wrap">
                    {GROUP_COLORS.map((color) => (
                      <Button
                        key={color}
                        variant={newColor === color ? "primary" : "outline"}
                        size="sm"
                        className="w-8 h-8 p-0"
                        onPress={() => setNewColor(color)}
                      >
                        <View className="w-5 h-5 rounded-full" style={{ backgroundColor: color }} />
                      </Button>
                    ))}
                  </View>

                  <View className="flex-row gap-2 mt-2">
                    <Button variant="ghost" className="flex-1" onPress={() => setShowCreate(false)}>
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

            <Separator className="my-3" />

            {/* Group List */}
            {groups.length === 0 ? (
              <View className="items-center py-6">
                <Ionicons name="folder-outline" size={32} color={mutedColor} />
                <Text className="text-sm text-muted mt-2">{t("targets.groups.noGroups")}</Text>
              </View>
            ) : (
              <View className="gap-2">
                {groups.map((group) => (
                  <Card
                    key={group.id}
                    variant="secondary"
                    className={selectedGroupId === group.id ? "border-primary" : ""}
                  >
                    <Card.Body className="p-3">
                      {editingGroupId === group.id ? (
                        <View className="gap-2">
                          <Input value={editName} onChangeText={setEditName} autoCorrect={false} />
                          <Input
                            value={editDescription}
                            onChangeText={setEditDescription}
                            autoCorrect={false}
                          />
                          <View className="flex-row gap-2 flex-wrap">
                            {GROUP_COLORS.map((color) => (
                              <Button
                                key={color}
                                variant={editColor === color ? "primary" : "outline"}
                                size="sm"
                                className="w-8 h-8 p-0"
                                onPress={() => setEditColor(color)}
                              >
                                <View
                                  className="w-5 h-5 rounded-full"
                                  style={{ backgroundColor: color }}
                                />
                              </Button>
                            ))}
                          </View>
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
                                <Text className="text-xs text-muted">{group.description}</Text>
                              )}
                              <Text className="text-[10px] text-muted mt-0.5">
                                {group.targetIds.length} {t("targets.groups.targets")}
                              </Text>
                            </View>
                          </View>
                          <View className="flex-row gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onPress={() => handleSelect(group.id)}
                            >
                              <Ionicons
                                name={selectedGroupId === group.id ? "checkmark" : "add"}
                                size={16}
                                color={mutedColor}
                              />
                            </Button>
                            <Button variant="ghost" size="sm" onPress={() => startEdit(group)}>
                              <Ionicons name="create-outline" size={14} color={mutedColor} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onPress={() => onDeleteGroup(group.id)}
                            >
                              <Ionicons name="trash-outline" size={14} color={dangerColor} />
                            </Button>
                          </View>
                        </View>
                      )}
                    </Card.Body>
                  </Card>
                ))}
              </View>
            )}
          </ScrollView>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
