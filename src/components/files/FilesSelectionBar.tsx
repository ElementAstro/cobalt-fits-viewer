import { View, Text } from "react-native";
import { Button, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";

interface FilesSelectionBarProps {
  selectedCount: number;
  selectedImageCount: number;
  isLandscape: boolean;
  onCompare: () => void;
  onBatchConvert: () => void;
  onStacking: () => void;
}

export function FilesSelectionBar({
  selectedCount,
  selectedImageCount,
  isLandscape,
  onCompare,
  onBatchConvert,
  onStacking,
}: FilesSelectionBarProps) {
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");

  return (
    <View className="flex-row items-center justify-between rounded-lg bg-surface-secondary px-3 py-2">
      <Text className="text-xs text-muted">
        {selectedCount} {t("common.selected")}
      </Text>
      <View className="flex-row items-center gap-2">
        <Button
          testID="e2e-action-tabs__index-open-compare-bar"
          size="sm"
          variant="ghost"
          onPress={onCompare}
          isDisabled={selectedImageCount < 2}
        >
          <Ionicons name="git-compare-outline" size={14} color={mutedColor} />
          {!isLandscape && <Button.Label>{t("gallery.compare")}</Button.Label>}
        </Button>
        <Button size="sm" variant="ghost" onPress={onBatchConvert} isDisabled={!selectedCount}>
          <Ionicons name="swap-horizontal-outline" size={14} color={mutedColor} />
          {!isLandscape && <Button.Label>{t("converter.batchConvert")}</Button.Label>}
        </Button>
        <Button
          testID="files-go-to-stacking-button"
          size="sm"
          variant="ghost"
          onPress={onStacking}
          isDisabled={!selectedCount}
        >
          <Ionicons name="layers-outline" size={14} color={mutedColor} />
          {!isLandscape && <Button.Label>{t("gallery.batchStack")}</Button.Label>}
        </Button>
      </View>
    </View>
  );
}
