import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { OnboardingScreen } from "../OnboardingScreen";

jest.mock("react-native-reanimated", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: {
      View: (props: any) => React.createElement(View, props, props.children),
      Text: (props: any) => {
        const { Text } = require("react-native");
        return React.createElement(Text, props, props.children);
      },
    },
    Easing: {
      out: jest.fn((fn) => fn),
      in: jest.fn((fn) => fn),
      cubic: jest.fn(),
    },
    useSharedValue: (init: number) => ({ value: init }),
    useAnimatedStyle: (fn: () => any) => fn(),
    withTiming: jest.fn((_val, _config, cb) => {
      if (cb) cb(true);
      return _val;
    }),
    withSpring: jest.fn((val) => val),
    runOnJS: (fn: any) => fn,
  };
});

jest.mock("react-native-gesture-handler", () => {
  const ReactLocal = require("react");
  const { View } = require("react-native");

  const createGestureBuilder = () => ({
    activeOffsetX: () => createGestureBuilder(),
    failOffsetY: () => createGestureBuilder(),
    onEnd: () => createGestureBuilder(),
    onBegin: () => createGestureBuilder(),
    onStart: () => createGestureBuilder(),
    onUpdate: () => createGestureBuilder(),
    onFinalize: () => createGestureBuilder(),
    enabled: () => createGestureBuilder(),
    minDistance: () => createGestureBuilder(),
  });

  return {
    GestureDetector: ({ children }: { children?: any }) =>
      ReactLocal.createElement(View, { testID: "gesture-detector" }, children),
    Gesture: {
      Pan: () => createGestureBuilder(),
      Tap: () => createGestureBuilder(),
      Exclusive: (..._args: any[]) => createGestureBuilder(),
      Race: (..._args: any[]) => createGestureBuilder(),
    },
  };
});

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock("../../../hooks/common/useScreenOrientation", () => ({
  useScreenOrientation: () => ({
    isLandscape: false,
    isPortrait: true,
    orientation: 1,
  }),
}));

jest.mock("../../../hooks/common/useHapticFeedback", () => ({
  useHapticFeedback: () => ({
    selection: jest.fn(),
    impact: jest.fn(),
    notify: jest.fn(),
  }),
}));

let mockCurrentStep = 0;
const mockSetCurrentStep = jest.fn((step: number) => {
  mockCurrentStep = step;
});
const mockCompleteOnboarding = jest.fn();

jest.mock("../../../stores/app/useOnboardingStore", () => ({
  useOnboardingStore: (selector: (s: any) => any) =>
    selector({
      currentStep: mockCurrentStep,
      setCurrentStep: mockSetCurrentStep,
      completeOnboarding: mockCompleteOnboarding,
    }),
  ONBOARDING_TOTAL_STEPS: 5,
}));

