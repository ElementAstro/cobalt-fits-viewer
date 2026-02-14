import "../global.css";

import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { HeroUINativeProvider } from "heroui-native";
import { useUniwind } from "uniwind";
import * as SplashScreen from "expo-splash-screen";
import { UpdateBanner } from "../components/common/UpdateBanner";
import { AnimatedSplashScreen } from "../components/common/AnimatedSplashScreen";
import { FontProvider } from "../components/common/FontProvider";
import { useFontLoader } from "../hooks/useFontLoader";
import { cleanOldExports } from "../lib/utils/imageExport";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { theme } = useUniwind();
  const { fontsLoaded, fontError } = useFontLoader();

  useEffect(() => {
    cleanOldExports();
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <HeroUINativeProvider>
        <FontProvider>
          <AnimatedSplashScreen>
            <StatusBar style={theme === "dark" ? "light" : "dark"} />
            <Stack screenOptions={{ headerShown: false }} />
            <UpdateBanner />
          </AnimatedSplashScreen>
        </FontProvider>
      </HeroUINativeProvider>
    </GestureHandlerRootView>
  );
}
