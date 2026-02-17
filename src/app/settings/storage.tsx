import { View, Text, ScrollView, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Separator } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "../../i18n/useI18n";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import { useFitsStore } from "../../stores/useFitsStore";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { useAstrometryStore } from "../../stores/useAstrometryStore";
import { useHapticFeedback } from "../../hooks/useHapticFeedback";
import { useThumbnail } from "../../hooks/useThumbnail";
import { SettingsSection } from "../../components/settings";
import { SettingsRow } from "../../components/common/SettingsRow";
import { formatBytes } from "../../lib/utils/format";

export default function StorageSettingsScreen() {
  const { t } = useI18n();
  const haptics = useHapticFeedback();
  const { contentPaddingTop, horizontalPadding } = useResponsiveLayout();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Storage info
  const allFiles = useFitsStore((s) => s.files);
  const updateFile = useFitsStore((s) => s.updateFile);
  const filesCount = allFiles.length;
  const confirmDestructiveActions = useSettingsStore((s) => s.confirmDestructiveActions);
  const { clearCache, getCacheSize, regenerateThumbnails, isGenerating } = useThumbnail();

  // Astrometry status
  const astrometryConfig = useAstrometryStore((s) => s.config);
  const astrometryJobs = useAstrometryStore((s) => s.jobs);
  const clearCompletedAstrometryJobs = useAstrometryStore((s) => s.clearCompletedJobs);
  const clearAllAstrometryJobs = useAstrometryStore((s) => s.clearAllJobs);
  const astrometryActiveJobs = astrometryJobs.filter(
    (j) =>
      j.status === "pending" ||
      j.status === "uploading" ||
      j.status === "submitted" ||
      j.status === "solving",
  );
  const astrometryStatusText =
    astrometryActiveJobs.length > 0
      ? t("astrometry.activeJobs", { count: astrometryActiveJobs.length })
      : astrometryConfig.apiKey
        ? t("astrometry.connected")
        : t("astrometry.disconnected");
  const astrometryCompletedOrFailedCount = astrometryJobs.filter(
    (j) => j.status === "success" || j.status === "failure" || j.status === "cancelled",
  ).length;

  const formatCacheSize = () => {
    return formatBytes(getCacheSize());
  };

  const runDestructiveAction = (
    title: string,
    message: string,
    onConfirm: () => void | Promise<void>,
  ) => {
    haptics.notify(Haptics.NotificationFeedbackType.Warning);

    if (!confirmDestructiveActions) {
      void onConfirm();
      return;
    }

    Alert.alert(title, message, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.confirm"),
        style: "destructive",
        onPress: () => void onConfirm(),
      },
    ]);
  };

  const handleClearCache = () => {
    runDestructiveAction(t("settings.clearCache"), t("settings.clearCacheConfirm"), () => {
      clearCache();
      for (const file of allFiles) {
        updateFile(file.id, { thumbnailUri: undefined });
      }
      haptics.notify(Haptics.NotificationFeedbackType.Success);
      Alert.alert(t("common.success"), t("settings.cacheCleared"));
    });
  };

  const handleClearAstrometryCompleted = () => {
    runDestructiveAction(
      t("settings.clearCompletedAstrometry"),
      t("settings.clearCompletedAstrometryConfirm"),
      () => {
        clearCompletedAstrometryJobs();
        haptics.notify(Haptics.NotificationFeedbackType.Success);
      },
    );
  };

  const handleClearAstrometryAll = () => {
    runDestructiveAction(
      t("settings.clearAllAstrometry"),
      t("settings.clearAllAstrometryConfirm"),
      () => {
        clearAllAstrometryJobs();
        haptics.notify(Haptics.NotificationFeedbackType.Success);
      },
    );
  };

  const handleRegenerateThumbnails = () => {
    if (filesCount === 0 || isGenerating) return;

    runDestructiveAction(
      t("settings.regenerateThumbnails"),
      t("settings.regenerateConfirm"),
      async () => {
        clearCache();
        for (const file of allFiles) {
          updateFile(file.id, { thumbnailUri: undefined });
        }

        const result = await regenerateThumbnails(allFiles);

        for (const item of result.results) {
          if (item.uri) {
            updateFile(item.fileId, { thumbnailUri: item.uri });
          }
        }

        haptics.notify(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          t("settings.regenerateDone"),
          t("settings.regenerateResult", {
            success: result.success,
            skipped: result.skipped,
          }),
        );
      },
    );
  };

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: horizontalPadding,
          paddingTop: contentPaddingTop,
          paddingBottom: insets.bottom + 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="flex-row items-center gap-3 mb-4">
          <Ionicons name="arrow-back" size={24} color="#888" onPress={() => router.back()} />
          <Text className="text-xl font-bold text-foreground">
            {t("settings.categories.storage")}
          </Text>
        </View>

        {/* Storage Info */}
        <SettingsSection title={t("settings.storage")}>
          <SettingsRow
            icon="server-outline"
            label={t("settings.storageUsage")}
            value={t("files.filesCount", { count: filesCount })}
          />
          <Separator />
          <SettingsRow
            icon="folder-outline"
            label={t("settings.cacheSize")}
            value={formatCacheSize()}
          />
          <Separator />
          <SettingsRow
            icon="trash-outline"
            label={t("settings.clearCache")}
            onPress={handleClearCache}
            disabled={isGenerating}
          />
          <Separator />
          <SettingsRow
            icon="refresh-outline"
            label={t("settings.regenerateThumbnails")}
            value={isGenerating ? t("settings.regenerating") : undefined}
            onPress={handleRegenerateThumbnails}
            disabled={filesCount === 0 || isGenerating}
          />
        </SettingsSection>

        {/* Backup */}
        <SettingsSection title={t("settings.backup")}>
          <SettingsRow
            icon="cloud-upload-outline"
            label={t("settings.backup")}
            onPress={() => router.push("/backup")}
          />
        </SettingsSection>

        {/* Plate Solve */}
        <SettingsSection title={t("astrometry.plateSolve")}>
          <SettingsRow
            icon="planet-outline"
            label={t("astrometry.plateSolve")}
            value={astrometryStatusText}
            onPress={() => router.push("/astrometry")}
          />
          <Separator />
          <SettingsRow
            icon="trash-outline"
            label={t("settings.clearCompletedAstrometry")}
            value={`${astrometryCompletedOrFailedCount}`}
            onPress={handleClearAstrometryCompleted}
          />
          <Separator />
          <SettingsRow
            icon="trash-bin-outline"
            label={t("settings.clearAllAstrometry")}
            value={`${astrometryJobs.length}`}
            onPress={handleClearAstrometryAll}
          />
        </SettingsSection>
      </ScrollView>
    </View>
  );
}
