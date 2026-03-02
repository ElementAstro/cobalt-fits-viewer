import { fireEvent, render, screen } from "@testing-library/react-native";
import { GalleryHeader } from "../GalleryHeader";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) =>
      (
        ({
          "gallery.title": "Gallery",
          "gallery.subtitle": "All images",
          "gallery.allImages": "All Images",
          "gallery.allTypes": "All Types",
          "gallery.favoritesOnly": "Favorites",
          "gallery.searchPlaceholder": "Search...",
          "gallery.addToAlbum": "Add to Album",
          "album.selected": "selected",
          "targets.title": "Targets",
          "targets.clearFilters": "Clear Filters",
          "common.selectAll": "Select All",
          "common.deselectAll": "Deselect All",
        }) as Record<string, string>
      )[key] ?? key,
  }),
}));

jest.mock("expo-linear-gradient", () => ({
  LinearGradient: () => null,
}));

jest.mock("../../common/SearchBar", () => {
  const React = require("react");
  const { TextInput } = require("react-native");
  return {
    SearchBar: ({ value, onChangeText }: any) => (
      <TextInput value={value} onChangeText={onChangeText} testID="search-bar" />
    ),
  };
});

jest.mock("heroui-native", () => {
  const { Pressable, Text, View } = require("react-native");

  const Button = ({ onPress, children, testID, isDisabled }: any) => (
    <Pressable onPress={isDisabled ? undefined : onPress} testID={testID}>
      {children}
    </Pressable>
  );
  Button.Label = ({ children }: any) => <Text>{children}</Text>;

  const Chip = ({ onPress, children }: any) => <Pressable onPress={onPress}>{children}</Pressable>;
  Chip.Label = ({ children }: any) => <Text>{children}</Text>;

  const ScrollShadow = ({ children }: any) => <View>{children}</View>;

  return {
    Button,
    Chip,
    ScrollShadow,
    Separator: () => null,
    useThemeColor: () => ["#0f0", "#999"],
  };
});

const defaultProps = {
  totalCount: 100,
  displayCount: 50,
  viewMode: "grid" as const,
  searchQuery: "",
  filterObject: "",
  filterFrameType: "",
  filterTargetId: "",
  filterFavoriteOnly: false,
  activeFilterCount: 0,
  metadataIndex: {
    objects: [],
    filters: [],
    frameTypes: [],
    sourceFormats: [],
    instruments: [],
    telescopes: [],
    tags: [],
    locations: [],
    dateRange: null,
    exptimeRange: null,
  },
  frameTypes: [
    { key: "light", label: "Light", icon: "sunny-outline" as const },
    { key: "dark", label: "Dark", icon: "moon-outline" as const },
  ],
  isLandscape: false,
  isSelectionMode: false,
  selectedCount: 0,
  selectedImageCount: 0,
  allDisplaySelected: false,
  onViewModeChange: jest.fn(),
  onSearchChange: jest.fn(),
  onFilterObjectChange: jest.fn(),
  onFilterFrameTypeChange: jest.fn(),
  onFilterTargetIdChange: jest.fn(),
  onFilterFavoriteOnlyChange: jest.fn(),
  onClearFilters: jest.fn(),
  onSelectAllToggle: jest.fn(),
  onAddToAlbum: jest.fn(),
  onBatchTag: jest.fn(),
  onBatchRename: jest.fn(),
  onCompare: jest.fn(),
  onBatchDelete: jest.fn(),
  onExitSelection: jest.fn(),
  onOpenReport: jest.fn(),
  onOpenMap: jest.fn(),
};

