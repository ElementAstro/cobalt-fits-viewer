/**
 * 系统信息展示卡片
 */

import { View, Text, ActivityIndicator } from "react-native";
import { Button, Card, Separator, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useI18n } from "../../i18n/useI18n";
import { useSystemInfo } from "../../hooks/useLogger";
import { useHapticFeedback } from "../../hooks/useHapticFeedback";
import { formatBytes } from "../../lib/logger";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between py-1.5">
      <Text className="text-xs text-muted">{label}</Text>
      <Text className="text-xs text-foreground" selectable>
        {value || "N/A"}
      </Text>
    </View>
  );
}

function SectionHeader({
  icon,
  title,
  iconColor,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  iconColor?: string;
}) {
  const mutedColor = useThemeColor("muted");
  return (
    <View className="flex-row items-center gap-2 py-2">
      <Ionicons name={icon} size={14} color={iconColor ?? mutedColor} />
      <Text className="text-xs font-semibold uppercase text-muted">{title}</Text>
    </View>
  );
}

export function SystemInfoCard() {
  const { t } = useI18n();
  const accentColor = useThemeColor("accent");
  const successColor = useThemeColor("success");
  const haptics = useHapticFeedback();

  const { systemInfo, isCollecting, refreshSystemInfo, getFormattedInfo } = useSystemInfo();

  const handleCopy = async () => {
    const text = getFormattedInfo();
    if (text) {
      await Clipboard.setStringAsync(text);
      haptics.notify(Haptics.NotificationFeedbackType.Success);
    }
  };

  if (isCollecting && !systemInfo) {
    return (
      <Card variant="secondary">
        <Card.Body className="items-center py-8">
          <ActivityIndicator size="small" color={accentColor} />
          <Text className="mt-2 text-xs text-muted">{t("systemInfo.collecting")}</Text>
        </Card.Body>
      </Card>
    );
  }

  if (!systemInfo) return null;

  const { device, app, battery, network, runtime } = systemInfo;

  return (
    <Card variant="secondary">
      <Card.Body className="px-4 py-2">
        {/* Device */}
        <SectionHeader icon="phone-portrait-outline" title={t("systemInfo.device")} />
        <InfoRow label={t("systemInfo.brand")} value={device.brand ?? "N/A"} />
        <InfoRow label={t("systemInfo.model")} value={device.modelName ?? "N/A"} />
        <InfoRow label={t("systemInfo.deviceType")} value={device.deviceType} />
        <InfoRow
          label={t("systemInfo.os")}
          value={`${device.osName ?? ""} ${device.osVersion ?? ""}`}
        />
        <InfoRow
          label={t("systemInfo.memory")}
          value={device.totalMemory ? formatBytes(device.totalMemory) : "N/A"}
        />
        <InfoRow label={t("systemInfo.isDevice")} value={device.isDevice ? "Yes" : "Simulator"} />

        <Separator className="my-1" />

        {/* App */}
        <SectionHeader icon="apps-outline" title={t("systemInfo.app")} iconColor={accentColor} />
        <InfoRow
          label={t("systemInfo.appVersion")}
          value={`${app.appVersion ?? "N/A"} (${app.buildVersion ?? "N/A"})`}
        />
        <InfoRow label={t("systemInfo.appId")} value={app.appId ?? "N/A"} />
        {app.runtimeVersion && (
          <InfoRow label={t("systemInfo.runtimeVersion")} value={app.runtimeVersion} />
        )}
        {app.sdkVersion && <InfoRow label={t("systemInfo.sdkVersion")} value={app.sdkVersion} />}
        <InfoRow label={t("systemInfo.debugMode")} value={app.isDebugMode ? "Yes" : "No"} />

        <Separator className="my-1" />

        {/* Battery */}
        <SectionHeader
          icon="battery-half-outline"
          title={t("systemInfo.battery")}
          iconColor={successColor}
        />
        <InfoRow
          label={t("systemInfo.batteryLevel")}
          value={battery.level >= 0 ? `${battery.level}%` : "N/A"}
        />
        <InfoRow label={t("systemInfo.batteryState")} value={battery.state} />
        <InfoRow
          label={t("systemInfo.lowPowerMode")}
          value={battery.isLowPowerMode ? "Yes" : "No"}
        />

        <Separator className="my-1" />

        {/* Network */}
        <SectionHeader icon="wifi-outline" title={t("systemInfo.network")} />
        <InfoRow label={t("systemInfo.networkType")} value={network.type} />
        <InfoRow label={t("systemInfo.connected")} value={network.isConnected ? "Yes" : "No"} />
        {network.ipAddress && (
          <InfoRow label={t("systemInfo.ipAddress")} value={network.ipAddress} />
        )}

        <Separator className="my-1" />

        {/* Runtime */}
        <SectionHeader icon="code-slash-outline" title={t("systemInfo.runtime")} />
        <InfoRow label={t("systemInfo.platform")} value={runtime.platform} />
        <InfoRow
          label={t("systemInfo.screen")}
          value={`${Math.round(runtime.screenWidth)}×${Math.round(runtime.screenHeight)}`}
        />
        <InfoRow label={t("systemInfo.pixelRatio")} value={`${runtime.pixelRatio.toFixed(1)}`} />
        <InfoRow label={t("systemInfo.fontScale")} value={`${runtime.fontScale.toFixed(2)}`} />

        <Separator className="my-2" />

        {/* Actions */}
        <View className="flex-row items-center justify-between py-2">
          <Button
            size="sm"
            variant="ghost"
            onPress={() => {
              haptics.selection();
              refreshSystemInfo();
            }}
          >
            <Ionicons name="refresh-outline" size={14} color={accentColor} />
            <Button.Label>{t("systemInfo.refresh")}</Button.Label>
          </Button>

          <Button size="sm" variant="ghost" onPress={handleCopy}>
            <Ionicons name="copy-outline" size={14} color={accentColor} />
            <Button.Label>{t("systemInfo.copy")}</Button.Label>
          </Button>
        </View>
      </Card.Body>
    </Card>
  );
}
