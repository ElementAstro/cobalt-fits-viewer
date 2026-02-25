import { View } from "react-native";
import { Button, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";

interface FilesToolbarProps {
  isSelectionMode: boolean;
  selectedCount: number;
  trashCount: number;
  shouldStack: boolean;
  onImport: () => void;
  onEnterSelection: () => void;
  onConvert: () => void;
  onTrash: () => void;
  onSelectAllVisible: () => void;
  onMoreActions: () => void;
  onBatchDelete: () => void;
  onClearSelection: () => void;
}

export function FilesToolbar({
  isSelectionMode,
  selectedCount,
  trashCount,
  shouldStack,
  onImport,
  onEnterSelection,
  onConvert,
  onTrash,
  onSelectAllVisible,
  onMoreActions,
  onBatchDelete,
  onClearSelection,
}: FilesToolbarProps) {
  const { t } = useI18n();
  const [mutedColor, dangerColor] = useThemeColor(["muted", "danger"]);

  return (
    <View className="flex-row flex-wrap items-center gap-2">
      <Button variant="primary" className={shouldStack ? "w-full" : "flex-1"} onPress={onImport}>
        <Ionicons name="add-circle-outline" size={16} color="#fff" />
        <Button.Label>{t("files.importOptions")}</Button.Label>
      </Button>
      {!isSelectionMode ? (
        <>
          <Button
            testID="e2e-action-tabs__index-enter-selection"
            size="sm"
            isIconOnly
            variant="outline"
            onPress={onEnterSelection}
          >
            <Ionicons name="checkmark-circle-outline" size={16} color={mutedColor} />
          </Button>
          <Button size="sm" isIconOnly variant="outline" onPress={onConvert}>
            <Ionicons name="swap-horizontal-outline" size={16} color={mutedColor} />
          </Button>
          <Button
            testID="e2e-action-tabs__index-open-trash"
            size="sm"
            isIconOnly
            variant="outline"
            onPress={onTrash}
          >
            <Ionicons
              name={trashCount > 0 ? "trash-bin" : "trash-bin-outline"}
              size={16}
              color={mutedColor}
            />
          </Button>
        </>
      ) : (
        <>
          <Button
            testID="e2e-action-tabs__index-select-all"
            size="sm"
            isIconOnly
            variant="outline"
            onPress={onSelectAllVisible}
          >
            <Ionicons name="checkbox-outline" size={16} color={mutedColor} />
          </Button>
          <Button size="sm" variant="outline" onPress={onMoreActions}>
            <Ionicons name="ellipsis-horizontal" size={16} color={mutedColor} />
            <Button.Label>{t("files.batchActions")}</Button.Label>
          </Button>
          <Button
            testID="files-batch-delete-button"
            size="sm"
            isIconOnly
            variant="outline"
            onPress={onBatchDelete}
            isDisabled={selectedCount === 0}
          >
            <Ionicons name="trash-outline" size={16} color={dangerColor} />
          </Button>
          <Button size="sm" isIconOnly variant="outline" onPress={onClearSelection}>
            <Ionicons name="close-outline" size={16} color={mutedColor} />
          </Button>
        </>
      )}
    </View>
  );
}
