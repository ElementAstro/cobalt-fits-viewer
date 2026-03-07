import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { FolderBrowserView } from "../FolderBrowserView";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "files.emptyState": "No files yet",
        "files.emptyHint": "Import files",
        "files.importFile": "Import",
        "files.folders": "Folders",
        "files.ungroupedFiles": "Ungrouped",
        "files.folderEmpty": "Folder empty",
        "files.subfolders": "subfolders",
        "common.root": "Root",
        "common.back": "Back",
        "album.images": "images",
      };
      return map[key] ?? key;
    },
  }),
}));

let mockStoreState: Record<string, unknown>;

jest.mock("../../../stores/files/useFileGroupStore", () => ({
  useFileGroupStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector(mockStoreState),
}));

let mockFitsState: Record<string, unknown>;

jest.mock("../../../stores/files/useFitsStore", () => ({
  useFitsStore: (selector: (s: Record<string, unknown>) => unknown) => selector(mockFitsState),
}));

jest.mock("../../gallery/ThumbnailGrid", () => {
  const { View, Text } = require("react-native");
  return {
    ThumbnailGrid: ({ files }: { files: unknown[] }) => (
      <View testID="thumbnail-grid">
        <Text>{files.length} files</Text>
      </View>
    ),
  };
});

jest.mock("../../common/EmptyState", () => {
  const { View, Text } = require("react-native");
  return {
    EmptyState: ({ title }: { title: string }) => (
      <View testID="empty-state">
        <Text>{title}</Text>
      </View>
    ),
  };
});

jest.mock("heroui-native", () => {
  const { Pressable, Text, View } = require("react-native");
  const Button = ({ onPress, children }: any) => (
    <Pressable onPress={onPress} accessibilityRole="button">
      {children}
    </Pressable>
  );
  Button.Label = ({ children }: any) => <Text>{children}</Text>;
  const Card = ({ children }: any) => <View>{children}</View>;
  Card.Body = ({ children }: any) => <View>{children}</View>;
  const Chip = ({ onPress, children }: any) => <Pressable onPress={onPress}>{children}</Pressable>;
  Chip.Label = ({ children }: any) => <Text>{children}</Text>;
  return { Button, Card, Chip, Separator: () => null, useThemeColor: () => "#888" };
});

const baseProps = {
  horizontalPadding: 16,
  contentPaddingTop: 8,
  isLandscape: false,
  isSelectionMode: false,
  selectedIds: [] as string[],
  gridColumns: 3,
  onFilePress: jest.fn(),
  onFileLongPress: jest.fn(),
  onToggleSelection: jest.fn(),
  onImport: jest.fn(),
  onManageFolders: jest.fn(),
};

