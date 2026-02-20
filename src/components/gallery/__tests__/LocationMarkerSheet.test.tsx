import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { LocationMarkerSheet } from "../LocationMarkerSheet";
import type { FitsMetadata } from "../../../lib/fits/types";
import type { MapClusterNode } from "../../../lib/map/types";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) =>
      (
        ({
          "sessions.imageCount": "images",
          "location.openSession": "Open Session",
          "location.openTarget": "Open Target",
          "location.targets": "Targets",
          "location.sessions": "Sessions",
        }) as Record<string, string>
      )[key] ?? key,
  }),
}));

jest.mock("@gorhom/bottom-sheet", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    BottomSheetScrollView: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
  };
});

jest.mock("heroui-native", () => {
  const React = require("react");
  const { Pressable, Text, View } = require("react-native");

  const BottomSheet = ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
    isOpen ? <View>{children}</View> : null;
  BottomSheet.Portal = ({ children }: { children: React.ReactNode }) => <View>{children}</View>;
  BottomSheet.Overlay = () => null;
  BottomSheet.Content = ({ children }: { children: React.ReactNode }) => <View>{children}</View>;

  const Button = ({ onPress, children }: { onPress?: () => void; children: React.ReactNode }) => (
    <Pressable onPress={onPress}>{children}</Pressable>
  );
  Button.Label = ({ children }: { children: React.ReactNode }) => <Text>{children}</Text>;

  const Chip = ({ onPress, children }: { onPress?: () => void; children: React.ReactNode }) => (
    <Pressable onPress={onPress}>{children}</Pressable>
  );
  Chip.Label = ({ children }: { children: React.ReactNode }) => <Text>{children}</Text>;

  return {
    BottomSheet,
    Separator: () => null,
    Button,
    Chip,
    useThemeColor: () => ["#00ff00", "#999999"],
  };
});

jest.mock("../ThumbnailGrid", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return {
    ThumbnailGrid: ({ files }: { files: Array<{ id: string }> }) =>
      React.createElement(Text, { testID: "thumb-grid" }, `thumbs:${files.length}`),
  };
});

function makeFile(id: string, overrides: Partial<FitsMetadata> = {}): FitsMetadata {
  return {
    id,
    filename: `${id}.fits`,
    filepath: `file:///tmp/${id}.fits`,
    fileSize: 1024,
    importDate: Date.now(),
    frameType: "light",
    isFavorite: false,
    tags: [],
    albumIds: [],
    location: { latitude: 10, longitude: 20 },
    ...overrides,
  };
}

function makeCluster(files: FitsMetadata[]): MapClusterNode {
  return {
    id: "cluster-1",
    isCluster: true,
    count: files.length,
    label: "cluster",
    location: { latitude: 10, longitude: 20, city: "Tokyo", country: "JP" },
    files,
  };
}

describe("LocationMarkerSheet", () => {
  it("opens single target/session with quick actions", () => {
    const onSessionPress = jest.fn();
    const onTargetPress = jest.fn();

    render(
      <LocationMarkerSheet
        cluster={makeCluster([
          makeFile("f1", { targetId: "target-1", sessionId: "session-1" }),
          makeFile("f2", { targetId: "target-1", sessionId: "session-1" }),
        ])}
        onClose={jest.fn()}
        onFilePress={jest.fn()}
        onSessionPress={onSessionPress}
        onTargetPress={onTargetPress}
      />,
    );

    fireEvent.press(screen.getByText("Open Session"));
    fireEvent.press(screen.getByText("Open Target"));

    expect(onSessionPress).toHaveBeenCalledWith("session-1");
    expect(onTargetPress).toHaveBeenCalledWith("target-1");
    expect(screen.getByTestId("thumb-grid")).toBeTruthy();
  });

  it("renders multi-session and multi-target chips", () => {
    const onSessionPress = jest.fn();
    const onTargetPress = jest.fn();

    render(
      <LocationMarkerSheet
        cluster={makeCluster([
          makeFile("f1", { targetId: "target-a", sessionId: "session-a" }),
          makeFile("f2", { targetId: "target-b", sessionId: "session-b" }),
        ])}
        onClose={jest.fn()}
        onFilePress={jest.fn()}
        onSessionPress={onSessionPress}
        onTargetPress={onTargetPress}
      />,
    );

    fireEvent.press(screen.getByText("target-a"));
    fireEvent.press(screen.getByText("session-b"));

    expect(onTargetPress).toHaveBeenCalledWith("target-a");
    expect(onSessionPress).toHaveBeenCalledWith("session-b");
  });
});
