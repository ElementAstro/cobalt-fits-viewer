import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { LogViewer } from "../LogViewer";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock("../../../hooks/useHapticFeedback", () => ({
  useHapticFeedback: () => ({
    selection: jest.fn(),
    impact: jest.fn(),
    notify: jest.fn(),
  }),
}));

jest.mock("expo-clipboard", () => ({
  setStringAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("expo-haptics", () => ({
  NotificationFeedbackType: {
    Success: "success",
    Warning: "warning",
    Error: "error",
  },
  ImpactFeedbackStyle: {
    Light: "light",
    Medium: "medium",
    Heavy: "heavy",
  },
}));

const mockEntries = [
  {
    id: "1",
    level: "info" as const,
    tag: "App",
    message: "Application started",
    timestamp: Date.now(),
  },
  {
    id: "2",
    level: "warn" as const,
    tag: "Network",
    message: "Slow connection detected",
    timestamp: Date.now(),
  },
  {
    id: "3",
    level: "error" as const,
    tag: "Parser",
    message: "Failed to parse FITS header",
    timestamp: Date.now(),
    stackTrace: "Error: parse failed\n  at Parser.parse()",
  },
];

const mockUseLogViewer = {
  entries: mockEntries,
  levelCounts: { debug: 0, info: 1, warn: 1, error: 1 },
  availableTags: ["App", "Network", "Parser"],
  filterLevel: null,
  filterTag: "",
  filterQuery: "",
  setFilterLevel: jest.fn(),
  setFilterTag: jest.fn(),
  setFilterQuery: jest.fn(),
  clearLogs: jest.fn(),
  exportLogs: jest.fn().mockReturnValue("exported text"),
  exportToFile: jest.fn().mockResolvedValue("/path/to/file"),
  shareLogs: jest.fn().mockResolvedValue(true),
  isExporting: false,
  totalCount: 3,
};

jest.mock("../../../hooks/useLogger", () => ({
  useLogViewer: () => mockUseLogViewer,
}));

jest.mock("@shopify/flash-list", () => {
  const React = require("react");
  const { View } = require("react-native");
  const FlashList = React.forwardRef((props: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({
      scrollToOffset: jest.fn(),
    }));
    return React.createElement(
      View,
      { testID: "flash-list" },
      props.data?.map((item: any, idx: number) =>
        React.createElement(View, { key: item.id || idx }, props.renderItem({ item, index: idx })),
      ),
    );
  });
  FlashList.displayName = "FlashList";
  return { FlashList, FlashListRef: {} };
});

describe("LogViewer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders log title and entry count", () => {
    render(<LogViewer />);

    expect(screen.getByText("logs.title")).toBeTruthy();
    expect(screen.getByText("(3/3)")).toBeTruthy();
  });

  it("renders level filter buttons", () => {
    render(<LogViewer />);

    expect(screen.getByText("all")).toBeTruthy();
    expect(screen.getByText("debug (0)")).toBeTruthy();
    expect(screen.getByText("info (1)")).toBeTruthy();
    expect(screen.getByText("warn (1)")).toBeTruthy();
    expect(screen.getByText("error (1)")).toBeTruthy();
  });

  it("renders tag selector with available tags", () => {
    render(<LogViewer />);

    expect(screen.getByText("logs.tagPlaceholder")).toBeTruthy();
    expect(screen.getByText("logs.allTags")).toBeTruthy();
    expect(screen.getByText("App")).toBeTruthy();
    expect(screen.getByText("Network")).toBeTruthy();
    expect(screen.getByText("Parser")).toBeTruthy();
  });

  it("renders log entries in the list", () => {
    render(<LogViewer />);

    expect(screen.getByText("Application started")).toBeTruthy();
    expect(screen.getByText("Slow connection detected")).toBeTruthy();
    expect(screen.getByText("Failed to parse FITS header")).toBeTruthy();
  });

  it("renders entry tags", () => {
    render(<LogViewer />);

    expect(screen.getByText("[App]")).toBeTruthy();
    expect(screen.getByText("[Network]")).toBeTruthy();
    expect(screen.getByText("[Parser]")).toBeTruthy();
  });

  it("renders header action buttons", () => {
    render(<LogViewer />);

    // pause/play, copy, export, clear buttons
    expect(screen.getByText("pause-outline")).toBeTruthy();
    expect(screen.getByText("copy-outline")).toBeTruthy();
    expect(screen.getByText("download-outline")).toBeTruthy();
    expect(screen.getByText("trash-outline")).toBeTruthy();
  });

  it("renders search input", () => {
    render(<LogViewer />);

    expect(screen.getByTestId("input")).toBeTruthy();
  });

  it("renders empty state when no entries", () => {
    const originalEntries = mockUseLogViewer.entries;
    mockUseLogViewer.entries = [];

    render(<LogViewer />);

    expect(screen.getByText("logs.empty")).toBeTruthy();
    expect(screen.getByText("document-text-outline")).toBeTruthy();

    mockUseLogViewer.entries = originalEntries;
  });

  it("calls setFilterLevel when level filter is pressed", () => {
    render(<LogViewer />);

    fireEvent.press(screen.getByText("info (1)"));
    expect(mockUseLogViewer.setFilterLevel).toHaveBeenCalledWith("info");
  });

  it("calls setFilterLevel with null when 'all' is pressed", () => {
    render(<LogViewer />);

    fireEvent.press(screen.getByText("all"));
    expect(mockUseLogViewer.setFilterLevel).toHaveBeenCalledWith(null);
  });

  it("calls setFilterTag when tag is pressed", () => {
    render(<LogViewer />);

    fireEvent.press(screen.getByText("App"));
    expect(mockUseLogViewer.setFilterTag).toHaveBeenCalled();
  });
});