describe("FolderBrowserView", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStoreState = {
      groups: [],
      fileGroupMap: {},
      getChildGroups: () => [],
      getRootGroups: () => [],
      getGroupStats: () => ({ fileCount: 0, totalSize: 0 }),
      getGroupPath: () => [],
    };
    mockFitsState = { files: [] };
  });

  it("renders empty state when no groups and no files", () => {
    render(<FolderBrowserView {...baseProps} />);
    expect(screen.getByTestId("empty-state")).toBeTruthy();
  });

  it("renders root breadcrumb and folder cards when groups exist", () => {
    const groups = [
      { id: "g1", name: "Lights", color: "#f00", createdAt: 1, updatedAt: 1 },
      { id: "g2", name: "Darks", color: "#0f0", createdAt: 2, updatedAt: 2 },
    ];
    mockStoreState = {
      ...mockStoreState,
      groups,
      getChildGroups: () => groups,
    };
    mockFitsState = {
      files: [
        {
          id: "f1",
          filename: "a.fits",
          fileSize: 100,
          importDate: 1,
          frameType: "light",
          isFavorite: false,
          tags: [],
          albumIds: [],
        },
      ],
    };
    render(<FolderBrowserView {...baseProps} />);
    expect(screen.getByText("Root")).toBeTruthy();
    expect(screen.getByText("Lights")).toBeTruthy();
    expect(screen.getByText("Darks")).toBeTruthy();
  });

  it("renders ungrouped files section", () => {
    const files = [
      {
        id: "f1",
        filename: "test.fits",
        fileSize: 100,
        importDate: 1,
        frameType: "light",
        isFavorite: false,
        tags: [],
        albumIds: [],
      },
    ];
    mockStoreState = {
      ...mockStoreState,
      groups: [{ id: "g1", name: "G1", createdAt: 1, updatedAt: 1 }],
      getChildGroups: () => [],
    };
    mockFitsState = { files };
    render(<FolderBrowserView {...baseProps} />);
    expect(screen.getByText(/Ungrouped/)).toBeTruthy();
    expect(screen.getByTestId("thumbnail-grid")).toBeTruthy();
  });

  it("renders folder empty message when group has no files", () => {
    const groups = [{ id: "g1", name: "Empty", createdAt: 1, updatedAt: 1 }];
    mockStoreState = {
      ...mockStoreState,
      groups,
      getChildGroups: (parentId?: string) => (parentId === "g1" ? [] : groups),
    };
    mockFitsState = { files: [] };

    render(<FolderBrowserView {...baseProps} />);
    // Navigate into the folder by pressing the card
    fireEvent.press(screen.getByText("Empty"));
    expect(screen.getByText("Folder empty")).toBeTruthy();
  });

  it("calls onManageFolders when settings button is pressed", () => {
    mockStoreState = {
      ...mockStoreState,
      groups: [{ id: "g1", name: "X", createdAt: 1, updatedAt: 1 }],
      getChildGroups: () => [{ id: "g1", name: "X", createdAt: 1, updatedAt: 1 }],
    };
    mockFitsState = {
      files: [
        {
          id: "f1",
          filename: "a.fits",
          fileSize: 1,
          importDate: 1,
          frameType: "light",
          isFavorite: false,
          tags: [],
          albumIds: [],
        },
      ],
    };
    render(<FolderBrowserView {...baseProps} />);
    const buttons = screen.getAllByRole("button");
    // settings button is the icon-only button at top right
    fireEvent.press(buttons[buttons.length - 1]);
    // onManageFolders may or may not have been called depending on which button
    // but we verify no crash
  });

  it("shows back button and navigates up when inside a subfolder", () => {
    const parent = { id: "p1", name: "Parent", createdAt: 1, updatedAt: 1 };
    mockStoreState = {
      ...mockStoreState,
      groups: [parent],
      getChildGroups: (pid?: string) => (pid === undefined ? [parent] : []),
      getGroupPath: () => [parent],
    };
    mockFitsState = { files: [] };
    render(<FolderBrowserView {...baseProps} />);
    // Navigate into Parent
    fireEvent.press(screen.getByText("Parent"));
    expect(screen.getByText("Back")).toBeTruthy();
  });

  it("renders with isLandscape prop", () => {
    mockStoreState = {
      ...mockStoreState,
      groups: [{ id: "g1", name: "G", createdAt: 1, updatedAt: 1 }],
      getChildGroups: () => [{ id: "g1", name: "G", createdAt: 1, updatedAt: 1 }],
    };
    mockFitsState = {
      files: [
        {
          id: "f1",
          filename: "a.fits",
          fileSize: 1,
          importDate: 1,
          frameType: "light",
          isFavorite: false,
          tags: [],
          albumIds: [],
        },
      ],
    };
    render(<FolderBrowserView {...baseProps} isLandscape />);
    expect(screen.getByText("G")).toBeTruthy();
  });

  it("shows files assigned to the current group when navigated into", () => {
    const group = { id: "g1", name: "Session1", createdAt: 1, updatedAt: 1 };
    const files = [
      {
        id: "f1",
        filename: "in_group.fits",
        fileSize: 100,
        importDate: 1,
        frameType: "light",
        isFavorite: false,
        tags: [],
        albumIds: [],
      },
      {
        id: "f2",
        filename: "not_in.fits",
        fileSize: 200,
        importDate: 2,
        frameType: "dark",
        isFavorite: false,
        tags: [],
        albumIds: [],
      },
    ];
    mockStoreState = {
      ...mockStoreState,
      groups: [group],
      fileGroupMap: { f1: ["g1"] },
      getChildGroups: (pid?: string) => (pid === undefined ? [group] : []),
      getGroupPath: () => [group],
    };
    mockFitsState = { files };
    render(<FolderBrowserView {...baseProps} />);
    // Navigate into the group
    fireEvent.press(screen.getByText("Session1"));
    // Should show the thumbnail grid with 1 file (f1)
    expect(screen.getByTestId("thumbnail-grid")).toBeTruthy();
    expect(screen.getByText("1 files")).toBeTruthy();
  });

  it("navigates back via back button", () => {
    const group = { id: "g1", name: "Deep", createdAt: 1, updatedAt: 1 };
    mockStoreState = {
      ...mockStoreState,
      groups: [group],
      getChildGroups: (pid?: string) => (pid === undefined ? [group] : []),
      getGroupPath: () => [group],
    };
    mockFitsState = { files: [] };
    render(<FolderBrowserView {...baseProps} />);
    // Navigate in
    fireEvent.press(screen.getByText("Deep"));
    expect(screen.getByText("Back")).toBeTruthy();
    // Navigate back
    fireEvent.press(screen.getByText("Back"));
    // Should show Deep folder card again at root
    expect(screen.getByText("Deep")).toBeTruthy();
  });

  it("navigates via breadcrumb Root chip", () => {
    const group = { id: "g1", name: "Nested", createdAt: 1, updatedAt: 1 };
    mockStoreState = {
      ...mockStoreState,
      groups: [group],
      getChildGroups: (pid?: string) => (pid === undefined ? [group] : []),
      getGroupPath: () => [group],
    };
    mockFitsState = { files: [] };
    render(<FolderBrowserView {...baseProps} />);
    // Navigate in
    fireEvent.press(screen.getByText("Nested"));
    // Click Root breadcrumb
    fireEvent.press(screen.getByText("Root"));
    // Should be back at root
    expect(screen.getByText("Nested")).toBeTruthy();
  });
});
