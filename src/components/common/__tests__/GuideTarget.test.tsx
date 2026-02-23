import React from "react";
import { Text } from "react-native";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { GuideTarget } from "../GuideTarget";

const mockNext = jest.fn();
const mockSkip = jest.fn();
const mockSkipAll = jest.fn();

let mockIsActive = false;
let mockStepConfig: { titleKey: string; descKey: string; placement: string } | undefined;
let mockCurrentStep = 0;
let mockTotalSteps = 2;
let mockIsLastStep = false;

jest.mock("../../../hooks/useTooltipGuide", () => ({
  useGuideStep: () => ({
    isActive: mockIsActive,
    stepConfig: mockStepConfig,
    currentStep: mockCurrentStep,
    totalSteps: mockTotalSteps,
    isLastStep: mockIsLastStep,
    next: mockNext,
    skip: mockSkip,
    skipAll: mockSkipAll,
  }),
}));

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock("heroui-native", () => {
  const ReactLocal = require("react");
  const RN = require("react-native");
  return {
    Popover: Object.assign(
      ({ children }: { children: any }) =>
        ReactLocal.createElement(RN.View, { testID: "popover" }, children),
      {
        Trigger: ({ children }: { children: any }) =>
          ReactLocal.createElement(RN.View, { testID: "popover-trigger" }, children),
        Portal: ({ children }: { children: any }) =>
          ReactLocal.createElement(RN.View, { testID: "popover-portal" }, children),
        Overlay: () => ReactLocal.createElement(RN.View, { testID: "popover-overlay" }),
        Content: ({ children }: { children: any }) =>
          ReactLocal.createElement(RN.View, { testID: "popover-content" }, children),
        Arrow: () => ReactLocal.createElement(RN.View, { testID: "popover-arrow" }),
        Title: ({ children }: { children: any }) =>
          ReactLocal.createElement(RN.Text, { testID: "popover-title" }, children),
        Description: ({ children }: { children: any }) =>
          ReactLocal.createElement(RN.Text, { testID: "popover-description" }, children),
      },
    ),
    Button: Object.assign(
      ({ children, onPress }: { children: any; onPress?: () => void }) =>
        ReactLocal.createElement(RN.TouchableOpacity, { onPress }, children),
      {
        Label: ({ children }: { children: any }) =>
          ReactLocal.createElement(RN.Text, null, children),
      },
    ),
    useThemeColor: () => ["#22c55e"],
  };
});

describe("GuideTarget", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsActive = false;
    mockStepConfig = undefined;
    mockCurrentStep = 0;
    mockTotalSteps = 2;
    mockIsLastStep = false;
  });

  it("renders only children when guide is not active", () => {
    mockIsActive = false;
    render(
      <GuideTarget name="test" page="files" order={0}>
        <Text>Target Element</Text>
      </GuideTarget>,
    );

    expect(screen.getByText("Target Element")).toBeTruthy();
    expect(screen.queryByTestId("popover")).toBeNull();
  });

  it("renders Popover when guide step is active", () => {
    mockIsActive = true;
    mockStepConfig = {
      titleKey: "onboarding.tooltip.filesImportTitle",
      descKey: "onboarding.tooltip.filesImportDesc",
      placement: "bottom",
    };

    render(
      <GuideTarget name="test" page="files" order={0}>
        <Text>Target Element</Text>
      </GuideTarget>,
    );

    expect(screen.getByTestId("popover")).toBeTruthy();
    expect(screen.getByTestId("popover-overlay")).toBeTruthy();
    expect(screen.getByTestId("popover-arrow")).toBeTruthy();
    expect(screen.getByText("onboarding.tooltip.filesImportTitle")).toBeTruthy();
    expect(screen.getByText("onboarding.tooltip.filesImportDesc")).toBeTruthy();
  });

  it("shows step indicator text", () => {
    mockIsActive = true;
    mockCurrentStep = 0;
    mockTotalSteps = 2;
    mockStepConfig = {
      titleKey: "title",
      descKey: "desc",
      placement: "bottom",
    };

    render(
      <GuideTarget name="test" page="files" order={0}>
        <Text>Target</Text>
      </GuideTarget>,
    );

    expect(screen.getByText("1 / 2")).toBeTruthy();
  });

  it("shows 'next' label when not last step", () => {
    mockIsActive = true;
    mockIsLastStep = false;
    mockStepConfig = {
      titleKey: "title",
      descKey: "desc",
      placement: "bottom",
    };

    render(
      <GuideTarget name="test" page="files" order={0}>
        <Text>Target</Text>
      </GuideTarget>,
    );

    expect(screen.getByText("onboarding.tooltip.next")).toBeTruthy();
  });

  it("shows 'done' label on last step", () => {
    mockIsActive = true;
    mockIsLastStep = true;
    mockStepConfig = {
      titleKey: "title",
      descKey: "desc",
      placement: "bottom",
    };

    render(
      <GuideTarget name="test" page="files" order={0}>
        <Text>Target</Text>
      </GuideTarget>,
    );

    expect(screen.getByText("onboarding.tooltip.done")).toBeTruthy();
  });

  it("calls next when next button is pressed", () => {
    mockIsActive = true;
    mockIsLastStep = false;
    mockStepConfig = {
      titleKey: "title",
      descKey: "desc",
      placement: "bottom",
    };

    render(
      <GuideTarget name="test" page="files" order={0}>
        <Text>Target</Text>
      </GuideTarget>,
    );

    fireEvent.press(screen.getByText("onboarding.tooltip.next"));
    expect(mockNext).toHaveBeenCalledTimes(1);
  });

  it("calls skipAll when skip button is pressed", () => {
    mockIsActive = true;
    mockStepConfig = {
      titleKey: "title",
      descKey: "desc",
      placement: "bottom",
    };

    render(
      <GuideTarget name="test" page="files" order={0}>
        <Text>Target</Text>
      </GuideTarget>,
    );

    fireEvent.press(screen.getByText("onboarding.tooltip.skipAll"));
    expect(mockSkipAll).toHaveBeenCalledTimes(1);
  });

  it("renders children inside Popover trigger when active", () => {
    mockIsActive = true;
    mockStepConfig = {
      titleKey: "title",
      descKey: "desc",
      placement: "bottom",
    };

    render(
      <GuideTarget name="test" page="files" order={0}>
        <Text>Target Element</Text>
      </GuideTarget>,
    );

    expect(screen.getByText("Target Element")).toBeTruthy();
    expect(screen.getByTestId("popover-trigger")).toBeTruthy();
  });
});
