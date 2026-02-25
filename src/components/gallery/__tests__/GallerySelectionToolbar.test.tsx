import { fireEvent, render, screen } from "@testing-library/react-native";
import { GallerySelectionToolbar } from "../GallerySelectionToolbar";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) =>
      (
        ({
          "album.selected": "selected",
          "gallery.addToAlbum": "Add to Album",
          "common.selectAll": "Select All",
          "common.deselectAll": "Deselect All",
        }) as Record<string, string>
      )[key] ?? key,
  }),
}));

jest.mock("heroui-native", () => {
  const { Pressable, Text } = require("react-native");

  const Button = ({ onPress, children, testID, isDisabled }: any) => (
    <Pressable onPress={isDisabled ? undefined : onPress} testID={testID}>
      {children}
    </Pressable>
  );
  Button.Label = ({ children }: any) => <Text>{children}</Text>;

  return {
    Button,
    useThemeColor: () => ["#999", "#f00"],
  };
});

jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return {
    Ionicons: ({ name }: { name: string }) =>
      React.createElement(Text, { testID: `icon-${name}` }, name),
  };
});

describe("GallerySelectionToolbar", () => {
  const onSelectAllToggle = jest.fn();
  const onAddToAlbum = jest.fn();
  const onBatchTag = jest.fn();
  const onBatchRename = jest.fn();
  const onCompare = jest.fn();
  const onBatchDelete = jest.fn();
  const onExitSelection = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  const defaultProps = {
    selectedCount: 3,
    allDisplaySelected: false,
    isLandscape: false,
    onSelectAllToggle,
    onAddToAlbum,
    onBatchTag,
    onBatchRename,
    onCompare,
    onBatchDelete,
    onExitSelection,
  };

  it("renders selected count", () => {
    render(<GallerySelectionToolbar {...defaultProps} />);

    expect(screen.getByText("3 selected")).toBeTruthy();
  });

  it("renders Select All label in portrait mode", () => {
    render(<GallerySelectionToolbar {...defaultProps} />);

    expect(screen.getByText("Select All")).toBeTruthy();
  });

  it("renders Deselect All when allDisplaySelected is true", () => {
    render(<GallerySelectionToolbar {...defaultProps} allDisplaySelected />);

    expect(screen.getByText("Deselect All")).toBeTruthy();
  });

  it("hides text labels in landscape mode", () => {
    render(<GallerySelectionToolbar {...defaultProps} isLandscape />);

    expect(screen.queryByText("Select All")).toBeNull();
    expect(screen.queryByText("Add to Album")).toBeNull();
  });

  it("fires onBatchDelete when trash button pressed", () => {
    render(<GallerySelectionToolbar {...defaultProps} />);

    fireEvent.press(screen.getByTestId("icon-trash-outline"));
    expect(onBatchDelete).toHaveBeenCalledTimes(1);
  });

  it("fires onExitSelection when close button pressed", () => {
    render(<GallerySelectionToolbar {...defaultProps} />);

    fireEvent.press(screen.getByTestId("icon-close-outline"));
    expect(onExitSelection).toHaveBeenCalledTimes(1);
  });

  it("enables compare when selectedCount >= 2", () => {
    render(<GallerySelectionToolbar {...defaultProps} selectedCount={2} />);

    fireEvent.press(screen.getByTestId("e2e-action-tabs__gallery-open-compare"));
    expect(onCompare).toHaveBeenCalledTimes(1);
  });

  it("enables action buttons when selectedCount > 0", () => {
    render(<GallerySelectionToolbar {...defaultProps} selectedCount={3} />);

    fireEvent.press(screen.getByTestId("icon-albums-outline"));
    expect(onAddToAlbum).toHaveBeenCalledTimes(1);
  });
});
