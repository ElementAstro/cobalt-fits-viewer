import { fireEvent, render, screen } from "@testing-library/react-native";
import { GalleryFilterChips } from "../GalleryFilterChips";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) =>
      (
        ({
          "gallery.allImages": "All Images",
          "gallery.allTypes": "All Types",
          "gallery.favoritesOnly": "Favorites",
        }) as Record<string, string>
      )[key] ?? key,
  }),
}));

jest.mock("expo-linear-gradient", () => ({
  LinearGradient: () => null,
}));

jest.mock("heroui-native", () => {
  const { Pressable, Text, View } = require("react-native");

  const Chip = ({ onPress, children }: any) => <Pressable onPress={onPress}>{children}</Pressable>;
  Chip.Label = ({ children }: any) => <Text>{children}</Text>;

  const ScrollShadow = ({ children }: any) => <View>{children}</View>;

  return {
    Chip,
    ScrollShadow,
    useThemeColor: () => ["#0f0", "#999"],
  };
});

const frameTypes = [
  { key: "light", label: "Light", icon: "sunny-outline" as const },
  { key: "dark", label: "Dark", icon: "moon-outline" as const },
];

describe("GalleryFilterChips", () => {
  const onFilterObjectChange = jest.fn();
  const onFilterFrameTypeChange = jest.fn();
  const onFilterFavoriteOnlyChange = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  const defaultProps = {
    filterObject: "",
    filterFrameType: "",
    filterFavoriteOnly: false,
    objects: ["M31", "M42"] as string[],
    frameTypes,
    onFilterObjectChange,
    onFilterFrameTypeChange,
    onFilterFavoriteOnlyChange,
  };

  it("renders object chips and frame type chips", () => {
    render(<GalleryFilterChips {...defaultProps} />);

    expect(screen.getByText("All Images")).toBeTruthy();
    expect(screen.getByText("M31")).toBeTruthy();
    expect(screen.getByText("M42")).toBeTruthy();
    expect(screen.getByText("All Types")).toBeTruthy();
    expect(screen.getByText("Light")).toBeTruthy();
    expect(screen.getByText("Dark")).toBeTruthy();
    expect(screen.getByText("Favorites")).toBeTruthy();
  });

  it("fires onFilterObjectChange when object chip pressed", () => {
    render(<GalleryFilterChips {...defaultProps} />);

    fireEvent.press(screen.getByText("M31"));
    expect(onFilterObjectChange).toHaveBeenCalledWith("M31");
  });

  it("fires onFilterFrameTypeChange when frame type chip pressed", () => {
    render(<GalleryFilterChips {...defaultProps} />);

    fireEvent.press(screen.getByText("Light"));
    expect(onFilterFrameTypeChange).toHaveBeenCalledWith("light");
  });

  it("fires onFilterFavoriteOnlyChange when favorites chip pressed", () => {
    render(<GalleryFilterChips {...defaultProps} />);

    fireEvent.press(screen.getByText("Favorites"));
    expect(onFilterFavoriteOnlyChange).toHaveBeenCalledWith(true);
  });

  it("renders compact mode with all chips in a single row", () => {
    render(<GalleryFilterChips {...defaultProps} compact />);

    expect(screen.getByText("All Images")).toBeTruthy();
    expect(screen.getByText("M31")).toBeTruthy();
    expect(screen.getByText("All Types")).toBeTruthy();
    expect(screen.getByText("Favorites")).toBeTruthy();
  });

  it("hides object chips when objects array is empty", () => {
    render(<GalleryFilterChips {...defaultProps} objects={[]} />);

    expect(screen.queryByText("All Images")).toBeNull();
    expect(screen.getByText("All Types")).toBeTruthy();
  });

  it("resets object filter when 'All Images' chip pressed", () => {
    render(<GalleryFilterChips {...defaultProps} filterObject="M31" />);

    fireEvent.press(screen.getByText("All Images"));
    expect(onFilterObjectChange).toHaveBeenCalledWith("");
  });
});
