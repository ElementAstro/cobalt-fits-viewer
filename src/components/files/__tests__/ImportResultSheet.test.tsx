import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { ImportResultSheet } from "../ImportResultSheet";
import type { ImportResult } from "../../../hooks/useFileManager";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (!options) return key;
      const details = Object.entries(options)
        .map(([entryKey, value]) => `${entryKey}=${String(value)}`)
        .join(",");
      return `${key}:${details}`;
    },
  }),
}));

const baseResult: ImportResult = {
  success: 2,
  failed: 1,
  total: 3,
  skippedDuplicate: 1,
  skippedUnsupported: 1,
  failedEntries: [{ name: "bad.fit", reason: "Unsupported file format" }],
};

const defaultProps = {
  visible: true,
  result: baseResult,
  failedEntries: [{ name: "bad.fit", reason: "Unsupported file format" }],
  isLandscape: false,
  onOpenChange: jest.fn(),
  onCopy: jest.fn(),
};

describe("ImportResultSheet", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders nothing when not visible", () => {
    const { queryByText } = render(<ImportResultSheet {...defaultProps} visible={false} />);
    expect(queryByText("files.importResultTitle")).toBeNull();
  });

  it("renders summary statistics", () => {
    render(<ImportResultSheet {...defaultProps} />);
    expect(screen.getByText("files.importResultTitle")).toBeTruthy();
    expect(screen.getByText("files.importPartialMsg:success=2,total=3,failed=1")).toBeTruthy();
    expect(screen.getByText("files.progressSuccess:count=2")).toBeTruthy();
    expect(screen.getByText("files.progressFailed:count=1")).toBeTruthy();
  });

  it("renders failed entries", () => {
    render(<ImportResultSheet {...defaultProps} />);
    expect(screen.getByText("files.importResultFailedEntries")).toBeTruthy();
    expect(screen.getByText("bad.fit")).toBeTruthy();
    expect(screen.getByText("Unsupported file format")).toBeTruthy();
  });

  it("renders no-failure state when entries are empty", () => {
    render(
      <ImportResultSheet
        {...defaultProps}
        failedEntries={[]}
        result={{ ...baseResult, failed: 0 }}
      />,
    );
    expect(screen.getByText("files.importResultNoFailures")).toBeTruthy();
  });

  it("calls onCopy when copy button is pressed", () => {
    render(<ImportResultSheet {...defaultProps} />);
    fireEvent.press(screen.getByTestId("import-result-sheet-copy-button"));
    expect(defaultProps.onCopy).toHaveBeenCalled();
  });

  it("calls onOpenChange(false) when close button is pressed", () => {
    render(<ImportResultSheet {...defaultProps} />);
    fireEvent.press(screen.getByText("common.close"));
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });
});
