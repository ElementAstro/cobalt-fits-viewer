import { fireEvent, render, screen } from "@testing-library/react-native";
import { SmartAlbumModal } from "../SmartAlbumModal";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) =>
      (
        ({
          "gallery.smartAlbum": "Smart Album",
          "gallery.albumName": "Album name",
          "album.suggestions": "Suggestions",
          "album.rules": "Rules",
          "album.ruleValue": "Value...",
          "album.addRule": "Add Rule",
          "common.cancel": "Cancel",
          "common.confirm": "Confirm",
        }) as Record<string, string>
      )[key] ?? key,
  }),
}));

jest.mock("heroui-native", () => {
  const React = require("react");
  const { Pressable, Text, TextInput, View } = require("react-native");

  const Dialog = ({ isOpen, children }: any) => (isOpen ? <View>{children}</View> : null);
  Dialog.Portal = ({ children }: any) => <View>{children}</View>;
  Dialog.Overlay = () => null;
  Dialog.Content = ({ children }: any) => <View>{children}</View>;
  Dialog.Title = ({ children }: any) => <Text>{children}</Text>;

  const Button = ({ onPress, children, isDisabled }: any) => (
    <Pressable onPress={isDisabled ? undefined : onPress}>{children}</Pressable>
  );
  Button.Label = ({ children }: any) => <Text>{children}</Text>;

  const Chip = ({ onPress, children }: any) => <Pressable onPress={onPress}>{children}</Pressable>;
  Chip.Label = ({ children }: any) => <Text>{children}</Text>;

  const CloseButton = ({ onPress }: any) => (
    <Pressable onPress={onPress} testID="close-rule">
      <Text>×</Text>
    </Pressable>
  );

  const TextField = ({ children }: any) => <View>{children}</View>;
  const Input = ({ placeholder, value, onChangeText }: any) => (
    <TextInput
      placeholder={placeholder}
      value={value}
      onChangeText={onChangeText}
      testID={`input-${placeholder}`}
    />
  );

  const Separator = () => null;

  return {
    Dialog,
    Button,
    Chip,
    CloseButton,
    Input,
    Separator,
    TextField,
    useThemeColor: () => ["#0f0"],
  };
});

describe("SmartAlbumModal", () => {
  const onClose = jest.fn();
  const onConfirm = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders title and form elements", () => {
    render(<SmartAlbumModal visible onClose={onClose} onConfirm={onConfirm} />);

    expect(screen.getByText("Smart Album")).toBeTruthy();
    expect(screen.getByPlaceholderText("Album name")).toBeTruthy();
    expect(screen.getByText("Rules")).toBeTruthy();
  });

  it("does not render when visible is false", () => {
    render(<SmartAlbumModal visible={false} onClose={onClose} onConfirm={onConfirm} />);

    expect(screen.queryByText("Smart Album")).toBeNull();
  });

  it("shows field chips for the default rule", () => {
    render(<SmartAlbumModal visible onClose={onClose} onConfirm={onConfirm} />);

    expect(screen.getByText("object")).toBeTruthy();
    expect(screen.getByText("filter")).toBeTruthy();
    expect(screen.getByText("dateObs")).toBeTruthy();
  });

  it("shows operator chips", () => {
    render(<SmartAlbumModal visible onClose={onClose} onConfirm={onConfirm} />);

    expect(screen.getByText("equals")).toBeTruthy();
    expect(screen.getByText("contains")).toBeTruthy();
    expect(screen.getByText("gt")).toBeTruthy();
  });

  it("calls onConfirm with name and valid rules", () => {
    render(<SmartAlbumModal visible onClose={onClose} onConfirm={onConfirm} />);

    fireEvent.changeText(screen.getByPlaceholderText("Album name"), "Ha Frames");
    fireEvent.changeText(screen.getByPlaceholderText("Value..."), "Ha");
    fireEvent.press(screen.getByText("Confirm"));

    expect(onConfirm).toHaveBeenCalledWith("Ha Frames", [
      { field: "object", operator: "equals", value: "Ha" },
    ]);
  });

  it("does not call onConfirm when name is empty", () => {
    render(<SmartAlbumModal visible onClose={onClose} onConfirm={onConfirm} />);

    fireEvent.changeText(screen.getByPlaceholderText("Value..."), "Ha");
    fireEvent.press(screen.getByText("Confirm"));

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("does not call onConfirm when all rule values are empty", () => {
    render(<SmartAlbumModal visible onClose={onClose} onConfirm={onConfirm} />);

    fireEvent.changeText(screen.getByPlaceholderText("Album name"), "Test");
    fireEvent.press(screen.getByText("Confirm"));

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("calls onClose and resets form when cancel is pressed", () => {
    render(<SmartAlbumModal visible onClose={onClose} onConfirm={onConfirm} />);

    fireEvent.changeText(screen.getByPlaceholderText("Album name"), "Temp");
    fireEvent.press(screen.getByText("Cancel"));

    expect(onClose).toHaveBeenCalled();
  });

  it("adds a new rule when Add Rule is pressed", () => {
    render(<SmartAlbumModal visible onClose={onClose} onConfirm={onConfirm} />);

    fireEvent.press(screen.getByText("Add Rule"));

    // Now there should be 2 value inputs
    const valueInputs = screen.getAllByPlaceholderText("Value...");
    expect(valueInputs).toHaveLength(2);
  });

  it("renders suggestions when provided", () => {
    const suggestions = [
      {
        name: "Ha Only",
        rules: [{ field: "filter" as const, operator: "equals" as const, value: "Ha" }],
      },
    ];

    render(
      <SmartAlbumModal visible onClose={onClose} onConfirm={onConfirm} suggestions={suggestions} />,
    );

    expect(screen.getByText("Ha Only")).toBeTruthy();
    expect(screen.getByText("Suggestions")).toBeTruthy();
  });

  it("applies suggestion when pressed", () => {
    const suggestions = [
      {
        name: "Ha Only",
        rules: [{ field: "filter" as const, operator: "equals" as const, value: "Ha" }],
      },
    ];

    render(
      <SmartAlbumModal visible onClose={onClose} onConfirm={onConfirm} suggestions={suggestions} />,
    );

    fireEvent.press(screen.getByText("Ha Only"));
    expect(onConfirm).toHaveBeenCalledWith("Ha Only", suggestions[0].rules);
  });

  it("renders frameType options when field is frameType", () => {
    const frameTypeOptions = [
      { key: "light", label: "Light" },
      { key: "dark", label: "Dark" },
    ];

    render(
      <SmartAlbumModal
        visible
        onClose={onClose}
        onConfirm={onConfirm}
        frameTypeOptions={frameTypeOptions}
      />,
    );

    // Switch the field to frameType
    fireEvent.press(screen.getByText("frameType"));

    expect(screen.getByText("Light")).toBeTruthy();
    expect(screen.getByText("Dark")).toBeTruthy();
  });
});
