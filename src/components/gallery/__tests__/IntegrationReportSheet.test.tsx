import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { IntegrationReportSheet } from "../IntegrationReportSheet";

const mockReport = {
  targets: [
    {
      target: "M42",
      totalFrames: 10,
      totalExposure: 3600,
      filters: [
        { name: "Ha", frameCount: 6, totalExposure: 2400, avgQuality: 85 },
        { name: "OIII", frameCount: 4, totalExposure: 1200, avgQuality: 72 },
      ],
    },
  ],
  totalFrames: 10,
  totalExposure: 3600,
  dateRange: ["2024-01-01T00:00:00", "2024-06-30T00:00:00"] as [string, string],
  includedFrameTypes: ["light"],
};

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) =>
      (
        ({
          "gallery.integrationReport": "Integration Report",
          "gallery.targets": "Targets",
          "gallery.includedFrames": "Included Frames",
          "gallery.totalExp": "Total Exp",
          "gallery.filter": "Filter",
          "gallery.frames": "Frames",
          "gallery.quality": "Quality",
          "gallery.reportScope": "Scope",
          "gallery.noFramesInScope": "No frames found",
          "gallery.frameTypes.light": "Light",
          "common.close": "Close",
          "common.copy": "Copy",
        }) as Record<string, string>
      )[key] ?? key,
  }),
}));

jest.mock("../../../stores/useFitsStore", () => ({
  useFitsStore: (selector: (s: any) => any) => selector({ files: [] }),
}));

jest.mock("../../../stores/useSettingsStore", () => ({
  useSettingsStore: (selector: (s: any) => any) =>
    selector({
      frameClassificationConfig: { customTypes: [] },
      reportFrameTypes: ["light"],
    }),
}));

jest.mock("../../../hooks/useHapticFeedback", () => ({
  useHapticFeedback: () => ({
    notify: jest.fn(),
  }),
}));

jest.mock("../../../lib/gallery/frameClassifier", () => ({
  getFrameTypeDefinitions: () => [{ key: "light", label: "Light", builtin: true }],
}));

jest.mock("../../../lib/gallery/integrationReport", () => ({
  generateIntegrationReport: () => mockReport,
  formatExposureTime: (s: number) => `${s}s`,
  exportReportAsMarkdown: () => "# Report",
}));

jest.mock("expo-clipboard", () => ({
  setStringAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("expo-haptics", () => ({
  NotificationFeedbackType: { Success: "Success" },
}));

jest.mock("heroui-native", () => {
  const React = require("react");
  const { Pressable, Text, View } = require("react-native");

  const BottomSheet = ({ isOpen, children }: any) => (isOpen ? <View>{children}</View> : null);
  BottomSheet.Portal = ({ children }: any) => <View>{children}</View>;
  BottomSheet.Overlay = () => null;
  BottomSheet.Content = ({ children }: any) => <View>{children}</View>;
  BottomSheet.Title = ({ children }: any) => <Text>{children}</Text>;

  const Button = ({ onPress, children, isDisabled }: any) => (
    <Pressable onPress={isDisabled ? undefined : onPress}>{children}</Pressable>
  );
  Button.Label = ({ children }: any) => <Text>{children}</Text>;

  return {
    BottomSheet,
    Button,
    Separator: () => null,
    useThemeColor: () => ["#999", "#0f0"],
  };
});

describe("IntegrationReportSheet", () => {
  const onClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders report title and summary", () => {
    render(<IntegrationReportSheet visible onClose={onClose} />);

    expect(screen.getByText("Integration Report")).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy(); // targets count
    expect(screen.getByText("10")).toBeTruthy(); // total frames
    expect(screen.getByText("3600s")).toBeTruthy(); // total exposure
  });

  it("renders target name and filter rows", () => {
    render(<IntegrationReportSheet visible onClose={onClose} />);

    expect(screen.getByText("M42")).toBeTruthy();
    expect(screen.getByText("Ha")).toBeTruthy();
    expect(screen.getByText("OIII")).toBeTruthy();
  });

  it("renders scope label", () => {
    render(<IntegrationReportSheet visible onClose={onClose} />);

    expect(screen.getByText("Scope: Light")).toBeTruthy();
  });

  it("renders date range", () => {
    render(<IntegrationReportSheet visible onClose={onClose} />);

    expect(screen.getByText("2024-01-01 — 2024-06-30")).toBeTruthy();
  });

  it("calls onClose when close button is pressed", () => {
    render(<IntegrationReportSheet visible onClose={onClose} />);

    fireEvent.press(screen.getByText("Close"));
    expect(onClose).toHaveBeenCalled();
  });

  it("copies markdown when copy button is pressed", async () => {
    const Clipboard = require("expo-clipboard");
    render(<IntegrationReportSheet visible onClose={onClose} />);

    fireEvent.press(screen.getByText("Copy"));
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith("# Report");
  });

  it("renders quality scores for filters", () => {
    render(<IntegrationReportSheet visible onClose={onClose} />);

    expect(screen.getByText("85")).toBeTruthy();
    expect(screen.getByText("72")).toBeTruthy();
  });

  it("does not render when visible is false", () => {
    render(<IntegrationReportSheet visible={false} onClose={onClose} />);

    expect(screen.queryByText("Integration Report")).toBeNull();
  });
});
