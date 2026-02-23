import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { AlbumStatisticsSheet } from "../AlbumStatisticsSheet";
import type { AlbumStatistics } from "../../../lib/fits/types";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) =>
      (
        ({
          "album.statistics": "Statistics",
          "album.images": "Images",
          "album.totalExposure": "Total Exposure",
          "album.totalSize": "Total Size",
          "album.dateRange": "Date Range",
          "album.frameBreakdown": "Frame Breakdown",
          "gallery.albumName": "Album Name",
          "gallery.filter": "Filter",
          "gallery.frameTypes.light": "Light",
          "gallery.frameTypes.dark": "Dark",
          "gallery.frameTypes.flat": "Flat",
          "gallery.frameTypes.bias": "Bias",
        }) as Record<string, string>
      )[key] ?? key,
  }),
}));

jest.mock("../../../stores/useSettingsStore", () => ({
  useSettingsStore: (selector: (s: any) => any) =>
    selector({
      frameClassificationConfig: { customTypes: [] },
    }),
}));

jest.mock("../../../lib/gallery/frameClassifier", () => ({
  getFrameTypeDefinitions: () => [
    { key: "light", label: "Light", builtin: true },
    { key: "dark", label: "Dark", builtin: true },
    { key: "flat", label: "Flat", builtin: true },
    { key: "bias", label: "Bias", builtin: true },
  ],
}));

jest.mock("../../../lib/gallery/albumStatistics", () => ({
  formatExposureTime: (s: number) => `${s}s`,
  formatFileSize: (b: number) => `${(b / 1024).toFixed(0)} KB`,
}));

jest.mock("heroui-native", () => {
  const React = require("react");
  const { Pressable, Text, View } = require("react-native");

  const BottomSheet = ({ isOpen, children }: any) => (isOpen ? <View>{children}</View> : null);
  BottomSheet.Portal = ({ children }: any) => <View>{children}</View>;
  BottomSheet.Overlay = () => null;
  BottomSheet.Content = ({ children }: any) => <View>{children}</View>;
  BottomSheet.Title = ({ children }: any) => <Text>{children}</Text>;

  const Button = ({ onPress, children }: any) => (
    <Pressable onPress={onPress}>{children}</Pressable>
  );
  Button.Label = ({ children }: any) => <Text>{children}</Text>;

  const Chip = ({ children }: any) => <View>{children}</View>;
  Chip.Label = ({ children }: any) => <Text>{children}</Text>;

  return {
    BottomSheet,
    Button,
    Chip,
    Separator: () => null,
    useThemeColor: () => ["#999", "#0f0"],
  };
});

const makeStats = (overrides: Partial<AlbumStatistics> = {}): AlbumStatistics => ({
  albumId: "album-1",
  totalExposure: 3600,
  totalFileSize: 102400,
  frameBreakdown: { light: 10, dark: 5, flat: 3, bias: 2 },
  filterBreakdown: { Ha: 8, OIII: 5 },
  dateRange: ["2024-01-01", "2024-06-30"],
  ...overrides,
});

describe("AlbumStatisticsSheet", () => {
  const onClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns null when statistics is null", () => {
    const { toJSON } = render(
      <AlbumStatisticsSheet
        visible
        statistics={null}
        albumName="Test"
        imageCount={10}
        onClose={onClose}
      />,
    );

    expect(toJSON()).toBeNull();
  });

  it("renders album name and image count", () => {
    render(
      <AlbumStatisticsSheet
        visible
        statistics={makeStats()}
        albumName="Orion Nebula"
        imageCount={20}
        onClose={onClose}
      />,
    );

    expect(screen.getByText("Orion Nebula")).toBeTruthy();
    expect(screen.getByText("20")).toBeTruthy();
  });

  it("renders total exposure and file size", () => {
    render(
      <AlbumStatisticsSheet
        visible
        statistics={makeStats()}
        albumName="Test"
        imageCount={10}
        onClose={onClose}
      />,
    );

    expect(screen.getByText("3600s")).toBeTruthy();
    expect(screen.getByText("100 KB")).toBeTruthy();
  });

  it("renders date range", () => {
    render(
      <AlbumStatisticsSheet
        visible
        statistics={makeStats()}
        albumName="Test"
        imageCount={10}
        onClose={onClose}
      />,
    );

    expect(screen.getByText("2024-01-01 - 2024-06-30")).toBeTruthy();
  });

  it("renders frame breakdown chips", () => {
    render(
      <AlbumStatisticsSheet
        visible
        statistics={makeStats()}
        albumName="Test"
        imageCount={10}
        onClose={onClose}
      />,
    );

    expect(screen.getByText("Light: 10")).toBeTruthy();
    expect(screen.getByText("Dark: 5")).toBeTruthy();
    expect(screen.getByText("Flat: 3")).toBeTruthy();
    expect(screen.getByText("Bias: 2")).toBeTruthy();
  });

  it("renders filter breakdown chips", () => {
    render(
      <AlbumStatisticsSheet
        visible
        statistics={makeStats()}
        albumName="Test"
        imageCount={10}
        onClose={onClose}
      />,
    );

    expect(screen.getByText("Ha: 8")).toBeTruthy();
    expect(screen.getByText("OIII: 5")).toBeTruthy();
  });

  it("hides date range when not present", () => {
    render(
      <AlbumStatisticsSheet
        visible
        statistics={makeStats({ dateRange: undefined })}
        albumName="Test"
        imageCount={10}
        onClose={onClose}
      />,
    );

    expect(screen.queryByText("Date Range")).toBeNull();
  });

  it("does not render when visible is false", () => {
    render(
      <AlbumStatisticsSheet
        visible={false}
        statistics={makeStats()}
        albumName="Hidden"
        imageCount={10}
        onClose={onClose}
      />,
    );

    expect(screen.queryByText("Hidden")).toBeNull();
  });
});
