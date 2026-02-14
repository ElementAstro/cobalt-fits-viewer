/**
 * Animated Splash Screen
 *
 * Custom animated splash screen that seamlessly transitions from the native
 * splash screen to the app content using react-native-reanimated.
 *
 * Animation sequence:
 * 1. Logo scales up with spring + fades in
 * 2. App name slides up + fades in (delayed)
 * 3. Subtitle fades in (delayed)
 * 4. On ready: entire overlay fades out + scales up
 */

import { useCallback, useEffect, useState, type PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as SplashScreen from "expo-splash-screen";
import { useI18n } from "../../i18n/useI18n";
import { useFontFamily } from "./FontProvider";

const ENTRANCE_DURATION = 600;
const TITLE_DELAY = 300;
const SUBTITLE_DELAY = 500;
const EXIT_DURATION = 800;
const MIN_DISPLAY_MS = 1500;

export function AnimatedSplashScreen({ children }: PropsWithChildren) {
  const { t } = useI18n();
  const { getFontFamily } = useFontFamily();
  const [isAppReady, setIsAppReady] = useState(false);
  const [isSplashDone, setIsSplashDone] = useState(false);

  // --- Entrance animations ---
  const logoScale = useSharedValue(0.6);
  const logoOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(18);
  const titleOpacity = useSharedValue(0);
  const subtitleOpacity = useSharedValue(0);

  // --- Exit animation ---
  const overlayOpacity = useSharedValue(1);
  const overlayScale = useSharedValue(1);

  // Kick off entrance animations on mount
  useEffect(() => {
    // Logo: spring scale + fade in
    logoScale.value = withSpring(1, { damping: 14, stiffness: 120 });
    logoOpacity.value = withTiming(1, { duration: ENTRANCE_DURATION });

    // Title: slide up + fade in
    titleTranslateY.value = withDelay(
      TITLE_DELAY,
      withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) }),
    );
    titleOpacity.value = withDelay(TITLE_DELAY, withTiming(1, { duration: 500 }));

    // Subtitle: fade in
    subtitleOpacity.value = withDelay(SUBTITLE_DELAY, withTiming(1, { duration: 400 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hide the native splash screen once our animated overlay is mounted
  useEffect(() => {
    const timer = setTimeout(() => {
      SplashScreen.hide();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Mark app as ready after minimum display time
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsAppReady(true);
    }, MIN_DISPLAY_MS);
    return () => clearTimeout(timer);
  }, []);

  const onExitComplete = useCallback(() => {
    setIsSplashDone(true);
  }, []);

  // Trigger exit animation when app is ready
  useEffect(() => {
    if (!isAppReady) return;

    overlayOpacity.value = withTiming(
      0,
      { duration: EXIT_DURATION, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) {
          runOnJS(onExitComplete)();
        }
      },
    );
    overlayScale.value = withTiming(1.15, {
      duration: EXIT_DURATION,
      easing: Easing.out(Easing.cubic),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAppReady]);

  // --- Animated styles ---
  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslateY.value }],
  }));

  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
    transform: [{ scale: overlayScale.value }],
  }));

  return (
    <View style={styles.root}>
      {/* App content renders underneath */}
      {children}

      {/* Animated splash overlay */}
      {!isSplashDone && (
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.overlay, overlayStyle]}
          pointerEvents={isAppReady ? "none" : "auto"}
        >
          {/* Logo icon */}
          <Animated.View style={[styles.logoContainer, logoStyle]}>
            <View style={styles.logoCircle}>
              <Ionicons name="telescope" size={48} color="#22c55e" />
            </View>
          </Animated.View>

          {/* App name */}
          <Animated.Text
            style={[
              styles.title,
              titleStyle,
              getFontFamily("bold") ? { fontFamily: getFontFamily("bold") } : undefined,
            ]}
          >
            {t("splash.appName")}
          </Animated.Text>

          {/* Subtitle */}
          <Animated.Text
            style={[
              styles.subtitle,
              subtitleStyle,
              getFontFamily("regular") ? { fontFamily: getFontFamily("regular") } : undefined,
            ]}
          >
            {t("splash.tagline")}
          </Animated.Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  overlay: {
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
  },
  logoContainer: {
    marginBottom: 24,
  },
  logoCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2.5,
    borderColor: "#22c55e",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(34, 197, 94, 0.08)",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: 2,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    color: "#9ca3af",
    letterSpacing: 0.5,
  },
});
