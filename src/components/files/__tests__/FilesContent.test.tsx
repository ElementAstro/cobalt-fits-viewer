import React from "react";
import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { FilesContent } from "../FilesContent";
import type { FitsMetadata } from "../../../lib/fits/types";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock("@shopify/flash-list", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    FlashList: (props: {
      data: unknown[];
      renderItem: (info: { item: unknown }) => React.ReactNode;
      ListHeaderComponent: React.ReactNode;
      ListEmptyComponent: React.ReactNode;
    }) =>
      React.createElement(
        View,
        { testID: "flash-list" },
        props.ListHeaderComponent,
        props.data.length === 0
          ? props.ListEmptyComponent
          : props.data.map((item: unknown) => props.renderItem({ item })),
      ),
  };
});

jest.mock("../../gallery/ThumbnailGrid", () => ({
  ThumbnailGrid: (props: { files: FitsMetadata[] }) => {
    const { View, Text } = require("react-native");
    return (
      <View testID="thumbnail-grid">
        {props.files.map((f) => (
          <Text key={f.id}>{f.filename}</Text>
        ))}
      </View>
    );
  },
}));

jest.mock("../../gallery/FileListItem", () => ({
  FileListItem: (props: { file: FitsMetadata }) => {
    const { Text } = require("react-native");
    return <Text testID={`file-item-${props.file.id}`}>{props.file.filename}</Text>;
  },
}));

jest.mock("../../common/EmptyState", () => ({
  EmptyState: (props: { title: string }) => {
    const { Text } = require("react-native");
    return <Text testID="empty-state">{props.title}</Text>;
  },
}));

jest.mock("expo-image", () => {
  const { View } = require("react-native");
  return {
    Image: (props: Record<string, unknown>) => <View testID="expo-image" {...props} />,
  };
});

jest.mock("react-native-gesture-handler", () => {
  const { View } = require("react-native");
  const React = require("react");
  return {
    Swipeable: React.forwardRef((props: Record<string, unknown>, _ref: unknown) =>
      React.createElement(View, props as object, props.children as React.ReactNode),
    ),
    GestureHandlerRootView: (props: Record<string, unknown>) =>
      React.createElement(View, props as object, props.children as React.ReactNode),
  };
});

const makeFile = (overrides: Partial<FitsMetadata> = {}): FitsMetadata => ({
  id: "file-1",
  filename: "test.fits",
  filepath: "file:///test.fits",
  fileSize: 1024,
  importDate: Date.now(),
  frameType: "light",
  isFavorite: false,
  tags: [],
  albumIds: [],
  ...overrides,
});

const ListHeader = <Text>Header</Text>;

const baseProps = {
  displayFiles: [] as FitsMetadata[],
  searchQuery: "",
  activeFilterCount: 0,
  fileListStyle: "list" as const,
  isGridStyle: false,
  listColumns: 3,
  isSelectionMode: false,
  selectedIds: [] as string[],
  selectedIdSet: new Set<string>(),
  horizontalPadding: 16,
  contentPaddingTop: 0,
  isLandscape: false,
  thumbShowFilename: true,
  thumbShowObject: false,
  thumbShowFilter: false,
  thumbShowExposure: false,
  ListHeader,
  onFilePress: jest.fn(),
  onFileLongPress: jest.fn(),
  onToggleSelection: jest.fn(),
  onToggleFavorite: jest.fn(),
  onSingleDelete: jest.fn(),
  onImport: jest.fn(),
  onClearFilters: jest.fn(),
};

describe("FilesContent", () => {
  it("renders empty state with import action when no files", () => {
    render(<FilesContent {...baseProps} />);
    expect(screen.getByText("files.emptyState")).toBeTruthy();
  });

  it("renders no-results empty state when search has no matches", () => {
    render(<FilesContent {...baseProps} searchQuery="xyz" />);
    expect(screen.getByText("files.noSupportedFound")).toBeTruthy();
  });

  it("renders ThumbnailGrid in grid mode with files", () => {
    render(
      <FilesContent
        {...baseProps}
        displayFiles={[makeFile()]}
        isGridStyle={true}
        fileListStyle="grid"
      />,
    );
    expect(screen.getByTestId("thumbnail-grid")).toBeTruthy();
  });

  it("renders FlashList in list mode with files", () => {
    render(
      <FilesContent
        {...baseProps}
        displayFiles={[makeFile()]}
        isGridStyle={false}
        fileListStyle="list"
      />,
    );
    expect(screen.getByTestId("flash-list")).toBeTruthy();
    expect(screen.getByText("test.fits")).toBeTruthy();
  });
});
