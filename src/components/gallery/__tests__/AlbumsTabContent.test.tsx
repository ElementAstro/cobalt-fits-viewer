import { fireEvent, render, screen } from "@testing-library/react-native";
import { AlbumsTabContent } from "../AlbumsTabContent";
import type { Album } from "../../../lib/fits/types";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) =>
      (
        ({
          "gallery.albums": "Albums",
          "gallery.createAlbum": "Create Album",
          "album.noAlbums": "No albums yet",
          "album.createFirst": "Create your first album",
          "album.images": "images",
        }) as Record<string, string>
      )[key] ?? key,
  }),
}));

jest.mock("../../../hooks/useResponsiveLayout", () => ({
  useResponsiveLayout: () => ({
    isLandscape: false,
    isLandscapeTablet: false,
  }),
}));

jest.mock("@shopify/flash-list", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    FlashList: ({ data, renderItem, ListHeaderComponent, ListEmptyComponent }: any) => (
      <View>
        {ListHeaderComponent}
        {data.length === 0
          ? ListEmptyComponent
          : data.map((item: any, index: number) => (
              <View key={item.id ?? index}>{renderItem({ item, index })}</View>
            ))}
      </View>
    ),
  };
});

jest.mock("../AlbumCard", () => {
  const { Pressable, Text } = require("react-native");
  return {
    AlbumCard: ({ album, onPress, onLongPress }: any) => (
      <Pressable onPress={onPress} onLongPress={onLongPress} testID={`album-card-${album.id}`}>
        <Text>{album.name}</Text>
      </Pressable>
    ),
  };
});

jest.mock("../AlbumSortControl", () => ({
  AlbumSortControl: () => null,
}));

jest.mock("../../common/SearchBar", () => ({
  SearchBar: () => null,
}));

jest.mock("heroui-native", () => {
  const { Pressable, Text } = require("react-native");

  const Button = ({ onPress, children, testID }: any) => (
    <Pressable onPress={onPress} testID={testID}>
      {children}
    </Pressable>
  );
  Button.Label = ({ children }: any) => <Text>{children}</Text>;

  return {
    Button,
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

describe("AlbumsTabContent", () => {
  const defaultProps = {
    albums: [] as Album[],
    searchQuery: "",
    sortBy: "date" as const,
    sortOrder: "desc" as const,
    onSearchChange: jest.fn(),
    onSortByChange: jest.fn(),
    onSortOrderChange: jest.fn(),
    onAlbumPress: jest.fn(),
    onAlbumAction: jest.fn(),
    onCreateAlbum: jest.fn(),
    onCreateSmartAlbum: jest.fn(),
    onFindDuplicates: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows empty state when no albums", () => {
    render(<AlbumsTabContent {...defaultProps} albums={[]} />);

    expect(screen.getByText("No albums yet")).toBeTruthy();
    expect(screen.getByText("Create your first album")).toBeTruthy();
  });

  it("renders album count in header", () => {
    render(<AlbumsTabContent {...defaultProps} albums={[makeAlbum("a1"), makeAlbum("a2")]} />);

    expect(screen.getByText("Albums (2)")).toBeTruthy();
  });

  it("renders album cards", () => {
    render(
      <AlbumsTabContent
        {...defaultProps}
        albums={[makeAlbum("a1", { name: "Orion" }), makeAlbum("a2", { name: "Andromeda" })]}
      />,
    );

    expect(screen.getByText("Orion")).toBeTruthy();
    expect(screen.getByText("Andromeda")).toBeTruthy();
  });

  it("calls onAlbumPress when album card is pressed", () => {
    const onAlbumPress = jest.fn();
    const album = makeAlbum("a1", { name: "Orion" });

    render(<AlbumsTabContent {...defaultProps} albums={[album]} onAlbumPress={onAlbumPress} />);

    fireEvent.press(screen.getByTestId("album-card-a1"));
    expect(onAlbumPress).toHaveBeenCalledWith(album);
  });

  it("calls onCreateAlbum when create button is pressed", () => {
    const onCreateAlbum = jest.fn();

    render(<AlbumsTabContent {...defaultProps} onCreateAlbum={onCreateAlbum} />);

    fireEvent.press(screen.getByTestId("e2e-action-tabs__gallery-open-create-album"));
    expect(onCreateAlbum).toHaveBeenCalled();
  });
});
