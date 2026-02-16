import { View, Text, ScrollView, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Button, Separator } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "../../i18n/useI18n";
import { useScreenOrientation } from "../../hooks/useScreenOrientation";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { useOnboardingStore } from "../../stores/useOnboardingStore";
import { SettingsSection } from "../../components/settings";
import { UpdateChecker } from "../../components/common/UpdateChecker";
import { SystemInfoCard } from "../../components/common/SystemInfoCard";
import { LogViewer } from "../../components/common/LogViewer";

export default function AboutSettingsScreen() {
  const { t } = useI18n();
  const { isLandscape } = useScreenOrientation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const resetToDefaults = useSettingsStore((s) => s.resetToDefaults);
  const resetOnboarding = useOnboardingStore((s) => s.resetOnboarding);

  const handleResetAll = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(t("settings.resetAll"), t("settings.resetAllConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.confirm"),
        style: "destructive",
        onPress: () => {
          resetToDefaults();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert(t("common.success"), t("settings.resetAllDone"));
        },
      },
    ]);
  };

  const handleRestartGuide = () => {
    Haptics.selectionAsync();
    Alert.alert(t("onboarding.restartGuide"), t("onboarding.restartGuideConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.confirm"),
        onPress: () => {
          resetOnboarding();
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
            {t("settings.categories.about")}
          </Text>
        </View>

        {/* About & Updates */}
        <SettingsSection title={t("settings.about")}>
          <UpdateChecker />
        </SettingsSection>

        <Separator className="my-4" />

        {/* System Info */}
        <SettingsSection title={t("systemInfo.title")}>
          <SystemInfoCard />
        </SettingsSection>

        <Separator className="my-4" />

        {/* App Logs */}
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
