/**
 * Tooltip Guide Hook + Context
 *
 * Provides a context-based API for managing the per-page bubble tooltip guide.
 * Uses heroui-native Popover for rendering; this module handles state + routing logic.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type PropsWithChildren,
} from "react";
import { usePathname } from "expo-router";
import { useOnboardingStore } from "../../stores/app/useOnboardingStore";
import {
  getPageStepCount,
  getStepConfig,
  GUIDE_PAGES,
  type GuideStepConfig,
} from "../../lib/onboarding/guideSteps";

interface TooltipGuideContextValue {
  isGuideActive: boolean;
  activePage: string | null;
  currentStep: number;
  totalStepsForPage: number;
  next: () => void;
  skip: () => void;
  skipAll: () => void;
}

const DEFAULT_CONTEXT: TooltipGuideContextValue = {
  isGuideActive: false,
  activePage: null,
  currentStep: 0,
  totalStepsForPage: 0,
  next: () => {},
  skip: () => {},
  skipAll: () => {},
};

const TooltipGuideContext = createContext<TooltipGuideContextValue>(DEFAULT_CONTEXT);

function pathnameToGuidePage(pathname: string): string | null {
  if (pathname === "/" || pathname === "/(tabs)" || pathname === "/(tabs)/index") return "files";
  if (pathname === "/(tabs)/gallery" || pathname === "/gallery") return "gallery";
  if (pathname === "/(tabs)/targets" || pathname === "/targets") return "targets";
  if (pathname === "/(tabs)/sessions" || pathname === "/sessions") return "sessions";
  return null;
}

export function TooltipGuideProvider({ children }: PropsWithChildren) {
  const pathname = usePathname();

  const hasCompletedOnboarding = useOnboardingStore((s) => s.hasCompletedOnboarding);
  const hasCompletedTooltipGuide = useOnboardingStore((s) => s.hasCompletedTooltipGuide);
  const completedGuidePages = useOnboardingStore((s) => s.completedGuidePages);
  const activeGuidePage = useOnboardingStore((s) => s.activeGuidePage);
  const tooltipStep = useOnboardingStore((s) => s.tooltipStep);
  const setActiveGuidePage = useOnboardingStore((s) => s.setActiveGuidePage);
  const nextTooltipStep = useOnboardingStore((s) => s.nextTooltipStep);
  const completeGuidePage = useOnboardingStore((s) => s.completeGuidePage);
  const completeTooltipGuide = useOnboardingStore((s) => s.completeTooltipGuide);

  const guideEnabled = hasCompletedOnboarding && !hasCompletedTooltipGuide;
  const delayRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-activate guide for current tab page
  useEffect(() => {
    if (!guideEnabled) return;

    const page = pathnameToGuidePage(pathname);
    if (!page) {
      // Not on a tab page — deactivate
      if (activeGuidePage) setActiveGuidePage(null);
      return;
    }

    if (completedGuidePages.includes(page)) {
      // Page already completed
      if (activeGuidePage === page) setActiveGuidePage(null);
      return;
    }

    if (activeGuidePage === page) return; // Already active

    // Delay activation so the page renders first
    if (delayRef.current) clearTimeout(delayRef.current);
    delayRef.current = setTimeout(() => {
      setActiveGuidePage(page);
    }, 600);

    return () => {
      if (delayRef.current) clearTimeout(delayRef.current);
    };
  }, [pathname, guideEnabled, completedGuidePages, activeGuidePage, setActiveGuidePage]);

  const totalStepsForPage = activeGuidePage ? getPageStepCount(activeGuidePage) : 0;
  const isGuideActive = guideEnabled && activeGuidePage !== null && totalStepsForPage > 0;

  const next = useCallback(() => {
    if (!activeGuidePage) return;
    const total = getPageStepCount(activeGuidePage);
    if (tooltipStep < total - 1) {
      nextTooltipStep();
    } else {
      // Last step of this page
      completeGuidePage(activeGuidePage);
      setActiveGuidePage(null);

      // Check if all pages are now completed
      const remaining = GUIDE_PAGES.filter(
        (p) => p !== activeGuidePage && !completedGuidePages.includes(p),
      );
      if (remaining.length === 0) {
        completeTooltipGuide();
      }
    }
  }, [
    activeGuidePage,
    tooltipStep,
    nextTooltipStep,
    completeGuidePage,
    setActiveGuidePage,
    completedGuidePages,
    completeTooltipGuide,
  ]);

  const skip = useCallback(() => {
    if (!activeGuidePage) return;
    completeGuidePage(activeGuidePage);
    setActiveGuidePage(null);
  }, [activeGuidePage, completeGuidePage, setActiveGuidePage]);

  const skipAll = useCallback(() => {
    completeTooltipGuide();
  }, [completeTooltipGuide]);

  const value: TooltipGuideContextValue = {
    isGuideActive,
    activePage: activeGuidePage,
    currentStep: tooltipStep,
    totalStepsForPage,
    next,
    skip,
    skipAll,
  };

  return <TooltipGuideContext.Provider value={value}>{children}</TooltipGuideContext.Provider>;
}

export function useGuideStep(
  page: string,
  order: number,
): {
  isActive: boolean;
  stepConfig: GuideStepConfig | undefined;
  currentStep: number;
  totalSteps: number;
  isLastStep: boolean;
  next: () => void;
  skip: () => void;
  skipAll: () => void;
} {
  const ctx = useContext(TooltipGuideContext);
  const isActive = ctx.isGuideActive && ctx.activePage === page && ctx.currentStep === order;
  const stepConfig = getStepConfig(page, order);
  const totalSteps = getPageStepCount(page);
  const isLastStep = order === totalSteps - 1;

  return {
    isActive,
    stepConfig,
    currentStep: ctx.currentStep,
    totalSteps,
    isLastStep,
    next: ctx.next,
    skip: ctx.skip,
    skipAll: ctx.skipAll,
  };
}
