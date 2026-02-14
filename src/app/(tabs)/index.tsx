import { View, Text, ScrollView } from "react-native";
import { Button, Card, Chip, Separator, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useI18n } from "../../i18n/useI18n";

export default function HomeScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const [successColor, foregroundColor, mutedColor] = useThemeColor([
    "success",
    "foreground",
    "muted",
  ]);

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="px-6 py-14">
      <Text className="text-3xl font-bold text-foreground">{t("home.title")}</Text>
      <Text className="mt-1 text-sm text-muted">{t("home.subtitle")}</Text>

      <Separator className="my-6" />

      <Card variant="secondary" className="border border-success/20">
        <Card.Body className="gap-3 p-5">
          <View className="flex-row items-center gap-2">
            <Ionicons name="checkmark-circle" size={18} color={successColor} />
            <Text className="text-base font-semibold text-foreground">
              {t("home.readyToBuild")}
            </Text>
          </View>
          <Text className="text-xs leading-relaxed text-muted-foreground">
            {t("home.readyDescription")}
          </Text>
          <View className="flex-row flex-wrap gap-1.5">
            <Chip size="sm" variant="secondary">
              <Chip.Label className="font-mono text-[10px]">expo-router</Chip.Label>
            </Chip>
            <Chip size="sm" variant="secondary">
              <Chip.Label className="font-mono text-[10px]">heroui-native</Chip.Label>
            </Chip>
            <Chip size="sm" variant="secondary">
              <Chip.Label className="font-mono text-[10px]">uniwind</Chip.Label>
            </Chip>
            <Chip size="sm" variant="secondary">
              <Chip.Label className="font-mono text-[10px]">tailwindcss</Chip.Label>
            </Chip>
          </View>
        </Card.Body>
      </Card>

      <Separator className="my-6" />

      <Text className="mb-3 font-mono text-sm text-muted">{t("home.quickActions")}</Text>

      <View className="gap-2">
        <Button variant="primary" onPress={() => router.push("/(tabs)/explore")}>
          <Ionicons name="compass-outline" size={16} color={foregroundColor} />
          <Button.Label>{t("home.exploreFeatures")}</Button.Label>
        </Button>

        <Button variant="outline">
          <Ionicons name="code-slash-outline" size={16} color={mutedColor} />
          <Button.Label>{t("home.editFile")}</Button.Label>
        </Button>
      </View>

      <Separator className="my-6" />

      <View className="rounded-xl border border-separator bg-surface-secondary p-4">
        <Text className="font-mono text-xs text-muted">
          {t("home.startCustomizing")}
          <Text className="text-success">src/app/</Text>
        </Text>
      </View>
    </ScrollView>
  );
}
