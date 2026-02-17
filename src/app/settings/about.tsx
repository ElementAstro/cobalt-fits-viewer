import { View, Text, ScrollView, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Button, Separator, Switch } from "heroui-native";
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
import { UpdateChecker } from "../../components/common/UpdateChecker";
import { SystemInfoCard } from "../../components/common/SystemInfoCard";
import { LogViewer } from "../../components/common/LogViewer";

export default function AboutSettingsScreen() {
  const { t } = useI18n();
  const haptics = useHapticFeedback();
  const { contentPaddingTop, horizontalPadding } = useResponsiveLayout();
  const router = useRouter();
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

  const openLogLevelPicker = () => {
    const levels = ["debug", "info", "warn", "error"] as const;
    Alert.alert(
      t("logs.logMinLevel"),
      t("logs.logMinLevelDesc"),
      [
        ...levels.map((level) => ({
          text: level.toUpperCase(),
          onPress: () => {
            haptics.selection();
            setLogMinLevel(level);
          },
        })),
        { text: t("common.cancel"), style: "cancel" as const },
      ],
      { cancelable: true },
    );
  };

  const openLogMaxEntriesPicker = () => {
    const options = [1000, 2000, 5000];
    Alert.alert(
      t("logs.logMaxEntries"),
      t("logs.logMaxEntriesDesc"),
      [
        ...options.map((value) => ({
          text: `${value}`,
          onPress: () => {
            haptics.selection();
            setLogMaxEntries(value);
          },
        })),
        { text: t("common.cancel"), style: "cancel" as const },
      ],
      { cancelable: true },
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
            {t("settings.categories.about")}
          </Text>
        </View>

        {/* About & Updates */}
        <SettingsSection title={t("settings.about")}>
          <UpdateChecker />
        </SettingsSection>

        <Separator className="my-4" />

        {/* General */}
        <SettingsSection title={t("settings.general")}>
          <SettingsRow
            icon="phone-portrait-outline"
            label={t("settings.hapticsEnabled")}
            rightElement={
              <Switch
                isSelected={hapticsEnabled}
                onSelectedChange={(value: boolean) => {
                  haptics.selection();
                  setHapticsEnabled(value);
                }}
              />
            }
          />
          <Separator />
          <SettingsRow
            icon="shield-checkmark-outline"
            label={t("settings.confirmDestructiveActions")}
            rightElement={
              <Switch
                isSelected={confirmDestructiveActions}
                onSelectedChange={(value: boolean) => {
                  haptics.selection();
                  setConfirmDestructiveActions(value);
                }}
              />
            }
          />
          <Separator />
          <SettingsRow
            icon="cloud-outline"
            label={t("settings.autoCheckUpdates")}
            rightElement={
              <Switch
                isSelected={autoCheckUpdates}
                onSelectedChange={(value: boolean) => {
                  haptics.selection();
                  setAutoCheckUpdates(value);
                }}
              />
            }
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
            onPress={openLogLevelPicker}
          />
          <Separator />
          <SettingsRow
            icon="albums-outline"
            label={t("logs.logMaxEntries")}
            value={`${logMaxEntries}`}
            onPress={openLogMaxEntriesPicker}
          />
          <Separator />
          <SettingsRow
            icon="terminal-outline"
            label={t("logs.logConsoleOutput")}
            rightElement={
              <Switch
                isSelected={logConsoleOutput}
                onSelectedChange={(value: boolean) => {
                  haptics.selection();
                  setLogConsoleOutput(value);
                }}
              />
            }
          />
          <Separator />
          <SettingsRow
            icon="save-outline"
            label={t("logs.logPersistEnabled")}
            rightElement={
              <Switch
                isSelected={logPersistEnabled}
                onSelectedChange={(value: boolean) => {
                  haptics.selection();
                  setLogPersistEnabled(value);
                }}
              />
            }
          />
        </SettingsSection>

        <Separator className="my-4" />

        <LogViewer />

        <Separator className="my-4" />

        {/* Restart Guide */}
        <Button
          variant="outline"
          className="rounded-xl"
          onPress={handleRestartGuide}
          accessibilityLabel={t("onboarding.restartGuide")}
        >
          <Ionicons name="book-outline" size={16} />
          <Button.Label>{t("onboarding.restartGuide")}</Button.Label>
        </Button>

        <View className="h-3" />

        {/* Reset */}
        <Button
          variant="danger-soft"
          className="rounded-xl"
          onPress={handleResetAll}
          accessibilityLabel={t("settings.resetAll")}
        >
          <Button.Label>{t("settings.resetAll")}</Button.Label>
        </Button>
      </ScrollView>
    </View>
  );
}
