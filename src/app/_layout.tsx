import "../global.css";

import { useCallback, useEffect, useState, type PropsWithChildren } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { HeroUINativeProvider } from "heroui-native";
import { useUniwind } from "uniwind";
import * as SplashScreen from "expo-splash-screen";
import * as ScreenOrientation from "expo-screen-orientation";
import { UpdateBanner } from "../components/common/UpdateBanner";
import { AnimatedSplashScreen } from "../components/common/AnimatedSplashScreen";
import { FontProvider } from "../components/common/FontProvider";
import { useFontLoader } from "../hooks/useFontLoader";
import { cleanOldExports } from "../lib/utils/imageExport";
import { useAutoSolve } from "../hooks/useAutoSolve";
import { useAutoBackup } from "../hooks/useAutoBackup";
import { useSettingsStore } from "../stores/useSettingsStore";
import { useOnboardingStore } from "../stores/useOnboardingStore";
import { OnboardingScreen } from "../components/common/OnboardingScreen";

SplashScreen.preventAutoHideAsync();

function AutoSolveProvider({ children }: { children: React.ReactNode }) {
  useAutoSolve();
  return <>{children}</>;
}

function AutoBackupProvider({ children }: { children: React.ReactNode }) {
  useAutoBackup();
  return <>{children}</>;
}

function OnboardingGate({ children }: PropsWithChildren) {
  const [hydrated, setHydrated] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Wait for zustand persist (AsyncStorage) to finish hydrating
  useEffect(() => {
    const unsub = useOnboardingStore.persist.onFinishHydration(() => {
      const completed = useOnboardingStore.getState().hasCompletedOnboarding;
      setShowOnboarding(!completed);
      setHydrated(true);
    });

    // If already hydrated synchronously (e.g. in tests)
    if (useOnboardingStore.persist.hasHydrated()) {
      const completed = useOnboardingStore.getState().hasCompletedOnboarding;
      setShowOnboarding(!completed);
      setHydrated(true);
    }

    return unsub;
  }, []);

  const handleComplete = useCallback(() => {
    setShowOnboarding(false);
  }, []);

  // While waiting for hydration, render nothing (splash is still visible)
  if (!hydrated) {
    return null;
  }

  if (showOnboarding) {
    return <OnboardingScreen onComplete={handleComplete} />;
  }

  return <>{children}</>;
}

const ORIENTATION_LOCK_MAP = {
  default: ScreenOrientation.OrientationLock.DEFAULT,
  portrait: ScreenOrientation.OrientationLock.PORTRAIT,
  landscape: ScreenOrientation.OrientationLock.LANDSCAPE,
} as const;

export default function RootLayout() {
  const { theme } = useUniwind();
  const { fontsLoaded, fontError } = useFontLoader();
  const orientationLock = useSettingsStore((s) => s.orientationLock);

  useEffect(() => {
    cleanOldExports();
  }, []);

  useEffect(() => {
    ScreenOrientation.lockAsync(ORIENTATION_LOCK_MAP[orientationLock]);
  }, [orientationLock]);

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
          <AutoSolveProvider>
            <AutoBackupProvider>
              <AnimatedSplashScreen>
                <OnboardingGate>
                  <StatusBar style={theme === "dark" ? "light" : "dark"} />
                  <Stack screenOptions={{ headerShown: false }} />
                  <UpdateBanner />
                </OnboardingGate>
              </AnimatedSplashScreen>
            </AutoBackupProvider>
          </AutoSolveProvider>
        </FontProvider>
      </HeroUINativeProvider>
    </GestureHandlerRootView>
  );
}
