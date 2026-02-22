import { ScrollView, View, Text } from "react-native";
import { BottomSheet, PressableFeedback, Separator, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";

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

interface ActionItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress: () => void;
  disabled?: boolean;
  compact?: boolean;
  destructive?: boolean;
}

function ActionItem({
  icon,
  title,
  subtitle,
  onPress,
  disabled,
  compact,
  destructive,
}: ActionItemProps) {
  const successColor = useThemeColor("success");
  const mutedColor = useThemeColor("muted");
  const iconColor = destructive ? "#ef4444" : disabled ? mutedColor : successColor;

  return (
    <PressableFeedback
      onPress={onPress}
      isDisabled={disabled}
      className={`flex-row items-center gap-3 rounded-xl ${
        disabled ? "bg-surface-secondary/60" : "bg-surface-secondary"
      } ${compact ? "p-3" : "p-4"}`}
    >
      <View
        className={`items-center justify-center rounded-full ${
          destructive ? "bg-danger/10" : "bg-success/10"
        } ${compact ? "h-8 w-8" : "h-10 w-10"}`}
      >
        <Ionicons name={icon} size={compact ? 16 : 20} color={iconColor} />
      </View>
      <View className="flex-1">
        <Text
          className={`font-semibold ${disabled ? "text-muted" : "text-foreground"} ${
            compact ? "text-xs" : "text-sm"
          }`}
        >
          {title}
        </Text>
        {subtitle && <Text className="text-xs text-muted">{subtitle}</Text>}
      </View>
    </PressableFeedback>
  );
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

  return (
    <BottomSheet isOpen={visible} onOpenChange={onOpenChange}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content
          snapPoints={[480]}
          enablePanDownToClose
          backgroundStyle={{ backgroundColor: surfaceColor + "F2" }}
          handleIndicatorStyle={{ backgroundColor: mutedColor }}
        >
          <View className={compact ? "px-4 pb-4" : "px-6 pb-8"}>
            <Text className={`mb-1 font-bold text-foreground ${compact ? "text-base" : "text-lg"}`}>
              {t("files.batchActions")}
            </Text>
            <Text className="mb-4 text-xs text-muted">
              {selectedCount} {t("album.selected")}
            </Text>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
              <View className={compact ? "gap-1.5" : "gap-2"}>
                <Text className="text-[10px] font-semibold uppercase text-muted mb-1">
                  {t("common.selectAll")}
                </Text>
                <ActionItem
                  icon="checkbox-outline"
                  title={t("common.selectAll")}
                  onPress={() => {
                    onSelectAllVisible();
                    dismiss();
                  }}
                  compact={compact}
                />
                <ActionItem
                  icon="shuffle-outline"
                  title={t("files.invertSelection")}
                  onPress={() => {
                    onInvertSelection();
                    dismiss();
                  }}
                  disabled={displayCount === 0}
                  compact={compact}
                />

                <Separator className="my-1" />
                <Text className="text-[10px] font-semibold uppercase text-muted mb-1">
                  {t("files.fileActions")}
                </Text>

                <ActionItem
                  icon="heart-outline"
                  title={t("files.toggleFavorite")}
                  onPress={() => {
                    onBatchFavorite();
                    dismiss();
                  }}
                  disabled={!hasSelection}
                  compact={compact}
                />
                <ActionItem
                  icon="albums-outline"
                  title={t("gallery.addToAlbum")}
                  onPress={() => {
                    onAlbumPicker();
                    dismiss();
                  }}
                  disabled={!hasSelection}
                  compact={compact}
                />
                <ActionItem
                  icon="pricetag-outline"
                  title={t("files.batchTag")}
                  onPress={() => {
                    onBatchTag();
                    dismiss();
                  }}
                  disabled={!hasSelection}
                  compact={compact}
                />
                <ActionItem
                  icon="text-outline"
                  title={t("files.batchRename")}
                  onPress={() => {
                    onBatchRename();
                    dismiss();
                  }}
                  disabled={!hasSelection}
                  compact={compact}
                />
                <ActionItem
                  icon="folder-open-outline"
                  title={t("files.fileGroup")}
                  onPress={() => {
                    onGroupSheet();
                    dismiss();
                  }}
                  disabled={!hasSelection}
                  compact={compact}
                />

                <Separator className="my-1" />
                <Text className="text-[10px] font-semibold uppercase text-muted mb-1">
                  {t("files.exportAndProcess")}
                </Text>

                <ActionItem
                  icon="share-social-outline"
                  title={t("files.export")}
                  onPress={() => {
                    onBatchExport();
                    dismiss();
                  }}
                  disabled={!hasSelection}
                  compact={compact}
                />
                <ActionItem
                  icon="swap-horizontal-outline"
                  title={t("files.batchConvert")}
                  onPress={() => {
                    onBatchConvert();
                    dismiss();
                  }}
                  disabled={!hasSelection}
                  compact={compact}
                />
                <ActionItem
                  icon="layers-outline"
                  title={t("files.stacking")}
                  onPress={() => {
                    onStacking();
                    dismiss();
                  }}
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
