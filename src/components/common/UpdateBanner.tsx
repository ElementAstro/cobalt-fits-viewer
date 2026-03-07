/**
 * UpdateBanner - Top banner notification shown when an OTA update is detected.
 * Displayed at app launch after a silent background check.
 */

import { useState, useEffect, useCallback } from "react";
import { View, Text } from "react-native";
import ReAnimated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { Button, CloseButton } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useI18n } from "../../i18n/useI18n";
import { useAppUpdate } from "../../hooks/common/useAppUpdate";
import { useHapticFeedback } from "../../hooks/common/useHapticFeedback";
import { useSettingsStore } from "../../stores/app/useSettingsStore";

export function UpdateBanner() {
  const { t } = useI18n();
  const haptics = useHapticFeedback();
  const autoCheckUpdates = useSettingsStore((s) => s.autoCheckUpdates);

  const { status, checkForUpdate, downloadUpdate, applyUpdate } = useAppUpdate();

  const [dismissed, setDismissed] = useState(false);
  const slideAnim = useSharedValue(-100);

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
    slideAnim.value = withSpring(showBanner ? 0 : -100, { damping: 12, stiffness: 80 });
  }, [showBanner, slideAnim]);

  const bannerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slideAnim.value }],
  }));

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
    <ReAnimated.View
      style={bannerStyle}
      className="absolute top-0 left-0 right-0 z-50"
      pointerEvents={showBanner ? "auto" : "none"}
    >
      <View className="mx-4 mt-14 flex-row items-center gap-3 rounded-xl bg-surface-secondary p-3 shadow-lg">
        <Ionicons
          name={status === "ready" ? "checkmark-circle" : "cloud-download-outline"}
          size={20}
          className={status === "ready" ? "text-success" : "text-accent"}
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
          <Button.Label className={status === "ready" ? "text-success" : "text-accent"}>
            {status === "ready" ? t("settings.restart") : t("settings.updateAndRestart")}
          </Button.Label>
        </Button>
        <CloseButton onPress={handleDismiss} />
      </View>
    </ReAnimated.View>
  );
}
