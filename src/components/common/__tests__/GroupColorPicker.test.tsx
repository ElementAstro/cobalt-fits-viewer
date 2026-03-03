import { fireEvent, render, screen } from "@testing-library/react-native";
import { GroupColorPicker, GROUP_COLORS } from "../GroupColorPicker";

jest.mock("heroui-native", () => {
  const { Pressable } = require("react-native");
  const Button = ({ onPress, children, variant }: any) => (
    <Pressable onPress={onPress} testID={`color-btn-${variant}`}>
      {children}
    </Pressable>
  );
  Button.Label = ({ children }: any) => children;
  return { Button };
});

describe("GroupColorPicker", () => {
  it("renders all color options", () => {
    const onSelect = jest.fn();
    render(<GroupColorPicker selectedColor={GROUP_COLORS[0]} onSelect={onSelect} />);
    const buttons = screen.getAllByTestId(/color-btn/);
    expect(buttons.length).toBe(GROUP_COLORS.length);
  });

  it("calls onSelect when a color is pressed", () => {
    const onSelect = jest.fn();
    render(<GroupColorPicker selectedColor={GROUP_COLORS[0]} onSelect={onSelect} />);
    const buttons = screen.getAllByTestId(/color-btn/);
    fireEvent.press(buttons[2]);
    expect(onSelect).toHaveBeenCalledWith(GROUP_COLORS[2]);
  });

  it("marks selected color with primary variant", () => {
    const onSelect = jest.fn();
    render(<GroupColorPicker selectedColor={GROUP_COLORS[1]} onSelect={onSelect} />);
    expect(screen.getAllByTestId("color-btn-primary")).toHaveLength(1);
  });
});
