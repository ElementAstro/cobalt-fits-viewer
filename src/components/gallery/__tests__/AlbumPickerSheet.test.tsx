import { fireEvent, render, screen } from "@testing-library/react-native";
import { AlbumPickerSheet } from "../AlbumPickerSheet";
import type { Album } from "../../../lib/fits/types";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) =>
      (
        ({
          "gallery.addToAlbum": "Add to Album",
          "gallery.emptyAlbum": "No albums available",
          "album.images": "images",
          "common.cancel": "Cancel",
        }) as Record<string, string>
      )[key] ?? key,
  }),
}));

jest.mock("../../../stores/files/useFitsStore", () => ({
  useFitsStore: (selector: (s: any) => any) =>
    selector({
      getFileById: () => null,
    }),
}));

jest.mock("../../../lib/gallery/thumbnailCache", () => ({
  resolveThumbnailUri: () => null,
  resolveAlbumCoverUri: () => undefined,
}));

jest.mock("expo-image", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    Image: (props: any) => React.createElement(View, { testID: "expo-image", ...props }),
  };
});

jest.mock("../../common/SearchBar", () => ({
  SearchBar: () => null,
}));

jest.mock("../../common/EmptyState", () => ({
  EmptyState: ({ title }: any) => {
    const { Text } = require("react-native");
    return <Text>{title}</Text>;
  },
}));

jest.mock("heroui-native", () => {
  const React = require("react");
  const { Pressable, Text, View } = require("react-native");

  const BottomSheet = ({ isOpen, children }: any) => (isOpen ? <View>{children}</View> : null);
  BottomSheet.Portal = ({ children }: any) => <View>{children}</View>;
  BottomSheet.Overlay = () => null;
  BottomSheet.Content = ({ children }: any) => <View>{children}</View>;
  BottomSheet.Title = ({ children }: any) => <Text>{children}</Text>;
  BottomSheet.Close = () => null;

  const Button = ({ onPress, children }: any) => (
    <Pressable onPress={onPress}>{children}</Pressable>
  );
  Button.Label = ({ children }: any) => <Text>{children}</Text>;

  const PressableFeedback = ({ onPress, children }: any) => (
    <Pressable onPress={onPress}>{children}</Pressable>
  );
  PressableFeedback.Highlight = () => null;

  return {
    BottomSheet,
    Button,
    PressableFeedback,
    Separator: () => null,
    useThemeColor: () => ["#999", "#0f0"],
  };
});

const makeAlbum = (id: string, overrides: Partial<Album> = {}): Album => ({
  id,
  name: `Album ${id}`,
  createdAt: 1,
  updatedAt: 1,
  imageIds: [],
  isSmart: false,
  ...overrides,
});

describe("AlbumPickerSheet", () => {
  const onClose = jest.fn();
  const onSelect = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders title and album list", () => {
    render(
      <AlbumPickerSheet
        visible
        albums={[makeAlbum("a1", { name: "Nebula" }), makeAlbum("a2", { name: "Galaxy" })]}
        onClose={onClose}
        onSelect={onSelect}
      />,
    );

    expect(screen.getByText("Add to Album")).toBeTruthy();
    expect(screen.getByText("Nebula")).toBeTruthy();
    expect(screen.getByText("Galaxy")).toBeTruthy();
  });

  it("shows empty state when no albums", () => {
    render(<AlbumPickerSheet visible albums={[]} onClose={onClose} onSelect={onSelect} />);

    expect(screen.getByText("No albums available")).toBeTruthy();
  });

  it("filters out smart albums", () => {
    render(
      <AlbumPickerSheet
        visible
        albums={[
          makeAlbum("a1", { name: "Normal", isSmart: false }),
          makeAlbum("a2", { name: "Smart One", isSmart: true }),
        ]}
        onClose={onClose}
        onSelect={onSelect}
      />,
    );

    expect(screen.getByText("Normal")).toBeTruthy();
    expect(screen.queryByText("Smart One")).toBeNull();
  });

  it("calls onSelect and onClose when album is pressed", () => {
    render(
      <AlbumPickerSheet
        visible
        albums={[makeAlbum("a1", { name: "Nebula" })]}
        onClose={onClose}
        onSelect={onSelect}
      />,
    );

    fireEvent.press(screen.getByText("Nebula"));
    expect(onSelect).toHaveBeenCalledWith("a1");
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when cancel button is pressed", () => {
    render(
      <AlbumPickerSheet visible albums={[makeAlbum("a1")]} onClose={onClose} onSelect={onSelect} />,
    );

    fireEvent.press(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalled();
  });

  it("shows image count for each album", () => {
    render(
      <AlbumPickerSheet
        visible
        albums={[makeAlbum("a1", { name: "Nebula", imageIds: ["i1", "i2", "i3"] })]}
        onClose={onClose}
        onSelect={onSelect}
      />,
    );

    expect(screen.getByText("3 images")).toBeTruthy();
  });

  it("does not render when visible is false", () => {
    render(
      <AlbumPickerSheet
        visible={false}
        albums={[makeAlbum("a1", { name: "Hidden" })]}
        onClose={onClose}
        onSelect={onSelect}
      />,
    );

    expect(screen.queryByText("Hidden")).toBeNull();
  });
});
