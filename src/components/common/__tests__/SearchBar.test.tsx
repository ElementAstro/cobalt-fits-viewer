import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { SearchBar } from "../SearchBar";

describe("SearchBar", () => {
  it("renders in default (non-compact) mode", () => {
    render(<SearchBar value="" onChangeText={jest.fn()} />);
    expect(screen.toJSON()).toBeTruthy();
  });

  it("renders in compact mode", () => {
    render(<SearchBar value="" onChangeText={jest.fn()} compact />);
    expect(screen.toJSON()).toBeTruthy();
  });

  it("renders placeholder text", () => {
    render(<SearchBar value="" onChangeText={jest.fn()} placeholder="Search files..." />);
    expect(screen.toJSON()).toBeTruthy();
  });

  it("calls onChangeText when input value changes", () => {
    const onChangeText = jest.fn();
    render(<SearchBar value="" onChangeText={onChangeText} />);

    const input = screen.getByTestId("input");
    fireEvent.changeText(input, "test query");
    expect(onChangeText).toHaveBeenCalledWith("test query");
  });

  it("shows clear button when value is non-empty in default mode", () => {
    const onChangeText = jest.fn();
    render(<SearchBar value="test" onChangeText={onChangeText} />);

    // Clear button icon is "close-circle"
    const closeIcon = screen.getByText("close-circle");
    expect(closeIcon).toBeTruthy();
  });

  it("hides clear button when value is empty", () => {
    render(<SearchBar value="" onChangeText={jest.fn()} />);

    expect(screen.queryByText("close-circle")).toBeNull();
  });

  it("calls onChangeText with empty string when clear button is pressed in default mode", () => {
    const onChangeText = jest.fn();
    render(<SearchBar value="test" onChangeText={onChangeText} />);

    // Find the button containing close-circle icon and press its parent
    const clearButtons = screen.getAllByTestId("button");
    fireEvent.press(clearButtons[0]);
    expect(onChangeText).toHaveBeenCalledWith("");
  });

  it("shows clear button in compact mode when value is non-empty", () => {
    render(<SearchBar value="abc" onChangeText={jest.fn()} compact />);

    expect(screen.getByText("close-circle")).toBeTruthy();
  });

  it("calls onChangeText with empty string when clear button is pressed in compact mode", () => {
    const onChangeText = jest.fn();
    render(<SearchBar value="abc" onChangeText={onChangeText} compact />);

    const clearButtons = screen.getAllByTestId("button");
    fireEvent.press(clearButtons[0]);
    expect(onChangeText).toHaveBeenCalledWith("");
  });

  it("renders search icon", () => {
    render(<SearchBar value="" onChangeText={jest.fn()} />);
    expect(screen.getByText("search-outline")).toBeTruthy();
  });
});