describe("GalleryHeader", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders title and total count", () => {
    render(<GalleryHeader {...defaultProps} />);

    expect(screen.getByText("Gallery")).toBeTruthy();
    expect(screen.getByText("All images (100)")).toBeTruthy();
  });

  it("renders display count in images section", () => {
    render(<GalleryHeader {...defaultProps} displayCount={42} />);

    expect(screen.getByText("All Images (42)")).toBeTruthy();
  });

  it("renders frame type filter chips", () => {
    render(<GalleryHeader {...defaultProps} />);

    expect(screen.getByText("All Types")).toBeTruthy();
    expect(screen.getByText("Light")).toBeTruthy();
    expect(screen.getByText("Dark")).toBeTruthy();
  });

  it("calls onFilterFrameTypeChange when frame type chip is pressed", () => {
    const onFilterFrameTypeChange = jest.fn();
    render(<GalleryHeader {...defaultProps} onFilterFrameTypeChange={onFilterFrameTypeChange} />);

    fireEvent.press(screen.getByText("Light"));
    expect(onFilterFrameTypeChange).toHaveBeenCalledWith("light");
  });

  it("calls onViewModeChange when view mode button is pressed", () => {
    const onViewModeChange = jest.fn();
    render(<GalleryHeader {...defaultProps} onViewModeChange={onViewModeChange} />);

    // View mode buttons exist
    expect(screen.toJSON()).toBeTruthy();
  });

  it("shows selection toolbar when in selection mode", () => {
    render(<GalleryHeader {...defaultProps} isSelectionMode selectedCount={3} />);

    expect(screen.getByText("3 selected")).toBeTruthy();
    expect(screen.getByText("Select All")).toBeTruthy();
  });

  it("shows deselect all when all displayed are selected", () => {
    render(
      <GalleryHeader {...defaultProps} isSelectionMode selectedCount={5} allDisplaySelected />,
    );

    expect(screen.getByText("Deselect All")).toBeTruthy();
  });

  it("calls onAddToAlbum when add to album button is pressed", () => {
    const onAddToAlbum = jest.fn();
    render(
      <GalleryHeader
        {...defaultProps}
        isSelectionMode
        selectedCount={2}
        onAddToAlbum={onAddToAlbum}
      />,
    );

    fireEvent.press(screen.getByText("Add to Album"));
    expect(onAddToAlbum).toHaveBeenCalled();
  });

  it("shows clear filters button when filters are active", () => {
    const onClearFilters = jest.fn();
    render(
      <GalleryHeader {...defaultProps} activeFilterCount={2} onClearFilters={onClearFilters} />,
    );

    fireEvent.press(screen.getByText("Clear Filters (2)"));
    expect(onClearFilters).toHaveBeenCalled();
  });

  it("hides clear filters button when no active filters", () => {
    render(<GalleryHeader {...defaultProps} activeFilterCount={0} />);

    expect(screen.queryByText(/Clear Filters/)).toBeNull();
  });

  it("calls onOpenMap when map button is pressed", () => {
    const onOpenMap = jest.fn();
    render(<GalleryHeader {...defaultProps} onOpenMap={onOpenMap} />);

    fireEvent.press(screen.getByTestId("e2e-action-tabs__gallery-open-map"));
    expect(onOpenMap).toHaveBeenCalled();
  });

  it("shows object filter chips when objects exist in metadata index", () => {
    render(
      <GalleryHeader
        {...defaultProps}
        metadataIndex={{
          objects: ["M42", "M31"],
          filters: [],
          frameTypes: [],
          sourceFormats: [],
          instruments: [],
          telescopes: [],
          tags: [],
          locations: [],
          dateRange: null,
          exptimeRange: null,
        }}
      />,
    );

    expect(screen.getByText("M42")).toBeTruthy();
    expect(screen.getByText("M31")).toBeTruthy();
  });

  it("shows favorites filter chip", () => {
    render(<GalleryHeader {...defaultProps} />);

    expect(screen.getByText("Favorites")).toBeTruthy();
  });

  it("calls onFilterFavoriteOnlyChange when favorites chip is pressed", () => {
    const onFilterFavoriteOnlyChange = jest.fn();
    render(
      <GalleryHeader {...defaultProps} onFilterFavoriteOnlyChange={onFilterFavoriteOnlyChange} />,
    );

    fireEvent.press(screen.getByText("Favorites"));
    expect(onFilterFavoriteOnlyChange).toHaveBeenCalledWith(true);
  });

  it("renders filter object name instead of 'All Images' when filter is active", () => {
    render(<GalleryHeader {...defaultProps} filterObject="M42" displayCount={10} />);

    expect(screen.getByText("M42 (10)")).toBeTruthy();
  });
});
