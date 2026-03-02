import { View, Text } from "react-native";
import { Button, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";

interface GallerySelectionToolbarProps {
  selectedCount: number;
  selectedImageCount: number;
  allDisplaySelected: boolean;
  isLandscape: boolean;
  onSelectAllToggle: () => void;
  onAddToAlbum: () => void;
  onBatchTag: () => void;
  onBatchRename: () => void;
  onCompare: () => void;
  onBatchDelete: () => void;
  onExitSelection: () => void;
}

export function GallerySelectionToolbar({
  selectedCount,
  selectedImageCount,
  allDisplaySelected,
  isLandscape,
  onSelectAllToggle,
  onAddToAlbum,
  onBatchTag,
  onBatchRename,
  onCompare,
  onBatchDelete,
  onExitSelection,
}: GallerySelectionToolbarProps) {
  const { t } = useI18n();
  const [mutedColor, dangerColor] = useThemeColor(["muted", "danger"]);

  return (
    <View className="flex-row items-center justify-between rounded-xl bg-surface-secondary px-3 py-2">
      <Text className="text-xs text-foreground">
        {selectedCount} {t("album.selected")}
      </Text>
      <View className="flex-row gap-1">
        <Button size="sm" variant="outline" onPress={onSelectAllToggle}>
          <Ionicons
            name={allDisplaySelected ? "checkmark-done-outline" : "checkmark-outline"}
            size={12}
            color={mutedColor}
          />
          {!isLandscape && (
            <Button.Label className="text-[10px]">
              {allDisplaySelected ? t("common.deselectAll") : t("common.selectAll")}
            </Button.Label>
          )}
        </Button>
        <Button size="sm" variant="outline" onPress={onAddToAlbum} isDisabled={selectedCount === 0}>
          <Ionicons name="albums-outline" size={12} color={mutedColor} />
          {!isLandscape && (
            <Button.Label className="text-[10px]">{t("gallery.addToAlbum")}</Button.Label>
          )}
        </Button>
        <Button size="sm" variant="outline" onPress={onBatchTag} isDisabled={selectedCount === 0}>
          <Ionicons name="pricetag-outline" size={12} color={mutedColor} />
        </Button>
        <Button
          size="sm"
          variant="outline"
          onPress={onBatchRename}
          isDisabled={selectedCount === 0}
        >
          <Ionicons name="text-outline" size={12} color={mutedColor} />
        </Button>
        <Button
          testID="e2e-action-tabs__gallery-open-compare"
          size="sm"
          variant="outline"
          onPress={onCompare}
          isDisabled={selectedImageCount < 2}
        >
          <Ionicons name="git-compare-outline" size={12} color={mutedColor} />
        </Button>
        <Button
          size="sm"
          variant="outline"
          onPress={onBatchDelete}
          isDisabled={selectedCount === 0}
        >
          <Ionicons name="trash-outline" size={12} color={dangerColor} />
        </Button>
        <Button size="sm" variant="outline" onPress={onExitSelection}>
          <Ionicons name="close-outline" size={14} color={mutedColor} />
        </Button>
      </View>
    </View>
  );
}
