import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { ChipInputField } from "../ChipInputField";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

describe("ChipInputField", () => {
  const defaultProps = {
    label: "Tags",
    items: ["alpha", "beta"],
    inputValue: "",
    onInputChange: jest.fn(),
    onAdd: jest.fn(),
    onRemove: jest.fn(),
    placeholder: "Add item...",
  };

  beforeEach(() => jest.clearAllMocks());

  it("renders label and existing chips", () => {
    render(<ChipInputField {...defaultProps} />);
    expect(screen.getByText("Tags")).toBeTruthy();
    expect(screen.getByText("alpha ×")).toBeTruthy();
    expect(screen.getByText("beta ×")).toBeTruthy();
  });

  it("renders input with placeholder", () => {
    render(<ChipInputField {...defaultProps} />);
    expect(screen.getByPlaceholderText("Add item...")).toBeTruthy();
  });

  it("calls onRemove when chip is pressed", () => {
    render(<ChipInputField {...defaultProps} />);
    fireEvent.press(screen.getByText("alpha ×"));
    expect(defaultProps.onRemove).toHaveBeenCalledWith("alpha");
  });

  it("calls onAdd on submit editing", () => {
    render(<ChipInputField {...defaultProps} inputValue="gamma" />);
    fireEvent(screen.getByPlaceholderText("Add item..."), "submitEditing");
    expect(defaultProps.onAdd).toHaveBeenCalledTimes(1);
  });

  it("renders empty state without chips", () => {
    render(<ChipInputField {...defaultProps} items={[]} />);
    expect(screen.queryByText("alpha ×")).toBeNull();
  });
});
