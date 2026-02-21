import { ScrollView, View, Text } from "react-native";
import { BottomSheet, PressableFeedback, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";

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

interface ImportOptionItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
  disabled?: boolean;
  compact?: boolean;
}

function ImportOptionItem({
  icon,
  title,
  subtitle,
  onPress,
  disabled,
  compact,
}: ImportOptionItemProps) {
  const successColor = useThemeColor("success");
  const mutedColor = useThemeColor("muted");

  return (
    <PressableFeedback
      onPress={onPress}
      className={`flex-row items-center gap-3 rounded-xl ${
        disabled ? "bg-surface-secondary/60" : "bg-surface-secondary"
      } ${compact ? "p-3" : "p-4"}`}
    >
      <View
        className={`items-center justify-center rounded-full bg-success/10 ${
          compact ? "h-8 w-8" : "h-10 w-10"
        }`}
      >
        <Ionicons name={icon} size={compact ? 16 : 20} color={successColor} />
      </View>
      <View className="flex-1">
        <Text className={`font-semibold text-foreground ${compact ? "text-xs" : "text-sm"}`}>
          {title}
        </Text>
        <Text className="text-xs text-muted">{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={mutedColor} />
    </PressableFeedback>
  );
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
  const mutedColor = useThemeColor("muted");
  const compact = isLandscape;

  return (
    <BottomSheet isOpen={visible} onOpenChange={onOpenChange}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content
          snapPoints={[Math.min(520, screenHeight * 0.7)]}
          enablePanDownToClose
          backgroundStyle={{ backgroundColor: "rgba(30, 30, 30, 0.95)" }}
          handleIndicatorStyle={{ backgroundColor: mutedColor }}
        >
          <View className={compact ? "px-4 pb-4" : "px-6 pb-8"}>
            <Text className={`mb-1 font-bold text-foreground ${compact ? "text-base" : "text-lg"}`}>
              {t("files.importOptions")}
            </Text>
            <Text className="mb-4 text-xs text-muted">{t("files.selectImportMethod")}</Text>

            <ScrollView
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: screenHeight * 0.5 }}
            >
              <View className={compact ? "gap-1.5" : "gap-2"}>
                <ImportOptionItem
                  icon="document-outline"
                  title={t("files.importFile")}
                  subtitle={t("files.supportedFormatsShort")}
                  onPress={onImportFile}
                  compact={compact}
                />
                <ImportOptionItem
                  icon="folder-open-outline"
                  title={t("files.importFolder")}
                  subtitle={t("files.supportedFormatsHint")}
                  onPress={onImportFolder}
                  compact={compact}
                />
                <ImportOptionItem
                  icon="archive-outline"
                  title={t("files.importZip")}
                  subtitle={isZipImportAvailable ? "ZIP" : t("files.importZipUnavailable")}
                  onPress={onImportZip}
                  disabled={!isZipImportAvailable}
                  compact={compact}
                />
                <ImportOptionItem
                  icon="cloud-download-outline"
                  title={t("files.importFromUrl")}
                  subtitle={`HTTP / HTTPS · ${t("files.supportedFormatsShort")}`}
                  onPress={onImportUrl}
                  compact={compact}
                />
                <ImportOptionItem
                  icon="clipboard-outline"
                  title={t("files.importFromClipboard")}
                  subtitle={t("files.supportedFormatsShort")}
                  onPress={onImportClipboard}
                  compact={compact}
                />
                <ImportOptionItem
                  icon="images-outline"
                  title={t("files.importFromMediaLibrary")}
                  subtitle={t("files.mediaLibraryHint")}
                  onPress={onImportMediaLibrary}
                  compact={compact}
                />
                <ImportOptionItem
                  icon="videocam-outline"
                  title={t("files.recordVideo")}
                  subtitle={t("files.recordVideoHint")}
                  onPress={onRecordVideo}
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
