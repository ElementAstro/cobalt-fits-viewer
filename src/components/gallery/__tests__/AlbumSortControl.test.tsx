import { fireEvent, render, screen } from "@testing-library/react-native";
import { AlbumSortControl } from "../AlbumSortControl";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) =>
      (
        ({
          "album.sortByDate": "Date",
          "album.sortByName": "Name",
          "album.sortByCount": "Count",
        }) as Record<string, string>
      )[key] ?? key,
  }),
}));

jest.mock("heroui-native", () => {
  const React = require("react");
  const { Pressable, Text } = require("react-native");

  const Button = ({ onPress, children, ...rest }: any) => (
    <Pressable onPress={onPress} testID={rest.testID}>
      {children}
    </Pressable>
  );
  Button.Label = ({ children }: any) => <Text>{children}</Text>;

  const Chip = ({ onPress, children }: any) => <Pressable onPress={onPress}>{children}</Pressable>;
  Chip.Label = ({ children }: any) => <Text>{children}</Text>;

  return {
    Button,
    Chip,
    useThemeColor: () => ["#999", "#0f0"],
  };
});

describe("AlbumSortControl", () => {
  const onSortByChange = jest.fn();
  const onSortOrderChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders all sort options in normal mode", () => {
    render(
      <AlbumSortControl
        sortBy="date"
        sortOrder="desc"
        onSortByChange={onSortByChange}
        onSortOrderChange={onSortOrderChange}
      />,
    );

    expect(screen.getByText("Date")).toBeTruthy();
    expect(screen.getByText("Name")).toBeTruthy();
    expect(screen.getByText("Count")).toBeTruthy();
  });

  it("calls onSortByChange when a sort option is pressed", () => {
    render(
      <AlbumSortControl
        sortBy="date"
        sortOrder="desc"
        onSortByChange={onSortByChange}
        onSortOrderChange={onSortOrderChange}
      />,
    );

    fireEvent.press(screen.getByText("Name"));
    expect(onSortByChange).toHaveBeenCalledWith("name");
  });

  it("toggles sort order from desc to asc", () => {
    render(
      <AlbumSortControl
        sortBy="date"
        sortOrder="desc"
        onSortByChange={onSortByChange}
        onSortOrderChange={onSortOrderChange}
      />,
    );

    fireEvent.press(screen.getByText("arrow-down-outline"));
    expect(onSortOrderChange).toHaveBeenCalledWith("asc");
  });

  it("toggles sort order from asc to desc", () => {
    render(
      <AlbumSortControl
        sortBy="date"
        sortOrder="asc"
        onSortByChange={onSortByChange}
        onSortOrderChange={onSortOrderChange}
      />,
    );

    fireEvent.press(screen.getByText("arrow-up-outline"));
    expect(onSortOrderChange).toHaveBeenCalledWith("desc");
  });

  it("renders compact mode without crashing", () => {
    render(
      <AlbumSortControl
        sortBy="name"
        sortOrder="asc"
        onSortByChange={onSortByChange}
        onSortOrderChange={onSortOrderChange}
        compact
      />,
    );

    // In compact mode, buttons are rendered instead of chips
    expect(screen.toJSON()).toBeTruthy();
  });
});
