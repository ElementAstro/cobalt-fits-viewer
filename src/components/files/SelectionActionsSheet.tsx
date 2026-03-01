import { ScrollView, View, Text } from "react-native";
import { BottomSheet, Separator, useThemeColor } from "heroui-native";
import { useI18n } from "../../i18n/useI18n";
import { hexWithAlpha } from "../../lib/utils/colorUtils";
import { SheetActionItem } from "./SheetActionItem";

const SHEET_SNAP_HEIGHT = 480;
const SHEET_MAX_SCROLL_HEIGHT = 400;

interface SelectionActionsSheetProps {
  visible: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  displayCount: number;
  isLandscape: boolean;
  onSelectAllVisible: () => void;
  onInvertSelection: () => void;
  onBatchFavorite: () => void;
  onAlbumPicker: () => void;
  onBatchTag: () => void;
  onBatchRename: () => void;
  onGroupSheet: () => void;
  onBatchExport: () => void;
  onBatchConvert: () => void;
  onStacking: () => void;
}

export function SelectionActionsSheet({
  visible,
  onOpenChange,
  selectedCount,
  displayCount,
  isLandscape,
  onSelectAllVisible,
  onInvertSelection,
  onBatchFavorite,
  onAlbumPicker,
  onBatchTag,
  onBatchRename,
  onGroupSheet,
  onBatchExport,
  onBatchConvert,
  onStacking,
}: SelectionActionsSheetProps) {
  const { t } = useI18n();
  const [mutedColor, surfaceColor] = useThemeColor(["muted", "surface"]);
  const compact = isLandscape;
  const hasSelection = selectedCount > 0;

  const dismiss = () => onOpenChange(false);
  const act = (fn: () => void) => () => {
    fn();
    dismiss();
  };

  return (
    <BottomSheet isOpen={visible} onOpenChange={onOpenChange}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content
          snapPoints={[SHEET_SNAP_HEIGHT]}
          enablePanDownToClose
          backgroundStyle={{ backgroundColor: hexWithAlpha(surfaceColor, 0.95) }}
          handleIndicatorStyle={{ backgroundColor: mutedColor }}
        >
          <View className={compact ? "px-4 pb-4" : "px-6 pb-8"}>
            <Text className={`mb-1 font-bold text-foreground ${compact ? "text-base" : "text-lg"}`}>
              {t("files.batchActions")}
            </Text>
            <Text className="mb-4 text-xs text-muted">
              {selectedCount} {t("album.selected")}
            </Text>

            <ScrollView
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: SHEET_MAX_SCROLL_HEIGHT }}
            >
              <View className={compact ? "gap-1.5" : "gap-2"}>
                <Text className="text-[10px] font-semibold uppercase text-muted mb-1">
                  {t("common.selectAll")}
                </Text>
                <SheetActionItem
                  icon="checkbox-outline"
                  title={t("common.selectAll")}
                  onPress={act(onSelectAllVisible)}
                  compact={compact}
                />
                <SheetActionItem
                  icon="shuffle-outline"
                  title={t("files.invertSelection")}
                  onPress={act(onInvertSelection)}
                  disabled={displayCount === 0}
                  compact={compact}
                />

                <Separator className="my-1" />
                <Text className="text-[10px] font-semibold uppercase text-muted mb-1">
                  {t("files.fileActions")}
                </Text>

                <SheetActionItem
                  icon="heart-outline"
                  title={t("files.toggleFavorite")}
                  onPress={act(onBatchFavorite)}
                  disabled={!hasSelection}
                  compact={compact}
                />
                <SheetActionItem
                  icon="albums-outline"
                  title={t("gallery.addToAlbum")}
                  onPress={act(onAlbumPicker)}
                  disabled={!hasSelection}
                  compact={compact}
                />
                <SheetActionItem
                  icon="pricetag-outline"
                  title={t("files.batchTag")}
                  onPress={act(onBatchTag)}
                  disabled={!hasSelection}
                  compact={compact}
                />
                <SheetActionItem
                  icon="text-outline"
                  title={t("files.batchRename")}
                  onPress={act(onBatchRename)}
                  disabled={!hasSelection}
                  compact={compact}
                />
                <SheetActionItem
                  icon="folder-open-outline"
                  title={t("files.fileGroup")}
                  onPress={act(onGroupSheet)}
                  disabled={!hasSelection}
                  compact={compact}
                />

                <Separator className="my-1" />
                <Text className="text-[10px] font-semibold uppercase text-muted mb-1">
                  {t("files.exportAndProcess")}
                </Text>

                <SheetActionItem
                  icon="share-social-outline"
                  title={t("files.export")}
                  onPress={act(onBatchExport)}
                  disabled={!hasSelection}
                  compact={compact}
                />
                <SheetActionItem
                  icon="swap-horizontal-outline"
                  title={t("files.batchConvert")}
                  onPress={act(onBatchConvert)}
                  disabled={!hasSelection}
                  compact={compact}
                />
                <SheetActionItem
                  icon="layers-outline"
                  title={t("files.stacking")}
                  onPress={act(onStacking)}
                  disabled={selectedCount < 2}
                  compact={compact}
                />
              </View>
            </ScrollView>
          </View>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
