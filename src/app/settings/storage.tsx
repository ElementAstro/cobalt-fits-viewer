import { View, ScrollView, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Separator } from "heroui-native";
import { SettingsHeader } from "../../components/settings";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "../../i18n/useI18n";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import { useFitsStore } from "../../stores/useFitsStore";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { useAstrometryStore } from "../../stores/useAstrometryStore";
import { useHapticFeedback } from "../../hooks/useHapticFeedback";
import { useVideoTaskStore } from "../../stores/useVideoTaskStore";
import { useThumbnail } from "../../hooks/useThumbnail";
import { pruneThumbnailCacheWithPolicy } from "../../lib/gallery/thumbnailWorkflow";
import { SettingsSection } from "../../components/settings";
import { SettingsRow } from "../../components/common/SettingsRow";
import { SettingsSliderRow } from "../../components/common/SettingsSliderRow";
import { formatBytes } from "../../lib/utils/format";
import { useStorageStats } from "../../hooks/useStorageStats";
import { checkAndRepairFileSystemIntegrity } from "../../lib/utils/fileSystemIntegrity";

export default function StorageSettingsScreen() {
  const { t } = useI18n();
  const haptics = useHapticFeedback();
  const { contentPaddingTop, horizontalPadding } = useResponsiveLayout();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Storage info
  const allFiles = useFitsStore((s) => s.files);
  const updateFile = useFitsStore((s) => s.updateFile);
  const batchUpdateFiles = useFitsStore((s) => s.batchUpdateFiles);
  const filesCount = allFiles.length;
  const confirmDestructiveActions = useSettingsStore((s) => s.confirmDestructiveActions);
  const thumbnailCacheMaxSizeMB = useSettingsStore((s) => s.thumbnailCacheMaxSizeMB);
  const setThumbnailCacheMaxSizeMB = useSettingsStore((s) => s.setThumbnailCacheMaxSizeMB);
  const { clearCache, regenerateThumbnails, isGenerating, regenerateProgress } = useThumbnail();

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

  const clearThumbnailUris = () => {
    if (allFiles.length === 0) return;
    batchUpdateFiles(
      allFiles.map((file) => file.id),
      { thumbnailUri: undefined },
    );
  };

  const handleClearCache = () => {
    runDestructiveAction(t("settings.clearCache"), t("settings.clearCacheConfirm"), async () => {
      clearCache();
      clearThumbnailUris();
      clearExportCache();
      clearVideoCache();
      clearPixelCache();
      await refreshStorageStats();
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

  const hasActiveVideoTasks = useVideoTaskStore((s) =>
    s.tasks.some((t) => t.status === "running" || t.status === "pending"),
  );

  const {
    breakdown,
    refresh: refreshStorageStats,
    clearExportCache,
    clearVideoCache,
    clearPixelCache,
  } = useStorageStats();

  const handleClearVideoCache = () => {
    runDestructiveAction(
      t("settings.clearVideoProcessingCache"),
      t("settings.clearVideoProcessingCacheConfirm"),
      () => {
        clearVideoCache();
        haptics.notify(Haptics.NotificationFeedbackType.Success);
      },
    );
  };

  const handleClearExportCache = () => {
    runDestructiveAction(
      t("settings.clearExportCache"),
      t("settings.clearExportCacheConfirm"),
      () => {
        clearExportCache();
        haptics.notify(Haptics.NotificationFeedbackType.Success);
      },
    );
  };

  const handleClearPixelCache = () => {
    runDestructiveAction(
      t("settings.clearPixelCache"),
      t("settings.clearPixelCacheConfirm"),
      () => {
        clearPixelCache();
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
        clearThumbnailUris();

        const result = await regenerateThumbnails(allFiles);
        pruneThumbnailCacheWithPolicy({ thumbnailCacheMaxSizeMB }, { force: true });

        for (const item of result.results) {
          if (item.uri) {
            updateFile(item.fileId, { thumbnailUri: item.uri });
          }
        }

        await refreshStorageStats();
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
    <View testID="e2e-screen-settings__storage" className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: horizontalPadding,
          paddingTop: contentPaddingTop,
          paddingBottom: insets.bottom + 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <SettingsHeader title={t("settings.categories.storage")} />

        {/* Storage Info */}
        <SettingsSection title={t("settings.storage")}>
          <SettingsRow
            icon="server-outline"
            label={t("settings.storageUsage")}
            value={t("files.filesCount", { count: filesCount })}
          />
          <Separator />
          <SettingsRow
            icon="cube-outline"
            label={t("settings.filesTotalSize")}
            value={formatBytes(breakdown.filesTotalBytes)}
          />
          <Separator />
          <SettingsRow
            icon="trash-bin-outline"
            label={t("settings.trashSize")}
            value={`${breakdown.trashCount} · ${formatBytes(breakdown.trashTotalBytes)}`}
          />
          <Separator />
          <SettingsRow
            icon="folder-outline"
            label={t("settings.cacheSize")}
            value={formatBytes(breakdown.thumbnailCacheBytes)}
          />
          <Separator />
          <SettingsSliderRow
            testID="e2e-action-settings__storage-slider-thumbnail-cache-size"
            icon="resize-outline"
            label={t("settings.thumbnailCacheMaxSize")}
            value={thumbnailCacheMaxSizeMB}
            format={(value) => `${value} MB`}
            min={50}
            max={2000}
            step={50}
            debounceMs={0}
            onValueChange={(value) => {
              setThumbnailCacheMaxSizeMB(value);
              pruneThumbnailCacheWithPolicy({ thumbnailCacheMaxSizeMB: value }, { force: true });
              void refreshStorageStats();
            }}
          />
          <Separator />
          <SettingsRow
            icon="trash-outline"
            label={t("settings.clearCache")}
            onPress={handleClearCache}
            disabled={isGenerating || hasActiveVideoTasks}
          />
          <Separator />
          <SettingsRow
            icon="refresh-outline"
            label={t("settings.regenerateThumbnails")}
            value={
              regenerateProgress
                ? `${regenerateProgress.current} / ${regenerateProgress.total}`
                : isGenerating
                  ? t("settings.regenerating")
                  : undefined
            }
            onPress={handleRegenerateThumbnails}
            disabled={filesCount === 0 || isGenerating}
          />
          <Separator />
          <SettingsRow
            icon="videocam-outline"
            label={t("settings.videoProcessingCache")}
            value={formatBytes(breakdown.videoCacheBytes)}
          />
          <Separator />
          <SettingsRow
            icon="trash-outline"
            label={t("settings.clearVideoProcessingCache")}
            onPress={handleClearVideoCache}
            disabled={hasActiveVideoTasks}
          />
          <Separator />
          <SettingsRow
            icon="share-outline"
            label={t("settings.exportCache")}
            value={formatBytes(breakdown.exportCacheBytes)}
          />
          <Separator />
          <SettingsRow
            icon="trash-outline"
            label={t("settings.clearExportCache")}
            onPress={handleClearExportCache}
          />
          <Separator />
          <SettingsRow
            icon="analytics-outline"
            label={t("settings.pixelCache")}
            value={
              breakdown.pixelCacheEntries > 0
                ? `${breakdown.pixelCacheEntries} · ${formatBytes(breakdown.pixelCacheBytes)}`
                : formatBytes(0)
            }
          />
          <Separator />
          <SettingsRow
            icon="layers-outline"
            label={t("settings.imageLoadCache")}
            value={
              breakdown.imageLoadCacheEntries > 0
                ? `${breakdown.imageLoadCacheEntries} · ${formatBytes(breakdown.imageLoadCacheBytes)}`
                : formatBytes(0)
            }
          />
          <Separator />
          <SettingsRow
            icon="save-outline"
            label={t("settings.runtimeDiskCache")}
            value={
              breakdown.runtimeDiskCacheEntries > 0
                ? `${breakdown.runtimeDiskCacheEntries} · ${formatBytes(
                    breakdown.runtimeDiskCacheBytes,
                  )}`
                : formatBytes(0)
            }
          />
          <Separator />
          <SettingsRow
            icon="trash-outline"
            label={t("settings.clearPixelCache")}
            onPress={handleClearPixelCache}
            disabled={
              breakdown.pixelCacheEntries === 0 &&
              breakdown.imageLoadCacheEntries === 0 &&
              breakdown.runtimeDiskCacheEntries === 0
            }
          />
          {breakdown.freeDiskBytes !== null && (
            <>
              <Separator />
              <SettingsRow
                icon="hardware-chip-outline"
                label={t("settings.freeDiskSpace")}
                value={formatBytes(breakdown.freeDiskBytes)}
              />
            </>
          )}
          <Separator />
          <SettingsRow
            icon="shield-checkmark-outline"
            label={t("settings.checkIntegrity")}
            onPress={() => {
              runDestructiveAction(
                t("settings.checkIntegrity"),
                t("settings.checkIntegrityConfirm"),
                () => {
                  const result = checkAndRepairFileSystemIntegrity();
                  const total =
                    result.repairedGhosts + result.repairedOrphans + result.repairedTrashGhosts;
                  if (total === 0) {
                    Alert.alert(t("common.success"), t("settings.integrityClean"));
                  } else {
                    Alert.alert(
                      t("common.success"),
                      t("settings.integrityRepaired", {
                        ghosts: result.repairedGhosts,
                        orphans: result.repairedOrphans,
                        trashGhosts: result.repairedTrashGhosts,
                      }),
                    );
                  }
                  haptics.notify(Haptics.NotificationFeedbackType.Success);
                },
              );
            }}
          />
        </SettingsSection>

        {/* Backup */}
        <SettingsSection title={t("settings.backup")}>
          <SettingsRow
            testID="e2e-action-settings__storage-open-backup"
            icon="cloud-upload-outline"
            label={t("settings.backup")}
            onPress={() => router.push("/backup")}
          />
        </SettingsSection>

        {/* Plate Solve */}
        <SettingsSection title={t("astrometry.plateSolve")}>
          <SettingsRow
            testID="e2e-action-settings__storage-open-astrometry"
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
