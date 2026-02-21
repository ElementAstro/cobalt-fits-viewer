import "../global.css";
import "../lib/polyfills/webCrypto";

import { useCallback, useEffect, useState, type PropsWithChildren } from "react";
import { Text, View } from "react-native";
import { Stack } from "expo-router";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
  type Theme as NavigationTheme,
} from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { HeroUINativeProvider, useThemeColor } from "heroui-native";
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
import { bootstrapE2EFullScenario } from "../e2e/bootstrap";
import { isE2EMode } from "../e2e/env";

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
  const e2eMode = isE2EMode();
  const [hydrated, setHydrated] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Wait for zustand persist (AsyncStorage) to finish hydrating
  useEffect(() => {
    if (e2eMode) {
      setShowOnboarding(false);
      setHydrated(true);
      return;
    }

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
  }, [e2eMode]);

  const handleComplete = useCallback(() => {
    setShowOnboarding(false);
  }, []);

  if (e2eMode) {
    return <>{children}</>;
  }

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

function ThemedRootStack() {
  const backgroundColor = useThemeColor("background");
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor } }} />;
}

function ThemedAppContainer({ children }: PropsWithChildren) {
  const backgroundColor = useThemeColor("background");
  return <View style={{ flex: 1, backgroundColor }}>{children}</View>;
}

function NavigationThemeBridge({ isDark, children }: PropsWithChildren<{ isDark: boolean }>) {
  const [backgroundColor, cardColor, textColor, borderColor, primaryColor, notificationColor] =
    useThemeColor(["background", "surface", "foreground", "separator", "accent", "danger"]);

  const theme: NavigationTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme : DefaultTheme).colors,
      background: backgroundColor,
      card: cardColor,
      text: textColor,
      border: borderColor,
      primary: primaryColor,
      notification: notificationColor,
    },
  };

  return <ThemeProvider value={theme}>{children}</ThemeProvider>;
}

export default function RootLayout() {
  const e2eMode = isE2EMode();
  const { theme } = useUniwind();
  const { fontsLoaded, fontError } = useFontLoader();
  const orientationLock = useSettingsStore((s) => s.orientationLock);
  const logMinLevel = useSettingsStore((s) => s.logMinLevel);
  const logMaxEntries = useSettingsStore((s) => s.logMaxEntries);
  const logConsoleOutput = useSettingsStore((s) => s.logConsoleOutput);
  const logPersistEnabled = useSettingsStore((s) => s.logPersistEnabled);
  const [settingsHydrated, setSettingsHydrated] = useState(false);
  const [e2eReady, setE2eReady] = useState(!e2eMode);

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

  useEffect(() => {
    if (!e2eMode || !settingsHydrated) return;
    let cancelled = false;
    void bootstrapE2EFullScenario().finally(() => {
      if (!cancelled) {
        setE2eReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [e2eMode, settingsHydrated]);

  if ((!fontsLoaded && !fontError) || !settingsHydrated || !e2eReady) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <HeroUINativeProvider>
        <NavigationThemeBridge isDark={theme === "dark"}>
          <FontProvider>
            <AutoSolveProvider>
              <AutoBackupProvider>
                <TargetIntegrityProvider>
                  <AnimatedSplashScreen>
                    <OnboardingGate>
                      <ThemedAppContainer>
                        <StatusBar style={theme === "dark" ? "light" : "dark"} />
                        <ThemedRootStack />
                        {e2eMode ? (
                          <Text
                            testID="e2e-bootstrap-ready"
                            style={{
                              position: "absolute",
                              width: 0,
                              height: 0,
                              opacity: 0,
                            }}
                          >
                            ready
                          </Text>
                        ) : null}
                        <UpdateBanner />
                      </ThemedAppContainer>
                    </OnboardingGate>
                  </AnimatedSplashScreen>
                </TargetIntegrityProvider>
              </AutoBackupProvider>
            </AutoSolveProvider>
          </FontProvider>
        </NavigationThemeBridge>
      </HeroUINativeProvider>
    </GestureHandlerRootView>
  );
}
