import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { Button, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";

interface SettingsHeaderProps {
  title: string;
  testID?: string;
}

export function SettingsHeader({ title, testID }: SettingsHeaderProps) {
  const router = useRouter();
  const mutedColor = useThemeColor("muted");

  return (
    <View className="mb-4 flex-row items-center gap-3">
      <Button
        testID={testID}
        size="sm"
        variant="outline"
        isIconOnly
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Ionicons name="arrow-back" size={16} color={mutedColor} />
      </Button>
      <Text className="text-xl font-bold text-foreground">{title}</Text>
    </View>
  );
}
