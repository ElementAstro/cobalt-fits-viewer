import { View, ScrollView, Alert } from "react-native";
import { Button, Separator } from "heroui-native";
import { SettingsHeader } from "../../components/settings";
import { SettingsToggleRow } from "../../components/common/SettingsToggleRow";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "../../i18n/useI18n";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import { useHapticFeedback } from "../../hooks/useHapticFeedback";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { useOnboardingStore } from "../../stores/useOnboardingStore";
import { SettingsSection } from "../../components/settings";
import { SettingsRow } from "../../components/common/SettingsRow";
import { OptionPickerModal } from "../../components/common/OptionPickerModal";
import { UpdateChecker } from "../../components/common/UpdateChecker";
import { SystemInfoCard } from "../../components/common/SystemInfoCard";
import { LogViewer } from "../../components/common/LogViewer";
import { useSettingsPicker } from "../../hooks/useSettingsPicker";
import type { LogLevel } from "../../lib/logger";

export default function AboutSettingsScreen() {
  const { t } = useI18n();
  const haptics = useHapticFeedback();
  const { contentPaddingTop, horizontalPadding } = useResponsiveLayout();
  const insets = useSafeAreaInsets();

  const resetToDefaults = useSettingsStore((s) => s.resetToDefaults);
  const hapticsEnabled = useSettingsStore((s) => s.hapticsEnabled);
  const confirmDestructiveActions = useSettingsStore((s) => s.confirmDestructiveActions);
  const autoCheckUpdates = useSettingsStore((s) => s.autoCheckUpdates);
  const logMinLevel = useSettingsStore((s) => s.logMinLevel);
  const logMaxEntries = useSettingsStore((s) => s.logMaxEntries);
  const logConsoleOutput = useSettingsStore((s) => s.logConsoleOutput);
  const logPersistEnabled = useSettingsStore((s) => s.logPersistEnabled);
  const setHapticsEnabled = useSettingsStore((s) => s.setHapticsEnabled);
  const setConfirmDestructiveActions = useSettingsStore((s) => s.setConfirmDestructiveActions);
  const setAutoCheckUpdates = useSettingsStore((s) => s.setAutoCheckUpdates);
  const setLogMinLevel = useSettingsStore((s) => s.setLogMinLevel);
  const setLogMaxEntries = useSettingsStore((s) => s.setLogMaxEntries);
  const setLogConsoleOutput = useSettingsStore((s) => s.setLogConsoleOutput);
  const setLogPersistEnabled = useSettingsStore((s) => s.setLogPersistEnabled);
  const resetOnboarding = useOnboardingStore((s) => s.resetOnboarding);
  const resetTooltipGuide = useOnboardingStore((s) => s.resetTooltipGuide);
  const { activePicker, openPicker, closePicker } = useSettingsPicker();

  const LOG_LEVEL_OPTIONS = [
    { label: "DEBUG", value: "debug" as LogLevel },
    { label: "INFO", value: "info" as LogLevel },
    { label: "WARN", value: "warn" as LogLevel },
    { label: "ERROR", value: "error" as LogLevel },
  ];

  const LOG_MAX_ENTRIES_OPTIONS = [
    { label: "1000", value: 1000 },
    { label: "2000", value: 2000 },
    { label: "5000", value: 5000 },
  ];

  const doResetAll = () => {
    resetToDefaults();
    haptics.notify(Haptics.NotificationFeedbackType.Success);
    Alert.alert(t("common.success"), t("settings.resetAllDone"));
  };

  const handleResetAll = () => {
    haptics.notify(Haptics.NotificationFeedbackType.Warning);
    if (!confirmDestructiveActions) {
      doResetAll();
      return;
    }

    Alert.alert(t("settings.resetAll"), t("settings.resetAllConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.confirm"),
        style: "destructive",
        onPress: doResetAll,
      },
    ]);
  };

  const handleRestartGuide = () => {
    haptics.selection();
    Alert.alert(t("onboarding.restartGuide"), t("onboarding.restartGuideConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.confirm"),
        onPress: () => {
          resetOnboarding();
          haptics.notify(Haptics.NotificationFeedbackType.Success);
        },
      },
    ]);
  };

  return (
    <View testID="e2e-screen-settings__about" className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: horizontalPadding,
          paddingTop: contentPaddingTop,
          paddingBottom: insets.bottom + 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <SettingsHeader title={t("settings.categories.about")} />

        {/* About & Updates */}
        <SettingsSection title={t("settings.about")}>
          <UpdateChecker />
        </SettingsSection>

        <Separator className="my-4" />

        {/* General */}
        <SettingsSection title={t("settings.general")}>
          <SettingsToggleRow
            icon="phone-portrait-outline"
            label={t("settings.hapticsEnabled")}
            isSelected={hapticsEnabled}
            onSelectedChange={setHapticsEnabled}
          />
          <Separator />
          <SettingsToggleRow
            icon="shield-checkmark-outline"
            label={t("settings.confirmDestructiveActions")}
            isSelected={confirmDestructiveActions}
            onSelectedChange={setConfirmDestructiveActions}
          />
          <Separator />
          <SettingsToggleRow
            icon="cloud-outline"
            label={t("settings.autoCheckUpdates")}
            isSelected={autoCheckUpdates}
            onSelectedChange={setAutoCheckUpdates}
          />
        </SettingsSection>

        <Separator className="my-4" />

        {/* System Info */}
        <SettingsSection title={t("systemInfo.title")}>
          <SystemInfoCard />
        </SettingsSection>

        <Separator className="my-4" />

        {/* App Logs */}
        <SettingsSection title={t("logs.configTitle")}>
          <SettingsRow
            icon="funnel-outline"
            label={t("logs.logMinLevel")}
            value={logMinLevel.toUpperCase()}
            onPress={() => openPicker("logLevel")}
          />
          <Separator />
          <SettingsRow
            icon="albums-outline"
            label={t("logs.logMaxEntries")}
            value={`${logMaxEntries}`}
            onPress={() => openPicker("logMaxEntries")}
          />
          <Separator />
          <SettingsToggleRow
            icon="terminal-outline"
            label={t("logs.logConsoleOutput")}
            isSelected={logConsoleOutput}
            onSelectedChange={setLogConsoleOutput}
          />
          <Separator />
          <SettingsToggleRow
            icon="save-outline"
            label={t("logs.logPersistEnabled")}
            isSelected={logPersistEnabled}
            onSelectedChange={setLogPersistEnabled}
          />
        </SettingsSection>

        <Separator className="my-4" />

        <LogViewer />

        <Separator className="my-4" />

        {/* Restart Guide */}
        <Button
          testID="e2e-action-settings__about-restart-guide"
          variant="outline"
          className="rounded-xl"
          onPress={handleRestartGuide}
          accessibilityLabel={t("onboarding.restartGuide")}
        >
          <Ionicons name="book-outline" size={16} />
          <Button.Label>{t("onboarding.restartGuide")}</Button.Label>
        </Button>

        <View className="h-2" />

        {/* Restart Tooltip Guide Only */}
        <Button
          variant="outline"
          className="rounded-xl"
          onPress={() => {
            haptics.selection();
            resetTooltipGuide();
            haptics.notify(Haptics.NotificationFeedbackType.Success);
          }}
          accessibilityLabel={t("onboarding.restartTooltipGuide" as Parameters<typeof t>[0])}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={16} />
          <Button.Label>
            {t("onboarding.restartTooltipGuide" as Parameters<typeof t>[0])}
          </Button.Label>
        </Button>

        <View className="h-3" />

        {/* Reset */}
        <Button
          testID="e2e-action-settings__about-reset-all"
          variant="danger-soft"
          className="rounded-xl"
          onPress={handleResetAll}
          accessibilityLabel={t("settings.resetAll")}
        >
          <Button.Label>{t("settings.resetAll")}</Button.Label>
        </Button>
      </ScrollView>

      <OptionPickerModal
        visible={activePicker === "logLevel"}
        title={t("logs.logMinLevel")}
        options={LOG_LEVEL_OPTIONS}
        selectedValue={logMinLevel}
        onSelect={(value) => setLogMinLevel(value as LogLevel)}
        onClose={closePicker}
      />
      <OptionPickerModal
        visible={activePicker === "logMaxEntries"}
        title={t("logs.logMaxEntries")}
        options={LOG_MAX_ENTRIES_OPTIONS}
        selectedValue={logMaxEntries}
        onSelect={setLogMaxEntries}
        onClose={closePicker}
      />
    </View>
  );
}
