import React from "react";
import { render, screen } from "@testing-library/react-native";
import { ProcessingExportSection } from "../ProcessingExportSection";

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

describe("ProcessingExportSection", () => {
  it("renders without crashing", () => {
    render(<ProcessingExportSection />);

    expect(screen.getByText("settings.export")).toBeTruthy();
  });

  it("renders export format row", () => {
    render(<ProcessingExportSection />);

    expect(screen.getByTestId("e2e-action-settings__processing-open-export-format")).toBeTruthy();
  });

  it("renders converter defaults section", () => {
    render(<ProcessingExportSection />);

    expect(screen.getByText("settings.converterDefaults")).toBeTruthy();
  });

  it("renders converter format row", () => {
    render(<ProcessingExportSection />);

    expect(
      screen.getByTestId("e2e-action-settings__processing-open-converter-format"),
    ).toBeTruthy();
  });

  it("renders batch naming rule row", () => {
    render(<ProcessingExportSection />);

    expect(screen.getByTestId("e2e-action-settings__processing-open-batch-naming")).toBeTruthy();
  });
});
