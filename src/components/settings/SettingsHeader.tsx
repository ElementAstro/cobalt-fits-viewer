import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { Button } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";

interface SettingsHeaderProps {
  title: string;
  testID?: string;
}

export function SettingsHeader({ title, testID }: SettingsHeaderProps) {
  const router = useRouter();

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
        <Ionicons name="arrow-back" size={16} color="#888" />
      </Button>
      <Text className="text-xl font-bold text-foreground">{title}</Text>
    </View>
  );
}
