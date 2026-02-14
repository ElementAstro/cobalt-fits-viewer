import { View, Text, ScrollView } from "react-native";
import { Card, Chip, Separator, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";

const FEATURES = [
  {
    icon: "rocket-outline" as const,
    titleKey: "explore.features.expoRouter",
    descKey: "explore.features.expoRouterDesc",
  },
  {
    icon: "color-palette-outline" as const,
    titleKey: "explore.features.heroui",
    descKey: "explore.features.herouiDesc",
  },
  {
    icon: "brush-outline" as const,
    titleKey: "explore.features.uniwind",
    descKey: "explore.features.uniwindDesc",
  },
  {
    icon: "layers-outline" as const,
    titleKey: "explore.features.bottomSheet",
    descKey: "explore.features.bottomSheetDesc",
  },
  {
    icon: "flash-outline" as const,
    titleKey: "explore.features.reanimated",
    descKey: "explore.features.reanimatedDesc",
  },
  {
    icon: "lock-closed-outline" as const,
    titleKey: "explore.features.secureStore",
    descKey: "explore.features.secureStoreDesc",
  },
  {
    icon: "globe-outline" as const,
    titleKey: "explore.features.i18n",
    descKey: "explore.features.i18nDesc",
  },
];

export default function ExploreScreen() {
  const { t } = useI18n();
  const successColor = useThemeColor("success");

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="px-6 py-8">
      <Text className="text-2xl font-bold text-foreground">{t("explore.title")}</Text>
      <Text className="mt-1 text-sm text-muted">{t("explore.subtitle")}</Text>

      <Separator className="my-6" />

      <View className="gap-3">
        {FEATURES.map((feature) => (
          <Card key={feature.titleKey} variant="secondary">
            <Card.Body className="flex-row items-center gap-3 p-4">
              <View className="h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                <Ionicons name={feature.icon} size={20} color={successColor} />
              </View>
              <View className="min-w-0 flex-1">
                <Text className="text-sm font-semibold text-foreground">{t(feature.titleKey)}</Text>
                <Text className="text-xs text-muted">{t(feature.descKey)}</Text>
              </View>
            </Card.Body>
          </Card>
        ))}
      </View>

      <Separator className="my-6" />

      <View className="flex-row flex-wrap gap-2">
        <Chip size="sm" variant="secondary">
          <Chip.Label className="text-xs">TypeScript</Chip.Label>
        </Chip>
        <Chip size="sm" variant="secondary">
          <Chip.Label className="text-xs">Expo SDK 54</Chip.Label>
        </Chip>
        <Chip size="sm" variant="secondary">
          <Chip.Label className="text-xs">React 19</Chip.Label>
        </Chip>
        <Chip size="sm" variant="secondary">
          <Chip.Label className="text-xs">pnpm</Chip.Label>
        </Chip>
      </View>
    </ScrollView>
  );
}
