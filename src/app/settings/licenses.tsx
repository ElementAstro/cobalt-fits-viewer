import { useMemo } from "react";
import { View, Text, ScrollView, Alert } from "react-native";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { Button, Card, Separator } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "../../i18n/useI18n";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";

const packageJson = require("../../../package.json") as {
  dependencies?: Record<string, string>;
};

const APP_LICENSE_URL = "https://github.com/ElementAstro/cobalt-fits-viewer/blob/main/LICENSE";

export default function LicensesScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { contentPaddingTop, horizontalPadding } = useResponsiveLayout();

  const dependencies = useMemo(
    () => Object.keys(packageJson.dependencies ?? {}).sort((a, b) => a.localeCompare(b)),
    [],
  );

  const openUrl = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(t("common.error"), t("share.failed"));
    }
  };

  return (
    <View testID="e2e-screen-settings__licenses" className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: horizontalPadding,
          paddingTop: contentPaddingTop,
          paddingBottom: insets.bottom + 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-4 flex-row items-center gap-3">
          <Button
            testID="e2e-action-settings__licenses-back"
            size="sm"
            variant="outline"
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={16} color="#888" />
          </Button>
          <Text className="text-xl font-bold text-foreground">{t("settings.licenses")}</Text>
        </View>

        <Card variant="secondary">
          <Card.Body className="gap-3 p-4">
            <View>
              <Text className="text-sm font-semibold text-foreground">
                {t("settings.appLicense")}
              </Text>
              <Text className="mt-1 text-xs text-muted">{t("settings.appLicenseDetail")}</Text>
            </View>
            <Button
              testID="e2e-action-settings__licenses-open-app-license"
              variant="outline"
              onPress={() => openUrl(APP_LICENSE_URL)}
            >
              <Ionicons name="document-text-outline" size={14} color="#888" />
              <Button.Label>{t("settings.openLicense")}</Button.Label>
            </Button>
          </Card.Body>
        </Card>

        <Separator className="my-4" />

        <View className="mb-2 flex-row items-center justify-between">
          <Text className="text-sm font-semibold text-foreground">
            {t("settings.thirdPartyLicenses")}
          </Text>
          <Text className="text-xs text-muted">
            {t("settings.packageCount", { count: dependencies.length })}
          </Text>
        </View>
        <Text className="mb-3 text-xs text-muted">{t("settings.thirdPartyLicensesDetail")}</Text>

        <View className="gap-2">
          {dependencies.map((pkg) => (
            <Button
              key={pkg}
              variant="ghost"
              className="justify-between rounded-lg border border-separator/50 px-3 py-2"
              onPress={() => openUrl(`https://www.npmjs.com/package/${pkg}`)}
            >
              <View className="flex-row items-center gap-2">
                <Ionicons name="cube-outline" size={14} color="#888" />
                <Button.Label className="text-xs text-foreground">{pkg}</Button.Label>
              </View>
              <Ionicons name="open-outline" size={14} color="#888" />
            </Button>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
