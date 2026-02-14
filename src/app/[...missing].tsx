import { View, Text } from "react-native";
import { Button, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useI18n } from "../i18n/useI18n";

export default function NotFoundScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const [mutedColor, foregroundColor] = useThemeColor(["muted", "foreground"]);

  return (
    <View className="flex-1 items-center justify-center bg-background px-8">
      <Ionicons name="alert-circle-outline" size={64} color={mutedColor} />
      <Text className="mt-4 text-2xl font-bold text-foreground">{t("notFound.title")}</Text>
      <Text className="mt-2 text-center text-sm text-muted">{t("notFound.description")}</Text>
      <Button variant="primary" className="mt-6" onPress={() => router.replace("/")}>
        <Ionicons name="home-outline" size={16} color={foregroundColor} />
        <Button.Label>{t("common.goHome")}</Button.Label>
      </Button>
    </View>
  );
}
