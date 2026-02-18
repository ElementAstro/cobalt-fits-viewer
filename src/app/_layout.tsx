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
import { Logger, cleanLogExports, initLoggerRuntime } from "../lib/logger";
import { useSettingsStore } from "../stores/useSettingsStore";
import { useOnboardingStore } from "../stores/useOnboardingStore";
import { useTargetStore } from "../stores/useTargetStore";
import { useFitsStore } from "../stores/useFitsStore";
import { useTargetGroupStore } from "../stores/useTargetGroupStore";
import { useSessionStore } from "../stores/useSessionStore";
import { OnboardingScreen } from "../components/common/OnboardingScreen";
import { reconcileAllStores } from "../lib/targets/targetIntegrity";

SplashScreen.preventAutoHideAsync();

function AutoSolveProvider({ children }: { children: React.ReactNode }) {
  useAutoSolve();
  return <>{children}</>;
}

function AutoBackupProvider({ children }: { children: React.ReactNode }) {
  useAutoBackup();
  return <>{children}</>;
}

function TargetIntegrityProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    let hasReconciled = false;
    const storeHydrated = () =>
      useTargetStore.persist.hasHydrated() &&
      useFitsStore.persist.hasHydrated() &&
      useTargetGroupStore.persist.hasHydrated() &&
      useSessionStore.persist.hasHydrated();

    const tryReconcile = () => {
      if (hasReconciled || !storeHydrated()) return;
      hasReconciled = true;
      const patch = reconcileAllStores();
      if (!patch.valid) {
        Logger.error(
          "TargetIntegrity",
          "Target graph validation failed after hydration",
          patch.errors,
        );
        return;
      }
      if (patch.changed) {
        Logger.info("TargetIntegrity", "Target graph reconciled", patch.report);
      }
    };

    const unsubTarget = useTargetStore.persist.onFinishHydration(tryReconcile);
    const unsubFits = useFitsStore.persist.onFinishHydration(tryReconcile);
    const unsubGroup = useTargetGroupStore.persist.onFinishHydration(tryReconcile);
    const unsubSession = useSessionStore.persist.onFinishHydration(tryReconcile);
    tryReconcile();

    return () => {
      unsubTarget?.();
      unsubFits?.();
      unsubGroup?.();
      unsubSession?.();
    };
  }, []);

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
  const logMinLevel = useSettingsStore((s) => s.logMinLevel);
  const logMaxEntries = useSettingsStore((s) => s.logMaxEntries);
  const logConsoleOutput = useSettingsStore((s) => s.logConsoleOutput);
  const logPersistEnabled = useSettingsStore((s) => s.logPersistEnabled);
  const [settingsHydrated, setSettingsHydrated] = useState(false);

  useEffect(() => {
    cleanOldExports();
    cleanLogExports();
    void initLoggerRuntime();
  }, []);

  useEffect(() => {
    const unsub = useSettingsStore.persist.onFinishHydration(() => {
      setSettingsHydrated(true);
    });

    if (useSettingsStore.persist.hasHydrated()) {
      setSettingsHydrated(true);
    }

    return unsub;
  }, []);

  useEffect(() => {
    ScreenOrientation.lockAsync(ORIENTATION_LOCK_MAP[orientationLock]);
  }, [orientationLock]);

  useEffect(() => {
    Logger.configure({
      minLevel: logMinLevel,
      maxEntries: logMaxEntries,
      consoleOutput: logConsoleOutput,
      persistEnabled: logPersistEnabled,
    });
  }, [logMinLevel, logMaxEntries, logConsoleOutput, logPersistEnabled]);

  useEffect(() => {
    if ((fontsLoaded || fontError) && settingsHydrated) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, settingsHydrated]);

  if ((!fontsLoaded && !fontError) || !settingsHydrated) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <HeroUINativeProvider>
        <FontProvider>
          <AutoSolveProvider>
            <AutoBackupProvider>
              <TargetIntegrityProvider>
                <AnimatedSplashScreen>
                  <OnboardingGate>
                    <StatusBar style={theme === "dark" ? "light" : "dark"} />
                    <Stack screenOptions={{ headerShown: false }} />
                    <UpdateBanner />
                  </OnboardingGate>
                </AnimatedSplashScreen>
              </TargetIntegrityProvider>
            </AutoBackupProvider>
          </AutoSolveProvider>
        </FontProvider>
      </HeroUINativeProvider>
    </GestureHandlerRootView>
  );
}
