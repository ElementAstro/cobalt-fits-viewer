import React from "react";
import { render, screen } from "@testing-library/react-native";
import { ProcessingVideoSection } from "../ProcessingVideoSection";

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

describe("ProcessingVideoSection", () => {
  it("renders without crashing", () => {
    render(<ProcessingVideoSection />);

    expect(screen.getByText("settings.videoMediaTitle")).toBeTruthy();
  });

  it("renders video core toggle", () => {
    render(<ProcessingVideoSection />);

    expect(screen.getByTestId("e2e-action-settings__processing-toggle-video-core")).toBeTruthy();
  });

  it("renders video processing toggle", () => {
    render(<ProcessingVideoSection />);

    expect(
      screen.getByTestId("e2e-action-settings__processing-toggle-video-processing"),
    ).toBeTruthy();
  });

  it("renders video profile row", () => {
    render(<ProcessingVideoSection />);

    expect(screen.getByTestId("e2e-action-settings__processing-open-video-profile")).toBeTruthy();
  });

  it("renders video target preset row", () => {
    render(<ProcessingVideoSection />);

    expect(
      screen.getByTestId("e2e-action-settings__processing-open-video-target-preset"),
    ).toBeTruthy();
  });
});
