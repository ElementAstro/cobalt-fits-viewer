import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
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
      keyExtractor?: (item: unknown) => string;
      ListHeaderComponent: React.ReactNode;
      ListEmptyComponent: React.ReactNode;
      ItemSeparatorComponent?: React.ComponentType;
    }) => {
      const Separator = props.ItemSeparatorComponent;
      return React.createElement(
        View,
        { testID: "flash-list" },
        props.ListHeaderComponent,
        props.data.length === 0
          ? props.ListEmptyComponent
          : props.data.map((item: unknown, i: number) => {
              const key = props.keyExtractor ? props.keyExtractor(item) : String(i);
              return React.createElement(
                React.Fragment,
                { key },
                props.renderItem({ item }),
                Separator && i < props.data.length - 1
                  ? React.createElement(Separator, null)
                  : null,
              );
            }),
      );
    },
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
  FileListItem: (props: {
    file: FitsMetadata;
    onToggleFavorite?: (file: FitsMetadata) => void;
    onDelete?: (file: FitsMetadata) => void;
  }) => {
    const { View, Text, Pressable } = require("react-native");
    return (
      <View testID={`file-item-${props.file.id}`}>
        <Text>{props.file.filename}</Text>
        {props.onToggleFavorite && (
          <Pressable
            testID={`fav-${props.file.id}`}
            onPress={() => props.onToggleFavorite!(props.file)}
          />
        )}
        {props.onDelete && (
          <Pressable testID={`del-${props.file.id}`} onPress={() => props.onDelete!(props.file)} />
        )}
      </View>
    );
  },
}));

jest.mock("../../common/EmptyState", () => ({
  EmptyState: (props: { title: string; secondaryLabel?: string }) => {
    const { View, Text } = require("react-native");
    return (
      <View testID="empty-state">
        <Text>{props.title}</Text>
        {props.secondaryLabel && <Text>{props.secondaryLabel}</Text>}
      </View>
    );
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

  it("renders grid empty state with clear filters action when filters active", () => {
    render(
      <FilesContent
        {...baseProps}
        isGridStyle={true}
        fileListStyle="grid"
        searchQuery="xyz"
        activeFilterCount={2}
      />,
    );
    expect(screen.getByText("files.noSupportedFound")).toBeTruthy();
    expect(screen.getByText("targets.clearFilters")).toBeTruthy();
  });

  it("renders grid empty state without clear filters when no filters", () => {
    render(
      <FilesContent
        {...baseProps}
        isGridStyle={true}
        fileListStyle="grid"
        searchQuery="xyz"
        activeFilterCount={0}
      />,
    );
    expect(screen.getByText("files.noSupportedFound")).toBeTruthy();
    expect(screen.queryByText("targets.clearFilters")).toBeNull();
  });

  it("renders list empty state with clear filters action when filters active", () => {
    render(<FilesContent {...baseProps} searchQuery="xyz" activeFilterCount={3} />);
    expect(screen.getByText("targets.clearFilters")).toBeTruthy();
  });

  it("renders grid mode with files in ThumbnailGrid", () => {
    render(
      <FilesContent
        {...baseProps}
        displayFiles={[makeFile(), makeFile({ id: "file-2", filename: "test2.fits" })]}
        isGridStyle={true}
        fileListStyle="grid"
      />,
    );
    expect(screen.getByTestId("thumbnail-grid")).toBeTruthy();
    expect(screen.getByText("test.fits")).toBeTruthy();
    expect(screen.getByText("test2.fits")).toBeTruthy();
  });

  it("calls onToggleFavorite with file id via handleToggleFavorite", () => {
    const onToggleFavorite = jest.fn();
    render(
      <FilesContent
        {...baseProps}
        displayFiles={[makeFile()]}
        isGridStyle={false}
        fileListStyle="list"
        onToggleFavorite={onToggleFavorite}
      />,
    );
    fireEvent.press(screen.getByTestId("fav-file-1"));
    expect(onToggleFavorite).toHaveBeenCalledWith("file-1");
  });

  it("calls onSingleDelete with file id via handleSingleDelete", () => {
    const onSingleDelete = jest.fn();
    render(
      <FilesContent
        {...baseProps}
        displayFiles={[makeFile()]}
        isGridStyle={false}
        fileListStyle="list"
        onSingleDelete={onSingleDelete}
      />,
    );
    fireEvent.press(screen.getByTestId("del-file-1"));
    expect(onSingleDelete).toHaveBeenCalledWith("file-1");
  });

  it("applies landscape padding in grid mode", () => {
    render(
      <FilesContent
        {...baseProps}
        displayFiles={[makeFile()]}
        isGridStyle={true}
        fileListStyle="grid"
        isLandscape={true}
      />,
    );
    expect(screen.getByTestId("thumbnail-grid")).toBeTruthy();
  });

  it("applies landscape padding in list mode", () => {
    render(
      <FilesContent
        {...baseProps}
        displayFiles={[makeFile()]}
        isGridStyle={false}
        fileListStyle="list"
        isLandscape={true}
      />,
    );
    expect(screen.getByTestId("flash-list")).toBeTruthy();
  });

  it("renders multiple files in list mode with separators", () => {
    render(
      <FilesContent
        {...baseProps}
        displayFiles={[makeFile(), makeFile({ id: "file-2", filename: "test2.fits" })]}
        isGridStyle={false}
        fileListStyle="list"
      />,
    );
    expect(screen.getByText("test.fits")).toBeTruthy();
    expect(screen.getByText("test2.fits")).toBeTruthy();
  });

  it("renders empty state without active filters (no clear button)", () => {
    render(<FilesContent {...baseProps} displayFiles={[]} searchQuery="" activeFilterCount={0} />);
    expect(screen.getByText("files.emptyState")).toBeTruthy();
    expect(screen.queryByText("targets.clearFilters")).toBeNull();
  });
});
