/**
 * Onboarding Store
 *
 * Manages onboarding/welcome guide state with MMKV persistence.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { zustandMMKVStorage } from "../lib/storage";

interface OnboardingStoreState {
  hasCompletedOnboarding: boolean;
  currentStep: number;

  completeOnboarding: () => void;
  resetOnboarding: () => void;
  setCurrentStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
}

export const ONBOARDING_TOTAL_STEPS = 5;

export const useOnboardingStore = create<OnboardingStoreState>()(
  persist(
    (set, get) => ({
      hasCompletedOnboarding: false,
      currentStep: 0,

      completeOnboarding: () => set({ hasCompletedOnboarding: true, currentStep: 0 }),

      resetOnboarding: () => set({ hasCompletedOnboarding: false, currentStep: 0 }),

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
    }),
    {
      name: "onboarding-store",
      storage: createJSONStorage(() => zustandMMKVStorage),
      partialize: (state) => ({
        hasCompletedOnboarding: state.hasCompletedOnboarding,
      }),
    },
  ),
);
