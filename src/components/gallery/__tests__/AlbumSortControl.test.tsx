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

  const Popover = ({ children }: any) => <>{children}</>;
  Popover.Trigger = ({ children }: any) => <>{children}</>;
  Popover.Portal = ({ children }: any) => <>{children}</>;
  Popover.Overlay = () => null;
  Popover.Content = ({ children }: any) => <>{children}</>;
  Popover.Title = ({ children }: any) => <Text>{children}</Text>;

  const PressableFeedback = ({ onPress, children }: any) => (
    <Pressable onPress={onPress}>{children}</Pressable>
  );
  PressableFeedback.Highlight = () => null;

  return {
    Button,
    Chip,
    Popover,
    PressableFeedback,
    Separator: () => null,
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

    expect(screen.getAllByText("Date").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Name").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Count").length).toBeGreaterThanOrEqual(1);
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

    const icons = screen.getAllByText("arrow-down-outline");
    fireEvent.press(icons[icons.length - 1]);
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

    const icons = screen.getAllByText("arrow-up-outline");
    fireEvent.press(icons[icons.length - 1]);
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
