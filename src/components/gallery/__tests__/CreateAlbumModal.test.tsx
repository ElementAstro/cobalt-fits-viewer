import { fireEvent, render, screen } from "@testing-library/react-native";
import { CreateAlbumModal } from "../CreateAlbumModal";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) =>
      (
        ({
          "gallery.createAlbum": "Create Album",
          "gallery.albumName": "Album name",
          "gallery.albumDescription": "Description (optional)",
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

  const TextField = ({ children }: any) => <View>{children}</View>;
  const Input = ({ placeholder, value, onChangeText, ...rest }: any) => (
    <TextInput
      placeholder={placeholder}
      value={value}
      onChangeText={onChangeText}
      testID={rest.testID ?? `input-${placeholder}`}
    />
  );
  const TextArea = ({ placeholder, value, onChangeText }: any) => (
    <TextInput
      placeholder={placeholder}
      value={value}
      onChangeText={onChangeText}
      testID={`textarea-${placeholder}`}
      multiline
    />
  );

  return { Dialog, Button, Input, TextArea, TextField };
});

describe("CreateAlbumModal", () => {
  const onClose = jest.fn();
  const onConfirm = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders title and input fields", () => {
    render(<CreateAlbumModal visible onClose={onClose} onConfirm={onConfirm} />);

    expect(screen.getByText("Create Album")).toBeTruthy();
    expect(screen.getByPlaceholderText("Album name")).toBeTruthy();
    expect(screen.getByPlaceholderText("Description (optional)")).toBeTruthy();
  });

  it("does not render when visible is false", () => {
    render(<CreateAlbumModal visible={false} onClose={onClose} onConfirm={onConfirm} />);

    expect(screen.queryByText("Create Album")).toBeNull();
  });

  it("calls onConfirm with trimmed name when confirm is pressed", () => {
    render(<CreateAlbumModal visible onClose={onClose} onConfirm={onConfirm} />);

    fireEvent.changeText(screen.getByPlaceholderText("Album name"), "  My Album  ");
    fireEvent.press(screen.getByText("Confirm"));

    expect(onConfirm).toHaveBeenCalledWith("My Album", undefined);
  });

  it("calls onConfirm with description when provided", () => {
    render(<CreateAlbumModal visible onClose={onClose} onConfirm={onConfirm} />);

    fireEvent.changeText(screen.getByPlaceholderText("Album name"), "Nebula");
    fireEvent.changeText(screen.getByPlaceholderText("Description (optional)"), "Orion shots");
    fireEvent.press(screen.getByText("Confirm"));

    expect(onConfirm).toHaveBeenCalledWith("Nebula", "Orion shots");
  });

  it("does not call onConfirm when name is empty", () => {
    render(<CreateAlbumModal visible onClose={onClose} onConfirm={onConfirm} />);

    fireEvent.press(screen.getByText("Confirm"));

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("does not call onConfirm when name is only whitespace", () => {
    render(<CreateAlbumModal visible onClose={onClose} onConfirm={onConfirm} />);

    fireEvent.changeText(screen.getByPlaceholderText("Album name"), "   ");
    fireEvent.press(screen.getByText("Confirm"));

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("calls onClose and resets state when cancel is pressed", () => {
    render(<CreateAlbumModal visible onClose={onClose} onConfirm={onConfirm} />);

    fireEvent.changeText(screen.getByPlaceholderText("Album name"), "Temp");
    fireEvent.press(screen.getByText("Cancel"));

    expect(onClose).toHaveBeenCalled();
    expect(screen.getByPlaceholderText("Album name").props.value).toBe("");
  });

  it("resets inputs after successful confirm", () => {
    render(<CreateAlbumModal visible onClose={onClose} onConfirm={onConfirm} />);

    fireEvent.changeText(screen.getByPlaceholderText("Album name"), "Test");
    fireEvent.press(screen.getByText("Confirm"));

    expect(screen.getByPlaceholderText("Album name").props.value).toBe("");
  });
});
