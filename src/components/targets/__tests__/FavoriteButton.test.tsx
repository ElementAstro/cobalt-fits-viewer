import React from "react";
import { render, screen } from "@testing-library/react-native";
import { FavoriteButton, PinButton } from "../FavoriteButton";

describe("FavoriteButton", () => {
  it("renders icon-only button in icon mode", () => {
    render(
      <FavoriteButton isFavorite={false} onToggleFavorite={jest.fn()} mode="icon" testID="fav" />,
    );
    const btn = screen.getByTestId("fav");
    expect(btn.props.isIconOnly).toBe(true);
  });

  it("renders checkbox with label in checkbox mode", () => {
    render(
      <FavoriteButton
        isFavorite={false}
        onToggleFavorite={jest.fn()}
        mode="checkbox"
        label="Favorite"
        testID="fav"
      />,
    );
    expect(screen.getByText("Favorite")).toBeTruthy();
  });

  it("calls onToggleFavorite and stops propagation on press", () => {
    const onToggle = jest.fn();
    render(
      <FavoriteButton isFavorite={false} onToggleFavorite={onToggle} mode="icon" testID="fav" />,
    );
    const btn = screen.getByTestId("fav");
    const stopPropagation = jest.fn();
    btn.props.onPress?.({ stopPropagation });
    expect(stopPropagation).toHaveBeenCalled();
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});

describe("PinButton", () => {
  it("renders icon-only button in icon mode", () => {
    render(<PinButton isPinned={false} onTogglePinned={jest.fn()} mode="icon" testID="pin" />);
    const btn = screen.getByTestId("pin");
    expect(btn.props.isIconOnly).toBe(true);
  });

  it("calls onTogglePinned on press", () => {
    const onToggle = jest.fn();
    render(<PinButton isPinned={true} onTogglePinned={onToggle} mode="icon" testID="pin" />);
    const btn = screen.getByTestId("pin");
    const stopPropagation = jest.fn();
    btn.props.onPress?.({ stopPropagation });
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("renders checkbox with label in checkbox mode", () => {
    render(
      <PinButton
        isPinned={true}
        onTogglePinned={jest.fn()}
        mode="checkbox"
        label="Pinned"
        testID="pin"
      />,
    );
    expect(screen.getByText("Pinned")).toBeTruthy();
  });
});
