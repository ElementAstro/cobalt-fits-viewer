import React from "react";
import { render, screen } from "@testing-library/react-native";
import { ThumbnailLoadingBanner } from "../ThumbnailLoadingBanner";
import type { ThumbnailLoadingSummary } from "../thumbnailLoading";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      (
        ({
          "gallery.thumbnailLoadingTitle": "Loading thumbnails",
          "gallery.thumbnailBytesProgress": `${opts?.loaded ?? ""}/${opts?.total ?? ""}`,
          "gallery.thumbnailCountProgress": `${opts?.completed ?? ""}/${opts?.total ?? ""}`,
        }) as Record<string, string>
      )[key] ?? key,
  }),
}));

jest.mock("heroui-native", () => {
  const React = require("react");
  const { Text, View } = require("react-native");

  const Alert = ({ children, status }: any) => <View testID={`alert-${status}`}>{children}</View>;
  Alert.Indicator = ({ children }: any) => <View>{children}</View>;
  Alert.Content = ({ children }: any) => <View>{children}</View>;
  Alert.Title = ({ children }: any) => <Text>{children}</Text>;
  Alert.Description = ({ children }: any) => <Text>{children}</Text>;

  const Spinner = () => null;
  const Surface = ({ children }: any) => <View>{children}</View>;

  return { Alert, Spinner, Surface };
});

describe("ThumbnailLoadingBanner", () => {
  it("returns null when summary is null", () => {
    const { toJSON } = render(<ThumbnailLoadingBanner summary={null} />);
    expect(toJSON()).toBeNull();
  });

  it("returns null when totalCount is 0", () => {
    const summary: ThumbnailLoadingSummary = {
      totalCount: 0,
      loadingCount: 0,
      completedCount: 0,
      errorCount: 0,
      progress: 1,
      loadedBytes: 0,
      totalBytes: 0,
    };
    const { toJSON } = render(<ThumbnailLoadingBanner summary={summary} />);
    expect(toJSON()).toBeNull();
  });

  it("returns null when loadingCount is 0", () => {
    const summary: ThumbnailLoadingSummary = {
      totalCount: 5,
      loadingCount: 0,
      completedCount: 5,
      errorCount: 0,
      progress: 1,
      loadedBytes: 0,
      totalBytes: 0,
    };
    const { toJSON } = render(<ThumbnailLoadingBanner summary={summary} />);
    expect(toJSON()).toBeNull();
  });

  it("renders loading title and progress when loading", () => {
    const summary: ThumbnailLoadingSummary = {
      totalCount: 10,
      loadingCount: 5,
      completedCount: 5,
      errorCount: 0,
      progress: 0.5,
      loadedBytes: 0,
      totalBytes: 0,
    };

    render(<ThumbnailLoadingBanner summary={summary} />);

    expect(screen.getByText("Loading thumbnails")).toBeTruthy();
    expect(screen.getByText("50%")).toBeTruthy();
  });

  it("shows byte progress when totalBytes > 0", () => {
    const summary: ThumbnailLoadingSummary = {
      totalCount: 10,
      loadingCount: 5,
      completedCount: 5,
      errorCount: 0,
      progress: 0.5,
      loadedBytes: 512000,
      totalBytes: 1024000,
    };

    render(<ThumbnailLoadingBanner summary={summary} />);

    expect(screen.getByText("Loading thumbnails")).toBeTruthy();
  });

  it("shows count progress when totalBytes is 0", () => {
    const summary: ThumbnailLoadingSummary = {
      totalCount: 10,
      loadingCount: 3,
      completedCount: 7,
      errorCount: 0,
      progress: 0.7,
      loadedBytes: 0,
      totalBytes: 0,
    };

    render(<ThumbnailLoadingBanner summary={summary} />);

    expect(screen.getAllByText("7/10").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("70%")).toBeTruthy();
  });

  it("shows warning status when errors exist", () => {
    const summary: ThumbnailLoadingSummary = {
      totalCount: 10,
      loadingCount: 3,
      completedCount: 5,
      errorCount: 2,
      progress: 0.5,
      loadedBytes: 0,
      totalBytes: 0,
    };

    render(<ThumbnailLoadingBanner summary={summary} />);

    expect(screen.getByTestId("alert-warning")).toBeTruthy();
  });

  it("shows accent status when no errors", () => {
    const summary: ThumbnailLoadingSummary = {
      totalCount: 10,
      loadingCount: 3,
      completedCount: 7,
      errorCount: 0,
      progress: 0.7,
      loadedBytes: 0,
      totalBytes: 0,
    };

    render(<ThumbnailLoadingBanner summary={summary} />);

    expect(screen.getByTestId("alert-accent")).toBeTruthy();
  });

  it("clamps percent to 0-100 range", () => {
    const summary: ThumbnailLoadingSummary = {
      totalCount: 10,
      loadingCount: 1,
      completedCount: 9,
      errorCount: 0,
      progress: 1.5, // exceeds 1
      loadedBytes: 0,
      totalBytes: 0,
    };

    render(<ThumbnailLoadingBanner summary={summary} />);

    expect(screen.getByText("100%")).toBeTruthy();
  });
});
