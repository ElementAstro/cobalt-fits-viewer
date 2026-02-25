import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { GroupColorPicker } from "../GroupColorPicker";
import { GROUP_COLORS } from "../../../lib/targets/targetConstants";

describe("GroupColorPicker", () => {
  it("renders a button for each color in GROUP_COLORS", () => {
    render(<GroupColorPicker selectedColor={GROUP_COLORS[0]} onSelect={jest.fn()} />);
    const buttons = screen.getAllByTestId("button");
    expect(buttons).toHaveLength(GROUP_COLORS.length);
  });

  it("calls onSelect with the pressed color", () => {
    const onSelect = jest.fn();
    render(<GroupColorPicker selectedColor={GROUP_COLORS[0]} onSelect={onSelect} />);
    const buttons = screen.getAllByTestId("button");
    fireEvent.press(buttons[2]);
    expect(onSelect).toHaveBeenCalledWith(GROUP_COLORS[2]);
  });

  it("highlights the selected color with primary variant", () => {
    render(<GroupColorPicker selectedColor={GROUP_COLORS[3]} onSelect={jest.fn()} />);
    const buttons = screen.getAllByTestId("button");
    expect(buttons[3].props.variant).toBe("primary");
    expect(buttons[0].props.variant).toBe("outline");
  });
});
