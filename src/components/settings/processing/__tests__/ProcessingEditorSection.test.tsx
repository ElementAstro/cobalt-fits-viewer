import React from "react";
import { render, screen } from "@testing-library/react-native";
import { ProcessingEditorSection } from "../ProcessingEditorSection";

jest.mock("../../../../i18n/useI18n", () => ({
  useI18n: () => ({ t: (k: string) => k }),
}));

jest.mock("../../../../hooks/useHapticFeedback", () => ({
  useHapticFeedback: () => ({
    selection: jest.fn(),
    impact: jest.fn(),
    notify: jest.fn(),
  }),
}));

jest.mock("../../../../hooks/useSettingsPicker", () => ({
  useSettingsPicker: () => ({
    activePicker: null,
    openPicker: jest.fn(),
    closePicker: jest.fn(),
  }),
}));

describe("ProcessingEditorSection", () => {
  it("renders without crashing", () => {
    render(<ProcessingEditorSection />);

    expect(screen.getByText("settings.editorDefaults")).toBeTruthy();
  });

  it("renders blur sigma slider", () => {
    render(<ProcessingEditorSection />);

    expect(screen.getByText("settings.defaultBlurSigma")).toBeTruthy();
  });

  it("renders sharpen amount slider", () => {
    render(<ProcessingEditorSection />);

    expect(screen.getByText("settings.defaultSharpenAmount")).toBeTruthy();
  });

  it("renders denoise radius slider", () => {
    render(<ProcessingEditorSection />);

    expect(screen.getByText("settings.defaultDenoiseRadius")).toBeTruthy();
  });

  it("renders editor max undo row", () => {
    render(<ProcessingEditorSection />);

    expect(screen.getByTestId("e2e-action-settings__processing-open-editor-max-undo")).toBeTruthy();
  });
});
