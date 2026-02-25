import { ScrollView, View, Text } from "react-native";
import { BottomSheet, useThemeColor } from "heroui-native";
import { useI18n } from "../../i18n/useI18n";
import { hexWithAlpha } from "../../lib/utils/colorUtils";
import { SheetActionItem } from "./SheetActionItem";

const SHEET_MAX_SNAP_HEIGHT = 520;
const SHEET_HEIGHT_RATIO = 0.7;
const SHEET_MAX_SCROLL_RATIO = 0.5;

interface ImportOptionsSheetProps {
  visible: boolean;
  onOpenChange: (open: boolean) => void;
  screenHeight: number;
  isZipImportAvailable: boolean;
  isLandscape: boolean;
  onImportFile: () => void;
  onImportFolder: () => void;
  onImportZip: () => void;
  onImportUrl: () => void;
  onImportClipboard: () => void;
  onImportMediaLibrary: () => void;
  onRecordVideo: () => void;
}

export function ImportOptionsSheet({
  visible,
  onOpenChange,
  screenHeight,
  isZipImportAvailable,
  isLandscape,
  onImportFile,
  onImportFolder,
  onImportZip,
  onImportUrl,
  onImportClipboard,
  onImportMediaLibrary,
  onRecordVideo,
}: ImportOptionsSheetProps) {
  const { t } = useI18n();
  const [mutedColor, surfaceColor, successColor] = useThemeColor(["muted", "surface", "success"]);
  const compact = isLandscape;

  return (
    <BottomSheet isOpen={visible} onOpenChange={onOpenChange}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content
          snapPoints={[Math.min(SHEET_MAX_SNAP_HEIGHT, screenHeight * SHEET_HEIGHT_RATIO)]}
          enablePanDownToClose
          backgroundStyle={{ backgroundColor: hexWithAlpha(surfaceColor, 0.95) }}
          handleIndicatorStyle={{ backgroundColor: mutedColor }}
        >
          <View className={compact ? "px-4 pb-4" : "px-6 pb-8"}>
            <Text className={`mb-1 font-bold text-foreground ${compact ? "text-base" : "text-lg"}`}>
              {t("files.importOptions")}
            </Text>
            <Text className="mb-4 text-xs text-muted">{t("files.selectImportMethod")}</Text>

            <ScrollView
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: screenHeight * SHEET_MAX_SCROLL_RATIO }}
            >
              <View className={compact ? "gap-1.5" : "gap-2"}>
                <SheetActionItem
                  icon="document-outline"
                  title={t("files.importFile")}
                  subtitle={t("files.supportedFormatsShort")}
                  onPress={onImportFile}
                  compact={compact}
                  showChevron
                  successColor={successColor}
                  mutedColor={mutedColor}
                />
                <SheetActionItem
                  icon="folder-open-outline"
                  title={t("files.importFolder")}
                  subtitle={t("files.supportedFormatsHint")}
                  onPress={onImportFolder}
                  compact={compact}
                  showChevron
                  successColor={successColor}
                  mutedColor={mutedColor}
                />
                <SheetActionItem
                  icon="archive-outline"
                  title={t("files.importZip")}
                  subtitle={isZipImportAvailable ? "ZIP" : t("files.importZipUnavailable")}
                  onPress={onImportZip}
                  disabled={!isZipImportAvailable}
                  compact={compact}
                  showChevron
                  successColor={successColor}
                  mutedColor={mutedColor}
                />
                <SheetActionItem
                  icon="cloud-download-outline"
                  title={t("files.importFromUrl")}
                  subtitle={`HTTP / HTTPS · ${t("files.supportedFormatsShort")}`}
                  onPress={onImportUrl}
                  compact={compact}
                  showChevron
                  successColor={successColor}
                  mutedColor={mutedColor}
                />
                <SheetActionItem
                  icon="clipboard-outline"
                  title={t("files.importFromClipboard")}
                  subtitle={t("files.supportedFormatsShort")}
                  onPress={onImportClipboard}
                  compact={compact}
                  showChevron
                  successColor={successColor}
                  mutedColor={mutedColor}
                />
                <SheetActionItem
                  icon="images-outline"
                  title={t("files.importFromMediaLibrary")}
                  subtitle={t("files.mediaLibraryHint")}
                  onPress={onImportMediaLibrary}
                  compact={compact}
                  showChevron
                  successColor={successColor}
                  mutedColor={mutedColor}
                />
                <SheetActionItem
                  icon="videocam-outline"
                  title={t("files.recordVideo")}
                  subtitle={t("files.recordVideoHint")}
                  onPress={onRecordVideo}
                  compact={compact}
                  showChevron
                  successColor={successColor}
                  mutedColor={mutedColor}
                />
              </View>
            </ScrollView>
          </View>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
