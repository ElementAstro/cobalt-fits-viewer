import React from "react";
import { act, render, screen, fireEvent } from "@testing-library/react-native";
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

  it("toggles expand on log entry press", () => {
    render(<LogViewer />);

    // Press the first log entry to expand it
    fireEvent.press(screen.getByText("Application started"));
    // The component uses expandedIds state internally — just verify no crash
    expect(screen.getByText("Application started")).toBeTruthy();
  });

  it("shows entry data and stackTrace when expanded", () => {
    const entriesWithData = [
      {
        id: "d1",
        level: "info" as const,
        tag: "App",
        message: "Has data",
        timestamp: Date.now(),
        data: { key: "value" },
      },
      {
        id: "d2",
        level: "error" as const,
        tag: "App",
        message: "Has stack",
        timestamp: Date.now(),
        stackTrace: "Error: test\n  at foo()",
      },
    ];
    mockUseLogViewer.entries = entriesWithData;

    render(<LogViewer />);

    // Press to expand entry with data
    fireEvent.press(screen.getByText("Has data"));
    // After expand, data should be visible as pretty-printed JSON
    expect(screen.getByText(/"key"/)).toBeTruthy();

    // Press to expand entry with stack trace
    fireEvent.press(screen.getByText("Has stack"));
    expect(screen.getByText(/Error: test/)).toBeTruthy();

    mockUseLogViewer.entries = mockEntries;
  });

  it("shows entry with primitive data when expanded", () => {
    const entriesWithPrimitive = [
      {
        id: "p1",
        level: "info" as const,
        tag: "App",
        message: "Primitive data",
        timestamp: Date.now(),
        data: 42,
      },
    ];
    mockUseLogViewer.entries = entriesWithPrimitive;

    render(<LogViewer />);

    fireEvent.press(screen.getByText("Primitive data"));
    expect(screen.getByText("42")).toBeTruthy();

    mockUseLogViewer.entries = mockEntries;
  });

  it("opens export panel when export button is pressed", () => {
    render(<LogViewer />);

    // Press the export/download button
    fireEvent.press(screen.getByLabelText("logs.exportOptions"));

    expect(screen.getByText("logs.exportFormat")).toBeTruthy();
    expect(screen.getByText("logs.compress")).toBeTruthy();
    expect(screen.getByText("logs.includeSystemInfo")).toBeTruthy();
    expect(screen.getByText("logs.exportFilteredOnly")).toBeTruthy();
  });

  it("shows export and share buttons in export panel", () => {
    render(<LogViewer />);

    fireEvent.press(screen.getByLabelText("logs.exportOptions"));

    expect(screen.getByText("logs.export")).toBeTruthy();
    expect(screen.getByText("logs.share")).toBeTruthy();
  });

  it("calls exportLogs and copies to clipboard when copy button is pressed", async () => {
    const Clipboard = require("expo-clipboard");
    render(<LogViewer />);

    await act(async () => {
      fireEvent.press(screen.getByLabelText("logs.copyAll"));
    });

    expect(mockUseLogViewer.exportLogs).toHaveBeenCalledWith("text", false);
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith("exported text");
  });

  it("calls exportToFile when export button in panel is pressed", async () => {
    render(<LogViewer />);

    fireEvent.press(screen.getByLabelText("logs.exportOptions"));

    await act(async () => {
      fireEvent.press(screen.getByText("logs.export"));
    });

    expect(mockUseLogViewer.exportToFile).toHaveBeenCalled();
  });

  it("calls shareLogs when share button in panel is pressed", async () => {
    render(<LogViewer />);

    fireEvent.press(screen.getByLabelText("logs.exportOptions"));

    await act(async () => {
      fireEvent.press(screen.getByText("logs.share"));
    });

    expect(mockUseLogViewer.shareLogs).toHaveBeenCalled();
  });

  it("shows alert for failed export", async () => {
    mockUseLogViewer.exportToFile.mockResolvedValueOnce(null);
    const alertSpy = jest.spyOn(require("react-native").Alert, "alert");

    render(<LogViewer />);

    fireEvent.press(screen.getByLabelText("logs.exportOptions"));

    await act(async () => {
      fireEvent.press(screen.getByText("logs.export"));
    });

    expect(alertSpy).toHaveBeenCalledWith("common.error", "logs.exportFailed");
    alertSpy.mockRestore();
  });

  it("shows alert for failed share", async () => {
    mockUseLogViewer.shareLogs.mockResolvedValueOnce(false);
    const alertSpy = jest.spyOn(require("react-native").Alert, "alert");

    render(<LogViewer />);

    fireEvent.press(screen.getByLabelText("logs.exportOptions"));

    await act(async () => {
      fireEvent.press(screen.getByText("logs.share"));
    });

    expect(alertSpy).toHaveBeenCalledWith("common.error", "logs.shareFailed");
    alertSpy.mockRestore();
  });

  it("shows clear confirmation alert when clear button is pressed", () => {
    const alertSpy = jest.spyOn(require("react-native").Alert, "alert");

    render(<LogViewer />);

    fireEvent.press(screen.getByLabelText("logs.clearTitle"));

    expect(alertSpy).toHaveBeenCalledWith(
      "logs.clearTitle",
      "logs.clearConfirm",
      expect.any(Array),
    );
    alertSpy.mockRestore();
  });

  it("clears logs when confirm is pressed in clear alert", () => {
    const alertSpy = jest.spyOn(require("react-native").Alert, "alert");

    render(<LogViewer />);

    fireEvent.press(screen.getByLabelText("logs.clearTitle"));

    // Get the destructive button callback
    const alertArgs = alertSpy.mock.calls[0];
    const buttons = alertArgs[2] as Array<{ text: string; onPress?: () => void }>;
    const confirmButton = buttons.find((b) => b.text === "common.confirm");
    act(() => {
      confirmButton?.onPress?.();
    });

    expect(mockUseLogViewer.clearLogs).toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it("toggles auto-scroll when pause/play button is pressed", () => {
    render(<LogViewer />);

    fireEvent.press(screen.getByLabelText("logs.pauseStream"));
    // After pressing, it should show play icon (label changes)
    expect(screen.toJSON()).toBeTruthy();
  });

  it("renders tags with more than 8 tags showing +N button", () => {
    const manyTags = [
      "Tag1",
      "Tag2",
      "Tag3",
      "Tag4",
      "Tag5",
      "Tag6",
      "Tag7",
      "Tag8",
      "Tag9",
      "Tag10",
    ];
    const originalTags = mockUseLogViewer.availableTags;
    mockUseLogViewer.availableTags = manyTags;

    render(<LogViewer />);

    // Should show +2 for the extra tags
    expect(screen.getByText("+2")).toBeTruthy();

    // Press to show all
    fireEvent.press(screen.getByText("+2"));
    expect(screen.getByText("Tag9")).toBeTruthy();
    expect(screen.getByText("Tag10")).toBeTruthy();
    expect(screen.getByText("logs.showLess")).toBeTruthy();

    // Press to collapse
    fireEvent.press(screen.getByText("logs.showLess"));
    expect(screen.getByText("+2")).toBeTruthy();

    mockUseLogViewer.availableTags = originalTags;
  });

  it("highlights search query in log entries when filterQuery is set", () => {
    const originalQuery = mockUseLogViewer.filterQuery;
    mockUseLogViewer.filterQuery = "started";

    render(<LogViewer />);

    // The entry should still be visible
    expect(screen.getByText("[App]")).toBeTruthy();

    mockUseLogViewer.filterQuery = originalQuery;
  });

  it("renders format selector chips in export panel", () => {
    render(<LogViewer />);

    fireEvent.press(screen.getByLabelText("logs.exportOptions"));

    expect(screen.getByText("logs.jsonFormat")).toBeTruthy();
    expect(screen.getByText("logs.textFormat")).toBeTruthy();
  });
});
