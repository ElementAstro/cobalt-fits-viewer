/**
 * Onboarding Store
 *
 * Manages onboarding/welcome guide state with MMKV persistence.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { zustandAsyncStorage } from "../lib/storage";

interface OnboardingStoreState {
  hasCompletedOnboarding: boolean;
  currentStep: number;

  hasCompletedTooltipGuide: boolean;
  completedGuidePages: string[];
  activeGuidePage: string | null;
  tooltipStep: number;

  completeOnboarding: () => void;
  resetOnboarding: () => void;
  setCurrentStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;

  completeGuidePage: (pageId: string) => void;
  completeTooltipGuide: () => void;
  setActiveGuidePage: (pageId: string | null) => void;
  setTooltipStep: (step: number) => void;
  nextTooltipStep: () => void;
  resetTooltipGuide: () => void;
}

export const ONBOARDING_TOTAL_STEPS = 5;

export const useOnboardingStore = create<OnboardingStoreState>()(
  persist(
    (set, get) => ({
      hasCompletedOnboarding: false,
      currentStep: 0,

      hasCompletedTooltipGuide: false,
      completedGuidePages: [],
      activeGuidePage: null,
      tooltipStep: 0,

      completeOnboarding: () => set({ hasCompletedOnboarding: true, currentStep: 0 }),

      resetOnboarding: () =>
        set({
          hasCompletedOnboarding: false,
          currentStep: 0,
          hasCompletedTooltipGuide: false,
          completedGuidePages: [],
          activeGuidePage: null,
          tooltipStep: 0,
        }),

      setCurrentStep: (step: number) => set({ currentStep: step }),

      nextStep: () => {
        const { currentStep } = get();
        if (currentStep < ONBOARDING_TOTAL_STEPS - 1) {
          set({ currentStep: currentStep + 1 });
        }
      },

      prevStep: () => {
        const { currentStep } = get();
        if (currentStep > 0) {
          set({ currentStep: currentStep - 1 });
        }
      },

      completeGuidePage: (pageId: string) => {
        const { completedGuidePages } = get();
        if (!completedGuidePages.includes(pageId)) {
          set({ completedGuidePages: [...completedGuidePages, pageId] });
        }
      },

      completeTooltipGuide: () =>
        set({ hasCompletedTooltipGuide: true, activeGuidePage: null, tooltipStep: 0 }),

      setActiveGuidePage: (pageId: string | null) =>
        set({ activeGuidePage: pageId, tooltipStep: 0 }),

      setTooltipStep: (step: number) => set({ tooltipStep: step }),

      nextTooltipStep: () => {
        const { tooltipStep } = get();
        set({ tooltipStep: tooltipStep + 1 });
      },

      resetTooltipGuide: () =>
        set({
          hasCompletedTooltipGuide: false,
          completedGuidePages: [],
          activeGuidePage: null,
          tooltipStep: 0,
        }),
    }),
    {
      name: "onboarding-store",
      storage: createJSONStorage(() => zustandAsyncStorage),
      partialize: (state) => ({
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        hasCompletedTooltipGuide: state.hasCompletedTooltipGuide,
        completedGuidePages: state.completedGuidePages,
      }),
    },
  ),
);
