import { Stack } from "expo-router";
import { useThemeColor } from "heroui-native";

export default function SettingsLayout() {
  const backgroundColor = useThemeColor("background");

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        contentStyle: { backgroundColor },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="viewer" />
      <Stack.Screen name="gallery" />
      <Stack.Screen name="processing" />
      <Stack.Screen name="observation" />
      <Stack.Screen name="appearance" />
      <Stack.Screen name="storage" />
      <Stack.Screen name="about" />
      <Stack.Screen name="licenses" />
    </Stack>
  );
}
