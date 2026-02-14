/**
 * UpdateChecker - Inline update status component for the Settings page.
 * Shows current version, check/download/restart controls, and status feedback.
 */

import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Card, Separator, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useI18n } from "../../i18n/useI18n";
import { useAppUpdate } from "../../hooks/useAppUpdate";

export function UpdateChecker() {
  const { t } = useI18n();
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
    Haptics.selectionAsync();
    await checkForUpdate();
  };

  const handleDownload = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await downloadUpdate();
  };

  const handleRestart = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
        return <ActivityIndicator size="small" color={accentColor} />;
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
          <TouchableOpacity
            onPress={handleDownload}
            className="flex-row items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5"
          >
            <Ionicons name="cloud-download-outline" size={14} color={accentColor} />
            <Text style={{ color: accentColor }} className="text-xs font-semibold">
              {t("settings.downloadAndInstall")}
            </Text>
          </TouchableOpacity>
        );
      case "ready":
        return (
          <TouchableOpacity
            onPress={handleRestart}
            className="flex-row items-center gap-1.5 rounded-lg bg-success/10 px-3 py-1.5"
          >
            <Ionicons name="refresh-outline" size={14} color={successColor} />
            <Text style={{ color: successColor }} className="text-xs font-semibold">
              {t("settings.restart")}
            </Text>
          </TouchableOpacity>
        );
      case "error":
        return (
          <TouchableOpacity
            onPress={() => {
              clearError();
              handleCheck();
            }}
            className="flex-row items-center gap-1.5 rounded-lg bg-danger/10 px-3 py-1.5"
          >
            <Ionicons name="refresh-outline" size={14} color={dangerColor} />
            <Text style={{ color: dangerColor }} className="text-xs font-semibold">
              {t("common.retry")}
            </Text>
          </TouchableOpacity>
        );
      case "checking":
      case "downloading":
        return null;
      default:
        return (
          <TouchableOpacity
            onPress={handleCheck}
            className="flex-row items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5"
          >
            <Ionicons name="refresh-outline" size={14} color={accentColor} />
            <Text style={{ color: accentColor }} className="text-xs font-semibold">
              {t("settings.checkForUpdate")}
            </Text>
          </TouchableOpacity>
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
        <TouchableOpacity
          onPress={() => {}}
          accessibilityRole="button"
          accessibilityLabel={t("settings.licenses")}
        >
          <View className="flex-row items-center justify-between py-3">
            <View className="flex-row items-center gap-3">
              <Ionicons name="document-text-outline" size={18} color={mutedColor} />
              <Text className="text-sm text-foreground">{t("settings.licenses")}</Text>
            </View>
            <Text className="text-xs text-muted">{t("settings.licensesDetail")}</Text>
          </View>
        </TouchableOpacity>
      </Card.Body>
    </Card>
  );
}
