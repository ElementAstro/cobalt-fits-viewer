/**
 * UpdateBanner - Top banner notification shown when an OTA update is detected.
 * Displayed at app launch after a silent background check.
 */

import { useState, useEffect, useCallback } from "react";
import { View, Text, Animated } from "react-native";
import { Button, CloseButton, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useI18n } from "../../i18n/useI18n";
import { useAppUpdate } from "../../hooks/useAppUpdate";
import { useHapticFeedback } from "../../hooks/useHapticFeedback";
import { useSettingsStore } from "../../stores/useSettingsStore";

export function UpdateBanner() {
  const { t } = useI18n();
  const haptics = useHapticFeedback();
  const autoCheckUpdates = useSettingsStore((s) => s.autoCheckUpdates);
  const accentColor = useThemeColor("accent");
  const successColor = useThemeColor("success");

  const { status, checkForUpdate, downloadUpdate, applyUpdate } = useAppUpdate();

  const [dismissed, setDismissed] = useState(false);
  const [slideAnim] = useState(() => new Animated.Value(-100));

  const showBanner = !dismissed && (status === "available" || status === "ready");

  // Auto-check on mount (non-blocking, only in production)
  useEffect(() => {
    if (!__DEV__ && autoCheckUpdates) {
      const timer = setTimeout(() => {
        checkForUpdate();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [autoCheckUpdates, checkForUpdate]);

  // Animate banner in/out
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: showBanner ? 0 : -100,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start();
  }, [showBanner, slideAnim]);

  const handleAction = useCallback(async () => {
    haptics.impact(Haptics.ImpactFeedbackStyle.Medium);
    if (status === "available") {
      await downloadUpdate();
    } else if (status === "ready") {
      await applyUpdate();
    }
  }, [status, downloadUpdate, applyUpdate, haptics]);

  const handleDismiss = useCallback(() => {
    haptics.selection();
    setDismissed(true);
  }, [haptics]);

  if (dismissed && status !== "ready") return null;

  return (
    <Animated.View
      style={{ transform: [{ translateY: slideAnim }] }}
      className="absolute top-0 left-0 right-0 z-50"
      pointerEvents={showBanner ? "auto" : "none"}
    >
      <View className="mx-4 mt-14 flex-row items-center gap-3 rounded-xl bg-surface-secondary p-3 shadow-lg">
        <Ionicons
          name={status === "ready" ? "checkmark-circle" : "cloud-download-outline"}
          size={20}
          color={status === "ready" ? successColor : accentColor}
        />
        <View className="flex-1 min-w-0">
          <Text className="text-xs font-semibold text-foreground" numberOfLines={1}>
            {status === "ready" ? t("settings.readyToInstall") : t("settings.newVersionAvailable")}
          </Text>
          <Text className="text-[10px] text-muted">
            {status === "ready" ? t("settings.restart") : t("settings.downloadAndInstall")}
          </Text>
        </View>
        <Button size="sm" variant="ghost" onPress={handleAction}>
          <Button.Label style={{ color: status === "ready" ? successColor : accentColor }}>
            {status === "ready" ? t("settings.restart") : t("settings.updateAndRestart")}
          </Button.Label>
        </Button>
        <CloseButton onPress={handleDismiss} />
      </View>
    </Animated.View>
  );
}
