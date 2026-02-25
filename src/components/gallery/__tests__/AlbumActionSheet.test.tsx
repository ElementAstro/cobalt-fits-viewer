import { fireEvent, render, screen } from "@testing-library/react-native";
import { AlbumActionSheet } from "../AlbumActionSheet";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) =>
      (
        ({
          "album.viewDetail": "View Detail",
          "album.pin": "Pin",
          "album.unpin": "Unpin",
          "album.rename": "Rename",
          "album.editNotes": "Edit Notes",
          "album.statistics": "Statistics",
          "album.exportZip": "Export ZIP",
          "album.mergeAlbum": "Merge Album",
          "album.deleteAlbum": "Delete Album",
          "common.cancel": "Cancel",
        }) as Record<string, string>
      )[key] ?? key,
  }),
}));

jest.mock("heroui-native", () => {
  const React = require("react");
  const { Pressable, Text, View } = require("react-native");

  const BottomSheet = ({ isOpen, children, onOpenChange: _onOpenChange }: any) =>
    isOpen ? <View>{children}</View> : null;
  BottomSheet.Portal = ({ children }: any) => <View>{children}</View>;
  BottomSheet.Overlay = () => null;
  BottomSheet.Content = ({ children }: any) => <View>{children}</View>;
  BottomSheet.Title = ({ children }: any) => <Text>{children}</Text>;

  const Button = ({ onPress, children }: any) => (
    <Pressable onPress={onPress}>{children}</Pressable>
  );
  Button.Label = ({ children }: any) => <Text>{children}</Text>;

  return {
    BottomSheet,
    Button,
    Separator: () => null,
    useThemeColor: () => ["#999", "#00ff00", "#f00"],
  };
});

describe("AlbumActionSheet", () => {
  const onClose = jest.fn();
  const onRename = jest.fn();
  const onDelete = jest.fn();
  const onViewDetail = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders album name and core actions", () => {
    render(
      <AlbumActionSheet
        visible
        albumName="My Nebula"
        onClose={onClose}
        onRename={onRename}
        onDelete={onDelete}
        onViewDetail={onViewDetail}
      />,
    );

    expect(screen.getByText("My Nebula")).toBeTruthy();
    expect(screen.getByText("View Detail")).toBeTruthy();
    expect(screen.getByText("Rename")).toBeTruthy();
    expect(screen.getByText("Delete Album")).toBeTruthy();
  });

  it("does not render when visible is false", () => {
    render(
      <AlbumActionSheet
        visible={false}
        albumName="Hidden"
        onClose={onClose}
        onRename={onRename}
        onDelete={onDelete}
        onViewDetail={onViewDetail}
      />,
    );

    expect(screen.queryByText("Hidden")).toBeNull();
  });

  it("calls onClose then onViewDetail when view detail is pressed", () => {
    render(
      <AlbumActionSheet
        visible
        albumName="Test"
        onClose={onClose}
        onRename={onRename}
        onDelete={onDelete}
        onViewDetail={onViewDetail}
      />,
    );

    fireEvent.press(screen.getByText("View Detail"));
    expect(onClose).toHaveBeenCalled();
    expect(onViewDetail).toHaveBeenCalled();
  });

  it("calls onClose then onRename when rename is pressed", () => {
    render(
      <AlbumActionSheet
        visible
        albumName="Test"
        onClose={onClose}
        onRename={onRename}
        onDelete={onDelete}
        onViewDetail={onViewDetail}
      />,
    );

    fireEvent.press(screen.getByText("Rename"));
    expect(onClose).toHaveBeenCalled();
    expect(onRename).toHaveBeenCalled();
  });

  it("calls onClose then onDelete when delete is pressed", () => {
    render(
      <AlbumActionSheet
        visible
        albumName="Test"
        onClose={onClose}
        onRename={onRename}
        onDelete={onDelete}
        onViewDetail={onViewDetail}
      />,
    );

    fireEvent.press(screen.getByText("Delete Album"));
    expect(onClose).toHaveBeenCalled();
    expect(onDelete).toHaveBeenCalled();
  });

  it("shows pin action when onTogglePin is provided", () => {
    const onTogglePin = jest.fn();
    render(
      <AlbumActionSheet
        visible
        albumName="Test"
        onClose={onClose}
        onRename={onRename}
        onDelete={onDelete}
        onViewDetail={onViewDetail}
        onTogglePin={onTogglePin}
      />,
    );

    expect(screen.getByText("Pin")).toBeTruthy();
    fireEvent.press(screen.getByText("Pin"));
    expect(onTogglePin).toHaveBeenCalled();
  });

  it("shows unpin label when album is pinned", () => {
    render(
      <AlbumActionSheet
        visible
        albumName="Pinned Album"
        isPinned
        onClose={onClose}
        onRename={onRename}
        onDelete={onDelete}
        onViewDetail={onViewDetail}
        onTogglePin={jest.fn()}
      />,
    );

    expect(screen.getByText("Unpin")).toBeTruthy();
  });

  it("hides merge action for smart albums", () => {
    render(
      <AlbumActionSheet
        visible
        albumName="Smart"
        isSmart
        onClose={onClose}
        onRename={onRename}
        onDelete={onDelete}
        onViewDetail={onViewDetail}
        onMerge={jest.fn()}
      />,
    );

    expect(screen.queryByText("Merge Album")).toBeNull();
  });

  it("shows merge action for non-smart albums when onMerge provided", () => {
    const onMerge = jest.fn();
    render(
      <AlbumActionSheet
        visible
        albumName="Normal"
        onClose={onClose}
        onRename={onRename}
        onDelete={onDelete}
        onViewDetail={onViewDetail}
        onMerge={onMerge}
      />,
    );

    expect(screen.getByText("Merge Album")).toBeTruthy();
    fireEvent.press(screen.getByText("Merge Album"));
    expect(onMerge).toHaveBeenCalled();
  });

  it("shows optional actions when callbacks are provided", () => {
    render(
      <AlbumActionSheet
        visible
        albumName="Full"
        onClose={onClose}
        onRename={onRename}
        onDelete={onDelete}
        onViewDetail={onViewDetail}
        onEditNotes={jest.fn()}
        onExport={jest.fn()}
        onViewStats={jest.fn()}
      />,
    );

    expect(screen.getByText("Edit Notes")).toBeTruthy();
    expect(screen.getByText("Export ZIP")).toBeTruthy();
    expect(screen.getByText("Statistics")).toBeTruthy();
  });

  it("calls onClose when cancel button is pressed", () => {
    render(
      <AlbumActionSheet
        visible
        albumName="Test"
        onClose={onClose}
        onRename={onRename}
        onDelete={onDelete}
        onViewDetail={onViewDetail}
      />,
    );

    fireEvent.press(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalled();
  });
});
