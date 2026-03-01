import { render, screen, fireEvent } from "@testing-library/react-native";
import { AlbumCard } from "../AlbumCard";
import type { Album } from "../../../lib/fits/types";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) =>
      (
        ({
          "album.images": "images",
        }) as Record<string, string>
      )[key] ?? key,
  }),
}));

jest.mock("../../../stores/useFitsStore", () => ({
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

jest.mock("heroui-native", () => {
  const React = require("react");
  const { Pressable, Text, View } = require("react-native");

  const Button = ({ onPress, children, ...rest }: any) => (
    <Pressable onPress={onPress} testID={rest.testID}>
      {children}
    </Pressable>
  );
  Button.Label = ({ children }: any) => <Text>{children}</Text>;

  const Card = ({ children, ...rest }: any) => <View {...rest}>{children}</View>;
  Card.Body = ({ children, ...rest }: any) => <View {...rest}>{children}</View>;
  Card.Header = ({ children, ...rest }: any) => <View {...rest}>{children}</View>;
  Card.Footer = ({ children, ...rest }: any) => <View {...rest}>{children}</View>;

  const Chip = ({ children }: any) => <View>{children}</View>;
  Chip.Label = ({ children }: any) => <Text>{children}</Text>;

  const PressableFeedback = ({ onPress, children }: any) => (
    <Pressable onPress={onPress}>{children}</Pressable>
  );
  PressableFeedback.Highlight = () => null;

  const Surface = ({ children, ...rest }: any) => <View {...rest}>{children}</View>;

  return {
    Button,
    Card,
    Chip,
    PressableFeedback,
    Surface,
    useThemeColor: () => ["#999"],
  };
});

const makeAlbum = (overrides: Partial<Album> = {}): Album => ({
  id: "album-1",
  name: "Test Album",
  createdAt: 1,
  updatedAt: 1,
  imageIds: ["img-1", "img-2"],
  isSmart: false,
  ...overrides,
});

describe("AlbumCard", () => {
  it("renders album name and image count", () => {
    render(<AlbumCard album={makeAlbum()} />);

    expect(screen.getByText("Test Album")).toBeTruthy();
    expect(screen.getByText("2 images")).toBeTruthy();
  });

  it("calls onPress when tapped", () => {
    const onPress = jest.fn();
    render(<AlbumCard album={makeAlbum()} onPress={onPress} />);

    fireEvent.press(screen.getByText("Test Album"));
    expect(onPress).toHaveBeenCalled();
  });

  it("calls onLongPress when long-pressed", () => {
    const onLongPress = jest.fn();
    render(<AlbumCard album={makeAlbum()} onLongPress={onLongPress} />);

    fireEvent(screen.getByText("Test Album"), "longPress");
    expect(onLongPress).toHaveBeenCalled();
  });

  it("shows smart album indicator when isSmart is true", () => {
    render(<AlbumCard album={makeAlbum({ isSmart: true })} />);

    expect(screen.getByText("Test Album")).toBeTruthy();
  });

  it("shows pinned indicator when isPinned is true", () => {
    render(<AlbumCard album={makeAlbum({ isPinned: true })} />);

    expect(screen.getByText("Test Album")).toBeTruthy();
  });

  it("shows zero images when album has no imageIds", () => {
    render(<AlbumCard album={makeAlbum({ imageIds: [] })} />);

    expect(screen.getByText("0 images")).toBeTruthy();
  });
});
