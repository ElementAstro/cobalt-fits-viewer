import React from "react";
import { render, screen } from "@testing-library/react-native";
import { ProcessingComposeSection } from "../ProcessingComposeSection";

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

describe("ProcessingComposeSection", () => {
  it("renders without crashing", () => {
    render(<ProcessingComposeSection />);

    expect(screen.getByText("settings.composeDefaults")).toBeTruthy();
  });

  it("renders compose preset row", () => {
    render(<ProcessingComposeSection />);

    expect(screen.getByTestId("e2e-action-settings__processing-open-compose-preset")).toBeTruthy();
  });

  it("renders red weight slider", () => {
    render(<ProcessingComposeSection />);

    expect(screen.getByText("settings.composeRedWeight")).toBeTruthy();
  });

  it("renders green weight slider", () => {
    render(<ProcessingComposeSection />);

    expect(screen.getByText("settings.composeGreenWeight")).toBeTruthy();
  });

  it("renders blue weight slider", () => {
    render(<ProcessingComposeSection />);

    expect(screen.getByText("settings.composeBlueWeight")).toBeTruthy();
  });

  it("renders advanced compose section", () => {
    render(<ProcessingComposeSection />);

    expect(screen.getByText("settings.composeAdvancedDefaults")).toBeTruthy();
  });
});
