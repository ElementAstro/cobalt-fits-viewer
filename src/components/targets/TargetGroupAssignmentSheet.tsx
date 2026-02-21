import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { BottomSheet, Button, Card, Input, Label, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "../../i18n/useI18n";
import type { TargetGroup } from "../../lib/fits/types";

interface TargetGroupAssignmentSheetProps {
  visible: boolean;
  targetName: string;
  groups: TargetGroup[];
  initialSelectedGroupIds: string[];
  onClose: () => void;
  onSave: (groupIds: string[]) => void;
  onCreateGroup: (name: string, description?: string, color?: string) => string;
}

const GROUP_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
];

export function TargetGroupAssignmentSheet({
  visible,
  targetName,
  groups,
  initialSelectedGroupIds,
  onClose,
  onSave,
  onCreateGroup,
}: TargetGroupAssignmentSheetProps) {
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");
  const insets = useSafeAreaInsets();
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>(initialSelectedGroupIds);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDescription, setNewGroupDescription] = useState("");
  const [newGroupColor, setNewGroupColor] = useState(GROUP_COLORS[0]);

  useEffect(() => {
    if (!visible) return;
    setSelectedGroupIds(initialSelectedGroupIds);
  }, [initialSelectedGroupIds, visible]);

  const selectedSet = useMemo(() => new Set(selectedGroupIds), [selectedGroupIds]);

  const toggleGroup = (groupId: string) => {
    setSelectedGroupIds((prev) => {
      if (prev.includes(groupId)) {
        return prev.filter((id) => id !== groupId);
      }
      return [...prev, groupId];
    });
  };

  const handleCreateGroup = () => {
    const trimmedName = newGroupName.trim();
    if (!trimmedName) return;
    const groupId = onCreateGroup(
      trimmedName,
      newGroupDescription.trim() || undefined,
      newGroupColor,
    );
    setSelectedGroupIds((prev) => (prev.includes(groupId) ? prev : [...prev, groupId]));
    setNewGroupName("");
    setNewGroupDescription("");
    setNewGroupColor(GROUP_COLORS[0]);
  };

  const handleSave = () => {
    onSave(selectedGroupIds);
    onClose();
  };

  return (
    <BottomSheet isOpen={visible} onOpenChange={(open) => !open && onClose()}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content
          detached
          bottomInset={insets.bottom + 8}
          snapPoints={["88%"]}
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
            <View className="mb-4 flex-row items-center justify-between">
              <BottomSheet.Title>{t("targets.groups.manageMembership")}</BottomSheet.Title>
              <BottomSheet.Close />
            </View>

            <Text className="mb-3 text-xs text-muted">
              {t("targets.groups.targetLabel")}: {targetName}
            </Text>

            <Card variant="secondary" className="mb-4">
              <Card.Body className="gap-2 p-3">
                <Label>{t("targets.groups.quickCreate")}</Label>
                <Input
                  placeholder={t("targets.groups.namePlaceholder")}
                  value={newGroupName}
                  onChangeText={setNewGroupName}
                  autoCorrect={false}
                />
                <Input
                  placeholder={t("targets.groups.descriptionPlaceholder")}
                  value={newGroupDescription}
                  onChangeText={setNewGroupDescription}
                  autoCorrect={false}
                />
                <View className="flex-row flex-wrap gap-2">
                  {GROUP_COLORS.map((color) => (
                    <Button
                      key={color}
                      size="sm"
                      variant={newGroupColor === color ? "primary" : "outline"}
                      className="h-8 w-8 p-0"
                      onPress={() => setNewGroupColor(color)}
                    >
                      <View className="h-5 w-5 rounded-full" style={{ backgroundColor: color }} />
                    </Button>
                  ))}
                </View>
                <Button
                  variant="outline"
                  onPress={handleCreateGroup}
                  isDisabled={!newGroupName.trim()}
                >
                  <Ionicons name="add" size={14} color={mutedColor} />
                  <Button.Label>{t("targets.groups.create")}</Button.Label>
                </Button>
              </Card.Body>
            </Card>

            {groups.length === 0 ? (
              <View className="items-center py-6">
                <Ionicons name="folder-open-outline" size={32} color={mutedColor} />
                <Text className="mt-2 text-sm text-muted">{t("targets.groups.noGroups")}</Text>
              </View>
            ) : (
              <View className="gap-2">
                {groups.map((group) => {
                  const selected = selectedSet.has(group.id);
                  return (
                    <Card
                      key={group.id}
                      variant="secondary"
                      className={selected ? "border-primary" : ""}
                    >
                      <Card.Body className="flex-row items-center justify-between p-3">
                        <View className="min-w-0 flex-1 flex-row items-center gap-2">
                          <View
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: group.color ?? "#888" }}
                          />
                          <View className="min-w-0 flex-1">
                            <Text className="text-sm font-medium text-foreground">
                              {group.name}
                            </Text>
                            {group.description ? (
                              <Text className="text-xs text-muted" numberOfLines={1}>
                                {group.description}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                        <Button
                          variant="ghost"
                          size="sm"
                          isIconOnly
                          onPress={() => toggleGroup(group.id)}
                        >
                          <Ionicons
                            name={selected ? "checkbox" : "square-outline"}
                            size={18}
                            color={selected ? "#3b82f6" : mutedColor}
                          />
                        </Button>
                      </Card.Body>
                    </Card>
                  );
                })}
              </View>
            )}

            <View className="mt-4 flex-row gap-2">
              <Button className="flex-1" variant="outline" onPress={onClose}>
                <Button.Label>{t("common.cancel")}</Button.Label>
              </Button>
              <Button className="flex-1" variant="primary" onPress={handleSave}>
                <Button.Label>{t("common.save")}</Button.Label>
              </Button>
            </View>
          </ScrollView>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
