import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { CategorySelector } from "../CategorySelector";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

describe("CategorySelector", () => {
  it("renders default categories", () => {
    render(<CategorySelector allCategories={[]} onSelect={jest.fn()} />);
    expect(screen.getByText("Deep Sky")).toBeTruthy();
    expect(screen.getByText("Solar System")).toBeTruthy();
  });

  it("merges custom categories with defaults", () => {
    render(<CategorySelector allCategories={["Custom Cat"]} onSelect={jest.fn()} />);
    expect(screen.getByText("Custom Cat")).toBeTruthy();
    expect(screen.getByText("Deep Sky")).toBeTruthy();
  });

  it("calls onSelect with category on press", () => {
    const onSelect = jest.fn();
    render(<CategorySelector allCategories={[]} onSelect={onSelect} />);
    fireEvent.press(screen.getByText("Deep Sky"));
    expect(onSelect).toHaveBeenCalledWith("Deep Sky");
  });

  it("deselects category when pressing selected category", () => {
    const onSelect = jest.fn();
    render(<CategorySelector allCategories={[]} selectedCategory="Deep Sky" onSelect={onSelect} />);
    fireEvent.press(screen.getByText("Deep Sky"));
    expect(onSelect).toHaveBeenCalledWith(undefined);
  });

  it("shows custom input when add button is pressed", () => {
    render(<CategorySelector allCategories={[]} onSelect={jest.fn()} />);
    const buttons = screen.getAllByTestId("button");
    // Last chip-area button is the "+" add button
    const addButton = buttons[buttons.length - 1];
    fireEvent.press(addButton);
    expect(screen.getByPlaceholderText("targets.addCategory")).toBeTruthy();
  });

  it("hides custom input when showCustomInput is false", () => {
    render(<CategorySelector allCategories={[]} onSelect={jest.fn()} showCustomInput={false} />);
    // No add button should be visible
    expect(screen.queryByPlaceholderText("targets.addCategory")).toBeNull();
  });
});
