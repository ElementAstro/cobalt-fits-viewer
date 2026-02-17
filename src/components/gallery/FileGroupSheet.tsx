import { useMemo, useState } from "react";
import { View, Text } from "react-native";
import { BottomSheet, Button, Chip, Input, Separator, TextField } from "heroui-native";
import { useI18n } from "../../i18n/useI18n";
import { useFileGroupStore } from "../../stores/useFileGroupStore";

interface FileGroupSheetProps {
  visible: boolean;
  selectedCount: number;
  onClose: () => void;
  onApplyGroup: (groupId: string) => void;
}

export function FileGroupSheet({
  visible,
  selectedCount,
  onClose,
  onApplyGroup,
}: FileGroupSheetProps) {
  const { t } = useI18n();
  const groups = useFileGroupStore((s) => s.groups);
  const createGroup = useFileGroupStore((s) => s.createGroup);

  const [groupName, setGroupName] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");

  const hasSelection = useMemo(() => selectedGroupId.length > 0, [selectedGroupId]);

  const handleCreateGroup = () => {
    const trimmed = groupName.trim();
    if (!trimmed) return;
    const groupId = createGroup(trimmed);
    setSelectedGroupId(groupId);
    setGroupName("");
  };

  const handleApply = () => {
    if (!selectedGroupId) return;
    onApplyGroup(selectedGroupId);
    onClose();
    setSelectedGroupId("");
  };

  const handleClose = () => {
    setGroupName("");
    setSelectedGroupId("");
    onClose();
  };

  return (
    <BottomSheet isOpen={visible} onOpenChange={(open) => !open && handleClose()}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content>
          <BottomSheet.Title className="text-center">{t("files.groupFiles")}</BottomSheet.Title>
          <Text className="text-center text-xs text-muted">
            {selectedCount} {t("common.selected")}
          </Text>
          <Separator className="my-2" />

          <View className="px-4 py-1 gap-2">
            <Text className="text-xs font-semibold text-foreground">{t("files.createGroup")}</Text>
            <View className="flex-row gap-2">
              <TextField className="flex-1">
                <Input
                  value={groupName}
                  onChangeText={setGroupName}
                  placeholder={t("files.groupNamePlaceholder")}
                  autoCorrect={false}
                />
              </TextField>
              <Button
                size="sm"
                variant="outline"
                onPress={handleCreateGroup}
                isDisabled={!groupName.trim()}
              >
                <Button.Label>{t("common.save")}</Button.Label>
              </Button>
            </View>
          </View>

          <View className="px-4 py-2 gap-2">
            <Text className="text-xs font-semibold text-foreground">{t("files.groupList")}</Text>
            <View className="flex-row flex-wrap gap-2">
              {groups.map((group) => (
                <Chip
                  key={group.id}
                  size="sm"
                  variant={selectedGroupId === group.id ? "primary" : "secondary"}
                  onPress={() => setSelectedGroupId(group.id)}
                >
                  <Chip.Label className="text-xs">{group.name}</Chip.Label>
                </Chip>
              ))}
              {groups.length === 0 && (
                <Text className="text-xs text-muted">{t("files.noGroups")}</Text>
              )}
            </View>
          </View>

          <Separator className="my-2" />
          <View className="px-4 pb-3 flex-row gap-2">
            <Button variant="outline" className="flex-1" onPress={handleClose}>
              <Button.Label>{t("common.cancel")}</Button.Label>
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onPress={handleApply}
              isDisabled={!hasSelection}
            >
              <Button.Label>{t("files.applyGroup")}</Button.Label>
            </Button>
          </View>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
