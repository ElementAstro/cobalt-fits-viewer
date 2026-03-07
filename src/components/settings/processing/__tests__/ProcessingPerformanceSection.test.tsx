import React from "react";
import { render, screen } from "@testing-library/react-native";
import { ProcessingPerformanceSection } from "../ProcessingPerformanceSection";

jest.mock("../../../../i18n/useI18n", () => ({
  useI18n: () => ({ t: (k: string) => k }),
}));

jest.mock("../../../../hooks/common/useHapticFeedback", () => ({
  useHapticFeedback: () => ({
    selection: jest.fn(),
    impact: jest.fn(),
    notify: jest.fn(),
  }),
}));

jest.mock("../../../../hooks/common/useSettingsPicker", () => ({
  useSettingsPicker: () => ({
    activePicker: null,
    openPicker: jest.fn(),
    closePicker: jest.fn(),
  }),
}));

describe("ProcessingPerformanceSection", () => {
  it("renders without crashing", () => {
    render(<ProcessingPerformanceSection />);

    expect(screen.getByText("settings.performance")).toBeTruthy();
  });

  it("renders image processing profile row", () => {
    render(<ProcessingPerformanceSection />);

    expect(screen.getByTestId("e2e-action-settings__processing-open-image-profile")).toBeTruthy();
  });

  it("renders apply editor recipe toggle", () => {
    render(<ProcessingPerformanceSection />);

    expect(screen.getByTestId("e2e-action-settings__processing-toggle-apply-recipe")).toBeTruthy();
  });

  it("renders debounce row", () => {
    render(<ProcessingPerformanceSection />);

    expect(screen.getByTestId("e2e-action-settings__processing-open-debounce")).toBeTruthy();
  });

  it("renders high quality preview toggle", () => {
    render(<ProcessingPerformanceSection />);

    expect(screen.getByTestId("e2e-action-settings__processing-toggle-hq-preview")).toBeTruthy();
  });

  it("renders cache and preload controls", () => {
    render(<ProcessingPerformanceSection />);

    expect(
      screen.getByTestId("e2e-action-settings__processing-slider-pixel-cache-entries"),
    ).toBeTruthy();
    expect(
      screen.getByTestId("e2e-action-settings__processing-slider-pixel-cache-size"),
    ).toBeTruthy();
    expect(
      screen.getByTestId("e2e-action-settings__processing-slider-image-load-cache-entries"),
    ).toBeTruthy();
    expect(
      screen.getByTestId("e2e-action-settings__processing-slider-image-load-cache-size"),
    ).toBeTruthy();
    expect(
      screen.getByTestId("e2e-action-settings__processing-toggle-preload-neighbors"),
    ).toBeTruthy();
    expect(
      screen.getByTestId("e2e-action-settings__processing-slider-preload-radius"),
    ).toBeTruthy();
  });
});
