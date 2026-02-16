import { Stack } from "expo-router";

export default function SettingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
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
    </Stack>
  );
}
