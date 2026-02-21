import { View } from "react-native";
import { Button, Separator, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";

interface FilesToolbarProps {
  isSelectionMode: boolean;
  selectedCount: number;
  displayCount: number;
  trashCount: number;
  shouldStack: boolean;
  onImport: () => void;
  onEnterSelection: () => void;
  onConvert: () => void;
  onTrash: () => void;
  onSelectAllVisible: () => void;
  onInvertSelection: () => void;
  onBatchFavorite: () => void;
  onAlbumPicker: () => void;
  onBatchTag: () => void;
  onBatchRename: () => void;
  onGroupSheet: () => void;
  onBatchExport: () => void;
  onBatchDelete: () => void;
  onClearSelection: () => void;
}

export function FilesToolbar({
  isSelectionMode,
  selectedCount,
  displayCount,
  trashCount,
  shouldStack,
  onImport,
  onEnterSelection,
  onConvert,
  onTrash,
  onSelectAllVisible,
  onInvertSelection,
  onBatchFavorite,
  onAlbumPicker,
  onBatchTag,
  onBatchRename,
  onGroupSheet,
  onBatchExport,
  onBatchDelete,
  onClearSelection,
}: FilesToolbarProps) {
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");

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
          {/* Selection actions group */}
          <Button
            testID="e2e-action-tabs__index-select-all"
            size="sm"
            isIconOnly
            variant="outline"
            onPress={onSelectAllVisible}
          >
            <Ionicons name="checkbox-outline" size={16} color={mutedColor} />
          </Button>
          <Button
            testID="files-invert-selection-button"
            size="sm"
            isIconOnly
            variant="outline"
            onPress={onInvertSelection}
            isDisabled={displayCount === 0}
          >
            <Ionicons name="shuffle-outline" size={16} color={mutedColor} />
          </Button>

          <Separator orientation="vertical" className="h-5" />

          {/* File operations group */}
          <Button
            size="sm"
            isIconOnly
            variant="outline"
            onPress={onBatchFavorite}
            isDisabled={selectedCount === 0}
          >
            <Ionicons name="heart-outline" size={16} color={mutedColor} />
          </Button>
          <Button
            testID="files-open-album-picker-button"
            size="sm"
            isIconOnly
            variant="outline"
            onPress={onAlbumPicker}
            isDisabled={selectedCount === 0}
          >
            <Ionicons name="albums-outline" size={16} color={mutedColor} />
          </Button>
          <Button
            testID="files-open-batch-tag-button"
            size="sm"
            isIconOnly
            variant="outline"
            onPress={onBatchTag}
            isDisabled={selectedCount === 0}
          >
            <Ionicons name="pricetag-outline" size={16} color={mutedColor} />
          </Button>
          <Button
            testID="files-open-batch-rename-button"
            size="sm"
            isIconOnly
            variant="outline"
            onPress={onBatchRename}
            isDisabled={selectedCount === 0}
          >
            <Ionicons name="text-outline" size={16} color={mutedColor} />
          </Button>
          <Button
            testID="files-open-group-sheet-button"
            size="sm"
            isIconOnly
            variant="outline"
            onPress={onGroupSheet}
            isDisabled={selectedCount === 0}
          >
            <Ionicons name="folder-open-outline" size={16} color={mutedColor} />
          </Button>
          <Button
            size="sm"
            isIconOnly
            variant="outline"
            onPress={onBatchExport}
            isDisabled={selectedCount === 0}
          >
            <Ionicons name="share-social-outline" size={16} color={mutedColor} />
          </Button>

          <Separator orientation="vertical" className="h-5" />

          <Button
            testID="files-batch-delete-button"
            size="sm"
            isIconOnly
            variant="outline"
            onPress={onBatchDelete}
            isDisabled={selectedCount === 0}
          >
            <Ionicons name="trash-outline" size={16} color="#ef4444" />
          </Button>
          <Button size="sm" isIconOnly variant="outline" onPress={onClearSelection}>
            <Ionicons name="close-outline" size={16} color={mutedColor} />
          </Button>
        </>
      )}
    </View>
  );
}
