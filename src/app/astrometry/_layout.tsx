import { Stack } from "expo-router";

export default function AstrometryLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="result/[id]" />
    </Stack>
  );
}
