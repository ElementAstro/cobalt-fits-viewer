/**
 * Onboarding Screen
 *
 * Full-screen multi-step welcome guide shown on first launch.
 * Uses heroui-native components and react-native-reanimated for animations.
 */

import { useCallback, useEffect } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import { Button, Card, Separator, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useI18n } from "../../i18n/useI18n";
import { useScreenOrientation } from "../../hooks/useScreenOrientation";
import { useOnboardingStore, ONBOARDING_TOTAL_STEPS } from "../../stores/useOnboardingStore";

interface OnboardingStep {
  icon: keyof typeof Ionicons.glyphMap;
  titleKey: string;
  descriptionKey: string;
  features: string[];
}

const STEPS: OnboardingStep[] = [
  {
    icon: "telescope",
    titleKey: "onboarding.welcomeTitle",
    descriptionKey: "onboarding.welcomeDesc",
    features: [
      "onboarding.welcomeFeature1",
      "onboarding.welcomeFeature2",
      "onboarding.welcomeFeature3",
    ],
  },
  {
    icon: "folder-open-outline",
    titleKey: "onboarding.importTitle",
    descriptionKey: "onboarding.importDesc",
    features: [
      "onboarding.importFeature1",
      "onboarding.importFeature2",
      "onboarding.importFeature3",
    ],
  },
  {
    icon: "eye-outline",
    titleKey: "onboarding.viewerTitle",
    descriptionKey: "onboarding.viewerDesc",
    features: [
      "onboarding.viewerFeature1",
      "onboarding.viewerFeature2",
      "onboarding.viewerFeature3",
    ],
  },
  {
    icon: "images-outline",
    titleKey: "onboarding.galleryTitle",
    descriptionKey: "onboarding.galleryDesc",
    features: [
      "onboarding.galleryFeature1",
      "onboarding.galleryFeature2",
      "onboarding.galleryFeature3",
    ],
  },
  {
    icon: "moon-outline",
    titleKey: "onboarding.observeTitle",
    descriptionKey: "onboarding.observeDesc",
    features: [
      "onboarding.observeFeature1",
      "onboarding.observeFeature2",
      "onboarding.observeFeature3",
    ],
  },
];

const ANIM_DURATION = 350;

