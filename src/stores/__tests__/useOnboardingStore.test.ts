/**
 * Unit tests for useOnboardingStore
 */

import { useOnboardingStore, ONBOARDING_TOTAL_STEPS } from "../useOnboardingStore";

// Mock storage
jest.mock("../../lib/storage", () => ({
  zustandMMKVStorage: {
    getItem: jest.fn().mockReturnValue(null),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

const resetStore = () => {
  useOnboardingStore.setState({
    hasCompletedOnboarding: false,
    currentStep: 0,
  });
};

describe("useOnboardingStore", () => {
  beforeEach(() => {
    resetStore();
  });

  // ===== Constants =====

  describe("constants", () => {
    it("ONBOARDING_TOTAL_STEPS should be 5", () => {
      expect(ONBOARDING_TOTAL_STEPS).toBe(5);
    });
  });

  // ===== Default state =====

  describe("default state", () => {
    it("hasCompletedOnboarding defaults to false", () => {
      expect(useOnboardingStore.getState().hasCompletedOnboarding).toBe(false);
    });

    it("currentStep defaults to 0", () => {
      expect(useOnboardingStore.getState().currentStep).toBe(0);
    });
  });

  // ===== completeOnboarding =====

  describe("completeOnboarding", () => {
    it("sets hasCompletedOnboarding to true", () => {
      useOnboardingStore.getState().completeOnboarding();
      expect(useOnboardingStore.getState().hasCompletedOnboarding).toBe(true);
    });

    it("resets currentStep to 0", () => {
      useOnboardingStore.getState().setCurrentStep(3);
      useOnboardingStore.getState().completeOnboarding();
      expect(useOnboardingStore.getState().currentStep).toBe(0);
    });
  });

  // ===== resetOnboarding =====

  describe("resetOnboarding", () => {
    it("resets hasCompletedOnboarding to false", () => {
      useOnboardingStore.getState().completeOnboarding();
      expect(useOnboardingStore.getState().hasCompletedOnboarding).toBe(true);

      useOnboardingStore.getState().resetOnboarding();
      expect(useOnboardingStore.getState().hasCompletedOnboarding).toBe(false);
    });

    it("resets currentStep to 0", () => {
      useOnboardingStore.getState().setCurrentStep(4);
      useOnboardingStore.getState().resetOnboarding();
      expect(useOnboardingStore.getState().currentStep).toBe(0);
    });
  });

  // ===== setCurrentStep =====

  describe("setCurrentStep", () => {
    it("sets step to a specific value", () => {
      useOnboardingStore.getState().setCurrentStep(3);
      expect(useOnboardingStore.getState().currentStep).toBe(3);
    });

    it("can set to 0", () => {
      useOnboardingStore.getState().setCurrentStep(3);
      useOnboardingStore.getState().setCurrentStep(0);
      expect(useOnboardingStore.getState().currentStep).toBe(0);
    });

    it("can set to last step", () => {
      useOnboardingStore.getState().setCurrentStep(ONBOARDING_TOTAL_STEPS - 1);
      expect(useOnboardingStore.getState().currentStep).toBe(ONBOARDING_TOTAL_STEPS - 1);
    });
  });

  // ===== nextStep =====

  describe("nextStep", () => {
    it("increments step by 1", () => {
      useOnboardingStore.getState().nextStep();
      expect(useOnboardingStore.getState().currentStep).toBe(1);
    });

    it("does not exceed max step", () => {
      useOnboardingStore.getState().setCurrentStep(ONBOARDING_TOTAL_STEPS - 1);
      useOnboardingStore.getState().nextStep();
      expect(useOnboardingStore.getState().currentStep).toBe(ONBOARDING_TOTAL_STEPS - 1);
    });

    it("increments sequentially", () => {
      for (let i = 0; i < ONBOARDING_TOTAL_STEPS - 1; i++) {
        useOnboardingStore.getState().nextStep();
      }
      expect(useOnboardingStore.getState().currentStep).toBe(ONBOARDING_TOTAL_STEPS - 1);
    });
  });

  // ===== prevStep =====

  describe("prevStep", () => {
    it("decrements step by 1", () => {
      useOnboardingStore.getState().setCurrentStep(3);
      useOnboardingStore.getState().prevStep();
      expect(useOnboardingStore.getState().currentStep).toBe(2);
    });

    it("does not go below 0", () => {
      useOnboardingStore.getState().prevStep();
      expect(useOnboardingStore.getState().currentStep).toBe(0);
    });

    it("decrements from step 1 to 0", () => {
      useOnboardingStore.getState().setCurrentStep(1);
      useOnboardingStore.getState().prevStep();
      expect(useOnboardingStore.getState().currentStep).toBe(0);
    });
  });

  // ===== Independence =====

  describe("independence", () => {
    it("completeOnboarding resets currentStep to 0", () => {
      useOnboardingStore.getState().setCurrentStep(3);
      useOnboardingStore.getState().completeOnboarding();
      expect(useOnboardingStore.getState().currentStep).toBe(0);
    });

    it("nextStep does not affect hasCompletedOnboarding", () => {
      useOnboardingStore.getState().nextStep();
      expect(useOnboardingStore.getState().hasCompletedOnboarding).toBe(false);
    });

    it("prevStep does not affect hasCompletedOnboarding", () => {
      useOnboardingStore.getState().setCurrentStep(2);
      useOnboardingStore.getState().prevStep();
      expect(useOnboardingStore.getState().hasCompletedOnboarding).toBe(false);
    });
  });
});
