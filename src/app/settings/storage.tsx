import { View, Text, ScrollView, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Separator } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "../../i18n/useI18n";
import { useScreenOrientation } from "../../hooks/useScreenOrientation";
import { useFitsStore } from "../../stores/useFitsStore";
import { useAstrometryStore } from "../../stores/useAstrometryStore";
import { useThumbnail } from "../../hooks/useThumbnail";
import { SettingsSection } from "../../components/settings";
import { SettingsRow } from "../../components/common/SettingsRow";
import { formatBytes } from "../../lib/utils/format";

export default function StorageSettingsScreen() {
  const { t } = useI18n();
  const { isLandscape } = useScreenOrientation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Storage info
  const allFiles = useFitsStore((s) => s.files);
  const filesCount = allFiles.length;
  const { clearCache, getCacheSize } = useThumbnail();

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

  const handleClearCache = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(t("settings.clearCache"), t("settings.clearCacheConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.confirm"),
        style: "destructive",
        onPress: () => {
          clearCache();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert(t("common.success"), t("settings.cacheCleared"));
        },
      },
    ]);
  };

  const handleClearAstrometryCompleted = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      t("settings.clearCompletedAstrometry"),
      t("settings.clearCompletedAstrometryConfirm"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.confirm"),
          style: "destructive",
          onPress: () => {
            clearCompletedAstrometryJobs();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ],
    );
  };

  const handleClearAstrometryAll = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(t("settings.clearAllAstrometry"), t("settings.clearAllAstrometryConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.confirm"),
        style: "destructive",
        onPress: () => {
          clearAllAstrometryJobs();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    ]);
  };

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: isLandscape ? 8 : insets.top + 8,
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
