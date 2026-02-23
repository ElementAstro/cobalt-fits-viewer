import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { FileListItem } from "../FileListItem";
import type { FitsMetadata } from "../../../lib/fits/types";

jest.mock("../../../lib/gallery/thumbnailCache", () => ({
  resolveThumbnailUri: (_id: string, uri?: string) => uri ?? null,
}));

jest.mock("../../../lib/utils/fileManager", () => ({
  formatFileSize: (b: number) => `${(b / 1024).toFixed(0)} KB`,
}));

jest.mock("../../../lib/video/format", () => ({
  formatVideoDuration: (ms?: number) => (ms ? `${Math.floor(ms / 1000)}s` : ""),
  formatVideoResolution: (w?: number, h?: number) => (w && h ? `${w}x${h}` : ""),
}));

jest.mock("expo-image", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    Image: (props: any) =>
      React.createElement(View, { testID: `expo-image-${props.recyclingKey}`, ...props }),
  };
});

jest.mock("react-native-gesture-handler", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    Swipeable: ({ children }: any) => React.createElement(View, null, children),
  };
});

jest.mock("heroui-native", () => {
  const React = require("react");
  const { Pressable, Text, View } = require("react-native");

  const Button = ({ onPress, children }: any) => (
    <Pressable onPress={onPress}>{children}</Pressable>
  );
  Button.Label = ({ children }: any) => <Text>{children}</Text>;

  const Card = ({ children, ...rest }: any) => <View {...rest}>{children}</View>;
  Card.Body = ({ children, ...rest }: any) => <View {...rest}>{children}</View>;

  const Chip = ({ children }: any) => <View>{children}</View>;
  Chip.Label = ({ children }: any) => <Text>{children}</Text>;

  return {
    Button,
    Card,
    Chip,
    useThemeColor: () => ["#0f0", "#999"],
  };
});

const makeFile = (overrides: Partial<FitsMetadata> = {}): FitsMetadata => ({
  id: "f1",
  filename: "M42.fits",
  filepath: "file:///tmp/M42.fits",
  fileSize: 2048,
  importDate: 1700000000000,
  frameType: "light",
  isFavorite: false,
  tags: [],
  albumIds: [],
  ...overrides,
});

describe("FileListItem", () => {
  it("renders filename and file size in list layout", () => {
    render(<FileListItem file={makeFile()} layout="list" />);

    expect(screen.getByText("M42.fits")).toBeTruthy();
    expect(screen.getByText("2 KB")).toBeTruthy();
  });

  it("renders filename in grid layout", () => {
    render(<FileListItem file={makeFile()} layout="grid" />);

    expect(screen.getByText("M42.fits")).toBeTruthy();
  });

  it("calls onPress when pressed", () => {
    const onPress = jest.fn();
    render(<FileListItem file={makeFile()} onPress={onPress} />);

    fireEvent.press(screen.getByText("M42.fits"));
    expect(onPress).toHaveBeenCalled();
  });

  it("calls onLongPress when long pressed", () => {
    const onLongPress = jest.fn();
    render(<FileListItem file={makeFile()} onLongPress={onLongPress} />);

    fireEvent(screen.getByText("M42.fits"), "longPress");
    expect(onLongPress).toHaveBeenCalled();
  });

  it("shows filter chip when showFilter is true and filter exists", () => {
    render(<FileListItem file={makeFile({ filter: "Ha" })} showFilter />);

    expect(screen.getByText("Ha")).toBeTruthy();
  });

  it("shows object chip when showObject is true", () => {
    render(<FileListItem file={makeFile({ object: "M42" })} showObject />);

    expect(screen.getByText("M42")).toBeTruthy();
  });

  it("shows exposure when showExposure is true", () => {
    render(<FileListItem file={makeFile({ exptime: 300 })} showExposure />);

    expect(screen.getByText("300s")).toBeTruthy();
  });

  it("shows VIDEO chip for video files in grid layout", () => {
    render(
      <FileListItem file={makeFile({ mediaKind: "video", durationMs: 5000 })} layout="grid" />,
    );

    expect(screen.getByText("VIDEO")).toBeTruthy();
    expect(screen.getAllByText("5s").length).toBeGreaterThanOrEqual(1);
  });

  it("shows AUDIO chip for audio files in grid layout", () => {
    render(
      <FileListItem file={makeFile({ mediaKind: "audio", durationMs: 3000 })} layout="grid" />,
    );

    expect(screen.getByText("AUDIO")).toBeTruthy();
  });

  it("shows source format chip when present", () => {
    render(<FileListItem file={makeFile({ sourceFormat: "fits" })} layout="list" />);

    expect(screen.getByText("FITS")).toBeTruthy();
  });

  it("hides filename when showFilename is false", () => {
    render(<FileListItem file={makeFile()} showFilename={false} layout="list" />);

    expect(screen.queryByText("M42.fits")).toBeNull();
  });

  it("renders compact layout without crashing", () => {
    render(<FileListItem file={makeFile()} layout="compact" />);

    expect(screen.getByText("M42.fits")).toBeTruthy();
  });
});
