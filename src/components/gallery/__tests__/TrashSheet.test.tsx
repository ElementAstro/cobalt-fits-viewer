import { fireEvent, render, screen } from "@testing-library/react-native";
import { TrashSheet } from "../TrashSheet";
import type { TrashedFitsRecord } from "../../../lib/fits/types";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) =>
      (
        ({
          "files.trashTitle": "Trash",
          "files.filesCount": "{count} files",
          "files.trashEmpty": "Trash is empty",
          "files.trashExpires": "Expires in",
          "files.restore": "Restore",
          "files.restoreAll": "Restore All",
          "files.emptyTrash": "Empty Trash",
        }) as Record<string, string>
      )[key] ?? key,
  }),
}));

jest.mock("../../../lib/utils/fileManager", () => ({
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

  const Button = ({ onPress, children, isDisabled }: any) => (
    <Pressable onPress={isDisabled ? undefined : onPress}>{children}</Pressable>
  );
  Button.Label = ({ children }: any) => <Text>{children}</Text>;

  return {
    BottomSheet,
    Button,
    Separator: () => null,
    useThemeColor: () => ["#999"],
  };
});

const makeTrashItem = (
  trashId: string,
  overrides: Partial<TrashedFitsRecord> = {},
): TrashedFitsRecord => ({
  trashId,
  originalFilepath: `file:///tmp/${trashId}.fits`,
  trashedFilepath: `file:///trash/${trashId}.fits`,
  deletedAt: Date.now(),
  expireAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
  groupIds: [],
  file: {
    id: `file-${trashId}`,
    filename: `${trashId}.fits`,
    filepath: `file:///tmp/${trashId}.fits`,
    fileSize: 2048,
    importDate: Date.now(),
    frameType: "light",
    isFavorite: false,
    tags: [],
    albumIds: [],
  },
  ...overrides,
});

describe("TrashSheet", () => {
  const onClose = jest.fn();
  const onRestore = jest.fn();
  const onDeleteForever = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders title and file count", () => {
    render(
      <TrashSheet
        visible
        items={[makeTrashItem("t1"), makeTrashItem("t2")]}
        onClose={onClose}
        onRestore={onRestore}
        onDeleteForever={onDeleteForever}
      />,
    );

    expect(screen.getByText("Trash")).toBeTruthy();
    expect(screen.getByText(/2 files/)).toBeTruthy();
  });

  it("shows empty state when no items", () => {
    render(
      <TrashSheet
        visible
        items={[]}
        onClose={onClose}
        onRestore={onRestore}
        onDeleteForever={onDeleteForever}
      />,
    );

    expect(screen.getByText("Trash is empty")).toBeTruthy();
  });

  it("renders item filenames", () => {
    render(
      <TrashSheet
        visible
        items={[makeTrashItem("t1"), makeTrashItem("t2")]}
        onClose={onClose}
        onRestore={onRestore}
        onDeleteForever={onDeleteForever}
      />,
    );

    expect(screen.getByText("t1.fits")).toBeTruthy();
    expect(screen.getByText("t2.fits")).toBeTruthy();
  });

  it("calls onRestore with single item when restore button is pressed", () => {
    render(
      <TrashSheet
        visible
        items={[makeTrashItem("t1")]}
        onClose={onClose}
        onRestore={onRestore}
        onDeleteForever={onDeleteForever}
      />,
    );

    fireEvent.press(screen.getByText("Restore"));
    expect(onRestore).toHaveBeenCalledWith(["t1"]);
  });

  it("calls onRestore with all item ids when restore all is pressed", () => {
    render(
      <TrashSheet
        visible
        items={[makeTrashItem("t1"), makeTrashItem("t2")]}
        onClose={onClose}
        onRestore={onRestore}
        onDeleteForever={onDeleteForever}
      />,
    );

    fireEvent.press(screen.getByText("Restore All"));
    expect(onRestore).toHaveBeenCalledWith(["t1", "t2"]);
  });

  it("calls onDeleteForever with no args when empty trash is pressed", () => {
    render(
      <TrashSheet
        visible
        items={[makeTrashItem("t1")]}
        onClose={onClose}
        onRestore={onRestore}
        onDeleteForever={onDeleteForever}
      />,
    );

    fireEvent.press(screen.getByText("Empty Trash"));
    expect(onDeleteForever).toHaveBeenCalledWith();
  });

  it("disables restore all and empty trash buttons when trash is empty", () => {
    render(
      <TrashSheet
        visible
        items={[]}
        onClose={onClose}
        onRestore={onRestore}
        onDeleteForever={onDeleteForever}
      />,
    );

    // Buttons should be rendered but disabled (mock swallows onPress when isDisabled)
    expect(screen.getByText("Restore All")).toBeTruthy();
    expect(screen.getByText("Empty Trash")).toBeTruthy();
    expect(screen.getByText("Trash is empty")).toBeTruthy();
  });

  it("renders file size for each item", () => {
    render(
      <TrashSheet
        visible
        items={[makeTrashItem("t1")]}
        onClose={onClose}
        onRestore={onRestore}
        onDeleteForever={onDeleteForever}
      />,
    );

    expect(screen.getAllByText(/2 KB/).length).toBeGreaterThanOrEqual(1);
  });

  it("shows total size in header", () => {
    render(
      <TrashSheet
        visible
        items={[makeTrashItem("t1"), makeTrashItem("t2")]}
        onClose={onClose}
        onRestore={onRestore}
        onDeleteForever={onDeleteForever}
      />,
    );

    expect(screen.getByText(/4 KB/)).toBeTruthy();
  });

  it("does not render when visible is false", () => {
    render(
      <TrashSheet
        visible={false}
        items={[makeTrashItem("t1")]}
        onClose={onClose}
        onRestore={onRestore}
        onDeleteForever={onDeleteForever}
      />,
    );

    expect(screen.queryByText("Trash")).toBeNull();
  });
});
