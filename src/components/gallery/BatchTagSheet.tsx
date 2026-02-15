import { useState, useMemo } from "react";
import { View, Text } from "react-native";
import {
  BottomSheet,
  Button,
  Chip,
  Input,
  Separator,
  TextField,
  useThemeColor,
} from "heroui-native";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";
import { useFitsStore } from "../../stores/useFitsStore";

interface BatchTagSheetProps {
  visible: boolean;
  selectedIds: string[];
  onClose: () => void;
}

export function BatchTagSheet({ visible, selectedIds, onClose }: BatchTagSheetProps) {
  const { t } = useI18n();
  const [mutedColor, successColor] = useThemeColor(["muted", "success"]);
  const [newTag, setNewTag] = useState("");
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());

  const files = useFitsStore((s) => s.files);
  const batchAddTag = useFitsStore((s) => s.batchAddTag);
  const batchRemoveTag = useFitsStore((s) => s.batchRemoveTag);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    for (const f of files) {
      for (const tag of f.tags) tags.add(tag);
    }
    return [...tags].sort();
  }, [files]);

  const currentTags = useMemo(() => {
    const selected = files.filter((f) => selectedIds.includes(f.id));
    const tagCounts = new Map<string, number>();
    for (const f of selected) {
      for (const tag of f.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }
    }
    return tagCounts;
  }, [files, selectedIds]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const handleAddNewTag = () => {
    const trimmed = newTag.trim();
    if (!trimmed) return;
    setSelectedTags((prev) => new Set(prev).add(trimmed));
    setNewTag("");
  };

  const handleApply = () => {
    for (const tag of selectedTags) {
      batchAddTag(selectedIds, tag);
    }
    const tagsToRemove = [...currentTags.keys()].filter(
      (tag) => !selectedTags.has(tag) && currentTags.get(tag) === selectedIds.length,
    );
    for (const tag of tagsToRemove) {
      batchRemoveTag(selectedIds, tag);
    }
    onClose();
    setSelectedTags(new Set());
  };

  const handleOpen = () => {
    const fullyApplied = [...currentTags.entries()]
      .filter(([, count]) => count === selectedIds.length)
      .map(([tag]) => tag);
    setSelectedTags(new Set(fullyApplied));
  };

  return (
    <BottomSheet
      isOpen={visible}
      onOpenChange={(open) => {
        if (open) handleOpen();
        if (!open) onClose();
      }}
    >
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content>
          <BottomSheet.Title className="text-center">{t("gallery.batchTag")}</BottomSheet.Title>
          <Text className="text-center text-xs text-muted mb-2">
            {selectedIds.length} {t("album.selected") ?? "selected"}
          </Text>
          <Separator className="my-1" />

          {/* New tag input */}
          <View className="flex-row items-center gap-2 px-4 py-2">
            <TextField className="flex-1">
              <Input
                placeholder={t("gallery.newTag")}
                value={newTag}
                onChangeText={setNewTag}
                onSubmitEditing={handleAddNewTag}
                autoCorrect={false}
              />
            </TextField>
            <Button
              size="sm"
              variant="outline"
              onPress={handleAddNewTag}
              isDisabled={!newTag.trim()}
            >
              <Ionicons name="add-outline" size={16} color={successColor} />
            </Button>
          </View>

          {/* Tag list */}
          <BottomSheetScrollView style={{ maxHeight: 280 }}>
            <View className="flex-row flex-wrap gap-1.5 px-4 py-2">
              {allTags.map((tag) => {
                const isSelected = selectedTags.has(tag);
                const count = currentTags.get(tag) ?? 0;
                const isPartial = count > 0 && count < selectedIds.length;
                return (
                  <Chip
                    key={tag}
                    size="sm"
                    variant={isSelected ? "primary" : "secondary"}
                    onPress={() => toggleTag(tag)}
                  >
                    <Chip.Label className="text-[10px]">
                      {tag}
                      {isPartial && !isSelected ? ` (${count})` : ""}
                    </Chip.Label>
                  </Chip>
                );
              })}
              {/* Show newly added tags not yet in allTags */}
              {[...selectedTags]
                .filter((tag) => !allTags.includes(tag))
                .map((tag) => (
                  <Chip key={tag} size="sm" variant="primary" onPress={() => toggleTag(tag)}>
                    <Chip.Label className="text-[10px]">{tag}</Chip.Label>
                  </Chip>
                ))}
            </View>
            {allTags.length === 0 && selectedTags.size === 0 && (
              <View className="items-center py-6">
                <Ionicons name="pricetag-outline" size={28} color={mutedColor} />
                <Text className="mt-2 text-xs text-muted">{t("gallery.noTags")}</Text>
              </View>
            )}
          </BottomSheetScrollView>

          <Separator className="my-1" />
          <View className="flex-row gap-2 px-4 py-2">
            <Button variant="outline" onPress={onClose} className="flex-1">
              <Button.Label>{t("common.cancel")}</Button.Label>
            </Button>
            <Button variant="primary" onPress={handleApply} className="flex-1">
              <Button.Label>{t("common.confirm") ?? "Apply"}</Button.Label>
            </Button>
          </View>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
