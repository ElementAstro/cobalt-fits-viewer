import React from "react";
import { render, screen } from "@testing-library/react-native";
import { LoadingOverlay } from "../LoadingOverlay";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) =>
      (
        ({
          "common.loading": "Loading...",
          "files.cancelImport": "Cancel",
          "files.currentFile": "Current: {name}",
          "files.progressDetail": "{current} / {total}",
          "files.progressSuccess": "Imported: {count}",
          "files.progressFailed": "Failed: {count}",
          "files.progressSkippedDuplicate": "Skipped duplicates: {count}",
          "files.progressSkippedUnsupported": "Skipped unsupported: {count}",
        }) as Record<string, string>
      )[key] ?? key,
  }),
}));

describe("LoadingOverlay", () => {
  it("renders detailed progress and statistics when provided", () => {
    render(
      <LoadingOverlay
        visible
        message="Importing..."
        percent={50}
        currentFile="m42.fits"
        current={2}
        total={4}
        success={1}
        failed={1}
        skippedDuplicate={0}
        skippedUnsupported={0}
      />,
    );

    expect(screen.getByText("Importing...")).toBeTruthy();
    expect(screen.getByText("50%")).toBeTruthy();
    expect(screen.getByText("Current: m42.fits")).toBeTruthy();
    expect(screen.getByText("2 / 4")).toBeTruthy();
    expect(screen.getByText("Imported: 1")).toBeTruthy();
    expect(screen.getByText("Failed: 1")).toBeTruthy();
    expect(screen.getByText("Skipped duplicates: 0")).toBeTruthy();
    expect(screen.getByText("Skipped unsupported: 0")).toBeTruthy();
  });

  it("does not render stats block when statistics are missing", () => {
    render(<LoadingOverlay visible message="Importing..." percent={10} current={1} total={3} />);

    expect(screen.queryByText("Imported: 1")).toBeNull();
    expect(screen.queryByText("Failed: 1")).toBeNull();
  });

  it("renders nothing when hidden", () => {
    const { queryByText } = render(<LoadingOverlay visible={false} message="Importing..." />);
    expect(queryByText("Importing...")).toBeNull();
  });
});