interface OnboardingScreenProps {
  onComplete: () => void;
}

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const { t } = useI18n();
  const { isLandscape } = useScreenOrientation();
  const insets = useSafeAreaInsets();
  const [accentColor, mutedColor, bgColor] = useThemeColor(["success", "muted", "background"]);

  const currentStep = useOnboardingStore((s) => s.currentStep);
  const setCurrentStep = useOnboardingStore((s) => s.setCurrentStep);
  const completeOnboarding = useOnboardingStore((s) => s.completeOnboarding);

  // Animation values
  const contentOpacity = useSharedValue(1);
  const contentTranslateX = useSharedValue(0);

  const isFirst = currentStep === 0;
  const isLast = currentStep === ONBOARDING_TOTAL_STEPS - 1;
  const step = STEPS[currentStep];

  // Entrance animation on mount
  useEffect(() => {
    contentOpacity.value = 0;
    contentTranslateX.value = 30;
    contentOpacity.value = withTiming(1, { duration: ANIM_DURATION });
    contentTranslateX.value = withTiming(0, {
      duration: ANIM_DURATION,
      easing: Easing.out(Easing.cubic),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animateTransition = useCallback(
    (direction: "next" | "prev", callback: () => void) => {
      const exitX = direction === "next" ? -30 : 30;

      contentOpacity.value = withTiming(0, { duration: ANIM_DURATION / 2 });
      contentTranslateX.value = withTiming(
        exitX,
        {
          duration: ANIM_DURATION / 2,
          easing: Easing.in(Easing.cubic),
        },
        (finished) => {
          if (finished) {
            runOnJS(callback)();
          }
        },
      );
    },
    [contentOpacity, contentTranslateX],
  );

  const enterAnimation = useCallback(
    (direction: "next" | "prev") => {
      const enterX = direction === "next" ? 30 : -30;
      contentTranslateX.value = enterX;
      contentOpacity.value = 0;
      contentOpacity.value = withTiming(1, { duration: ANIM_DURATION });
      contentTranslateX.value = withTiming(0, {
        duration: ANIM_DURATION,
        easing: Easing.out(Easing.cubic),
      });
    },
    [contentOpacity, contentTranslateX],
  );

  const handleNext = useCallback(() => {
    Haptics.selectionAsync();
    if (isLast) {
      completeOnboarding();
      onComplete();
    } else {
      animateTransition("next", () => {
        setCurrentStep(currentStep + 1);
        enterAnimation("next");
      });
    }
  }, [
    isLast,
    currentStep,
    completeOnboarding,
    onComplete,
    setCurrentStep,
    animateTransition,
    enterAnimation,
  ]);

  const handlePrev = useCallback(() => {
    if (isFirst) return;
    Haptics.selectionAsync();
    animateTransition("prev", () => {
      setCurrentStep(currentStep - 1);
      enterAnimation("prev");
    });
  }, [isFirst, currentStep, setCurrentStep, animateTransition, enterAnimation]);

  const handleSkip = useCallback(() => {
    Haptics.selectionAsync();
    completeOnboarding();
    onComplete();
  }, [completeOnboarding, onComplete]);

  const contentAnimStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateX: contentTranslateX.value }],
  }));

  const iconSize = isLandscape ? 56 : 96;
  const iconFontSize = isLandscape ? 28 : 48;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: bgColor,
          paddingTop: insets.top + (isLandscape ? 8 : 16),
          paddingBottom: insets.bottom + (isLandscape ? 8 : 24),
          paddingLeft: insets.left + 24,
          paddingRight: insets.right + 24,
        },
      ]}
    >
      {/* Skip button */}
      {!isLast && (
        <View style={styles.skipContainer}>
          <Button variant="ghost" size="sm" onPress={handleSkip}>
            <Button.Label className="text-muted">{t("onboarding.skip")}</Button.Label>
          </Button>
        </View>
      )}

      {/* Main content — scrollable for landscape / small screens */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <Animated.View style={[styles.content, contentAnimStyle]}>
          {/* Icon */}
          <View
            style={[
              styles.iconCircle,
              {
                width: iconSize,
                height: iconSize,
                borderRadius: iconSize / 2,
                borderColor: accentColor,
                backgroundColor: `${accentColor}10`,
                marginBottom: isLandscape ? 12 : 24,
              },
            ]}
          >
            <Ionicons name={step.icon} size={iconFontSize} color={accentColor} />
          </View>

          {/* Step indicator */}
          <View style={[styles.stepIndicator, { marginBottom: isLandscape ? 12 : 24 }]}>
            {STEPS.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  {
                    backgroundColor: index === currentStep ? accentColor : `${mutedColor}40`,
                    width: index === currentStep ? 24 : 8,
                  },
                ]}
              />
            ))}
          </View>

          {/* Title & Description */}
          <Text
            style={[styles.title, isLandscape && { fontSize: 20, marginBottom: 4 }]}
            className="text-foreground"
          >
            {t(step.titleKey as Parameters<typeof t>[0])}
          </Text>
          <Text style={styles.description} className="text-muted">
            {t(step.descriptionKey as Parameters<typeof t>[0])}
          </Text>

          {/* Feature list card */}
          <Card variant="secondary" className={`w-full ${isLandscape ? "mt-3" : "mt-6"}`}>
            <Card.Body className="px-4 py-3 gap-3">
              {step.features.map((featureKey, index) => (
                <View key={index}>
                  <View style={styles.featureRow}>
                    <Ionicons name="checkmark-circle" size={18} color={accentColor} />
                    <Text className="ml-3 flex-1 text-sm text-foreground">
                      {t(featureKey as Parameters<typeof t>[0])}
                    </Text>
                  </View>
                  {index < step.features.length - 1 && <Separator className="mt-3" />}
                </View>
              ))}
            </Card.Body>
          </Card>
        </Animated.View>
      </ScrollView>

      {/* Bottom navigation */}
      <View style={styles.bottomNav}>
        {!isFirst ? (
          <Button variant="outline" onPress={handlePrev}>
            <Ionicons name="arrow-back" size={16} color={mutedColor} />
            <Button.Label>{t("onboarding.prev")}</Button.Label>
          </Button>
        ) : (
          <View />
        )}

        <Button variant="primary" onPress={handleNext}>
          <Button.Label>{isLast ? t("onboarding.getStarted") : t("onboarding.next")}</Button.Label>
          {!isLast && <Ionicons name="arrow-forward" size={16} color="#fff" />}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  skipContainer: {
    alignItems: "flex-end",
    marginBottom: 8,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  iconCircle: {
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
  },
  stepIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 24,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  bottomNav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 16,
  },
});