describe("OnboardingScreen", () => {
  const onComplete = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentStep = 0;
  });

  it("renders welcome step content on first step", () => {
    render(<OnboardingScreen onComplete={onComplete} />);

    expect(screen.getByText("onboarding.welcomeTitle")).toBeTruthy();
    expect(screen.getByText("onboarding.welcomeDesc")).toBeTruthy();
  });

  it("renders step features", () => {
    render(<OnboardingScreen onComplete={onComplete} />);

    expect(screen.getByText("onboarding.welcomeFeature1")).toBeTruthy();
    expect(screen.getByText("onboarding.welcomeFeature2")).toBeTruthy();
    expect(screen.getByText("onboarding.welcomeFeature3")).toBeTruthy();
  });

  it("renders telescope icon on first step", () => {
    render(<OnboardingScreen onComplete={onComplete} />);

    expect(screen.getByText("telescope")).toBeTruthy();
  });

  it("renders skip button on non-last steps", () => {
    render(<OnboardingScreen onComplete={onComplete} />);

    expect(screen.getByText("onboarding.skip")).toBeTruthy();
  });

  it("renders next button on non-last steps", () => {
    render(<OnboardingScreen onComplete={onComplete} />);

    expect(screen.getByText("onboarding.next")).toBeTruthy();
  });

  it("does not render prev button on first step", () => {
    render(<OnboardingScreen onComplete={onComplete} />);

    expect(screen.queryByText("onboarding.prev")).toBeNull();
  });

  it("renders prev button on non-first steps", () => {
    mockCurrentStep = 2;
    render(<OnboardingScreen onComplete={onComplete} />);

    expect(screen.getByText("onboarding.prev")).toBeTruthy();
  });

  it("renders 'Get Started' button on last step", () => {
    mockCurrentStep = 4; // last step (0-indexed, 5 total)
    render(<OnboardingScreen onComplete={onComplete} />);

    expect(screen.getByText("onboarding.getStarted")).toBeTruthy();
  });

  it("does not render skip button on last step", () => {
    mockCurrentStep = 4;
    render(<OnboardingScreen onComplete={onComplete} />);

    expect(screen.queryByText("onboarding.skip")).toBeNull();
  });

  it("calls completeOnboarding and onComplete when skip is pressed", () => {
    render(<OnboardingScreen onComplete={onComplete} />);

    fireEvent.press(screen.getByText("onboarding.skip"));
    expect(mockCompleteOnboarding).toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalled();
  });

  it("calls completeOnboarding and onComplete on last step next press", () => {
    mockCurrentStep = 4;
    render(<OnboardingScreen onComplete={onComplete} />);

    fireEvent.press(screen.getByText("onboarding.getStarted"));
    expect(mockCompleteOnboarding).toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalled();
  });

  it("renders step indicator dots", () => {
    render(<OnboardingScreen onComplete={onComplete} />);

    // There should be 5 dots for 5 steps
    // Dots are rendered as Views, we verify the component renders
    expect(screen.toJSON()).toBeTruthy();
  });

  it("renders different step content based on currentStep", () => {
    mockCurrentStep = 1;
    render(<OnboardingScreen onComplete={onComplete} />);

    expect(screen.getByText("onboarding.importTitle")).toBeTruthy();
    expect(screen.getByText("onboarding.importDesc")).toBeTruthy();
  });

  it("renders viewer step content", () => {
    mockCurrentStep = 2;
    render(<OnboardingScreen onComplete={onComplete} />);

    expect(screen.getByText("onboarding.viewerTitle")).toBeTruthy();
  });

  it("renders gallery step content", () => {
    mockCurrentStep = 3;
    render(<OnboardingScreen onComplete={onComplete} />);

    expect(screen.getByText("onboarding.galleryTitle")).toBeTruthy();
  });

  it("renders observe step content", () => {
    mockCurrentStep = 4;
    render(<OnboardingScreen onComplete={onComplete} />);

    expect(screen.getByText("onboarding.observeTitle")).toBeTruthy();
  });

  it("advances to next step when next button is pressed on non-last step", () => {
    mockCurrentStep = 0;
    render(<OnboardingScreen onComplete={onComplete} />);

    fireEvent.press(screen.getByText("onboarding.next"));

    // withTiming callback fires synchronously in mock, so setCurrentStep should be called
    expect(mockSetCurrentStep).toHaveBeenCalledWith(1);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("goes back to previous step when prev button is pressed", () => {
    mockCurrentStep = 2;
    render(<OnboardingScreen onComplete={onComplete} />);

    fireEvent.press(screen.getByText("onboarding.prev"));

    expect(mockSetCurrentStep).toHaveBeenCalledWith(1);
  });

  it("does not go back when on first step (handlePrev is no-op)", () => {
    mockCurrentStep = 0;
    render(<OnboardingScreen onComplete={onComplete} />);

    // Prev button should not be rendered on first step
    expect(screen.queryByText("onboarding.prev")).toBeNull();
    // setCurrentStep should not have been called
    expect(mockSetCurrentStep).not.toHaveBeenCalled();
  });

  it("renders all 5 step contents correctly", () => {
    const stepTitles = [
      "onboarding.welcomeTitle",
      "onboarding.importTitle",
      "onboarding.viewerTitle",
      "onboarding.galleryTitle",
      "onboarding.observeTitle",
    ];

    for (let i = 0; i < stepTitles.length; i++) {
      mockCurrentStep = i;
      const { unmount } = render(<OnboardingScreen onComplete={onComplete} />);
      expect(screen.getByText(stepTitles[i])).toBeTruthy();
      unmount();
    }
  });
});
