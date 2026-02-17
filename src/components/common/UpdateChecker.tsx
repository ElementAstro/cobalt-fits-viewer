/**
 * UpdateChecker - Inline update status component for the Settings page.
 * Shows current version, check/download/restart controls, and status feedback.
 */

import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { Button, Card, Separator, Spinner, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useI18n } from "../../i18n/useI18n";
import { useAppUpdate } from "../../hooks/useAppUpdate";
import { useHapticFeedback } from "../../hooks/useHapticFeedback";

export function UpdateChecker() {
  const { t } = useI18n();
  const router = useRouter();
  const haptics = useHapticFeedback();
  const successColor = useThemeColor("success");
  const dangerColor = useThemeColor("danger");
  const mutedColor = useThemeColor("muted");
  const accentColor = useThemeColor("accent");

  const {
    status,
    error,
    lastCheckedAt,
    appVersion,
    checkForUpdate,
    downloadUpdate,
    applyUpdate,
    clearError,
  } = useAppUpdate();

  const handleCheck = async () => {
    haptics.selection();
    await checkForUpdate();
  };

  const handleDownload = async () => {
    haptics.impact(Haptics.ImpactFeedbackStyle.Medium);
    await downloadUpdate();
  };

  const handleRestart = async () => {
    haptics.notify(Haptics.NotificationFeedbackType.Success);
    await applyUpdate();
  };

  const formatLastChecked = () => {
    if (!lastCheckedAt) return t("settings.neverChecked");
    const diff = Date.now() - lastCheckedAt;
    if (diff < 60_000) return t("settings.justNow");
    const minutes = Math.floor(diff / 60_000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  };

  const renderStatusIcon = () => {
    switch (status) {
      case "checking":
      case "downloading":
        return <Spinner size="sm" color="default" />;
      case "available":
        return <Ionicons name="cloud-download-outline" size={18} color={accentColor} />;
      case "ready":
        return <Ionicons name="checkmark-circle" size={18} color={successColor} />;
      case "upToDate":
        return <Ionicons name="checkmark-circle-outline" size={18} color={successColor} />;
      case "error":
        return <Ionicons name="alert-circle-outline" size={18} color={dangerColor} />;
      default:
        return <Ionicons name="refresh-outline" size={18} color={mutedColor} />;
    }
  };

  const renderStatusText = () => {
    switch (status) {
      case "checking":
        return t("settings.checking");
      case "downloading":
        return t("settings.downloading");
      case "available":
        return t("settings.updateAvailable");
      case "ready":
        return t("settings.readyToInstall");
      case "upToDate":
        return t("settings.noUpdate");
      case "error":
        return t("settings.updateFailed");
      default:
        return t("settings.checkForUpdate");
    }
  };

  const renderAction = () => {
    switch (status) {
      case "available":
        return (
          <Button size="sm" variant="ghost" onPress={handleDownload}>
            <Ionicons name="cloud-download-outline" size={14} color={accentColor} />
            <Button.Label>{t("settings.downloadAndInstall")}</Button.Label>
          </Button>
        );
      case "ready":
        return (
          <Button size="sm" variant="ghost" onPress={handleRestart}>
            <Ionicons name="refresh-outline" size={14} color={successColor} />
            <Button.Label className="text-success">{t("settings.restart")}</Button.Label>
          </Button>
        );
      case "error":
        return (
          <Button
            size="sm"
            variant="ghost"
            onPress={() => {
              clearError();
              handleCheck();
            }}
          >
            <Ionicons name="refresh-outline" size={14} color={dangerColor} />
            <Button.Label className="text-danger">{t("common.retry")}</Button.Label>
          </Button>
        );
      case "checking":
      case "downloading":
        return null;
      default:
        return (
          <Button size="sm" variant="ghost" onPress={handleCheck}>
            <Ionicons name="refresh-outline" size={14} color={accentColor} />
            <Button.Label>{t("settings.checkForUpdate")}</Button.Label>
          </Button>
        );
    }
  };

  return (
    <Card variant="secondary">
      <Card.Body className="px-4 py-1">
        {/* Version */}
        <View className="flex-row items-center justify-between py-3">
          <View className="flex-row items-center gap-3">
            <Ionicons name="information-circle-outline" size={18} color={successColor} />
            <Text className="text-sm text-foreground">{t("settings.currentVersion")}</Text>
          </View>
          <Text className="text-xs text-muted">v{appVersion}</Text>
        </View>

        <Separator />

        {/* Update Status */}
        <View className="py-3">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              {renderStatusIcon()}
              <View>
                <Text className="text-sm text-foreground">{renderStatusText()}</Text>
                {lastCheckedAt && (
                  <Text className="text-[10px] text-muted">
                    {t("settings.lastChecked")}: {formatLastChecked()}
                  </Text>
                )}
              </View>
            </View>
            {renderAction()}
          </View>

          {/* Error detail */}
          {status === "error" && error && (
            <Text className="mt-2 text-[10px] text-danger" numberOfLines={2}>
              {error}
            </Text>
          )}

          {/* Download progress indicator */}
          {status === "downloading" && (
            <View className="mt-2">
              <View className="h-1.5 w-full rounded-full bg-muted/20">
                <View className="h-1.5 w-1/2 rounded-full bg-accent animate-pulse" />
              </View>
            </View>
          )}
        </View>

        <Separator />

        {/* Licenses */}
        <Button
          variant="ghost"
          className="w-full justify-between px-0"
          onPress={() => router.push("/settings/licenses")}
          accessibilityRole="button"
          accessibilityLabel={t("settings.licenses")}
        >
          <View className="flex-row items-center gap-3">
            <Ionicons name="document-text-outline" size={18} color={mutedColor} />
            <Button.Label className="text-sm text-foreground">
              {t("settings.licenses")}
            </Button.Label>
          </View>
          <Text className="text-xs text-muted">{t("settings.licensesDetail")}</Text>
        </Button>
      </Card.Body>
    </Card>
  );
}
