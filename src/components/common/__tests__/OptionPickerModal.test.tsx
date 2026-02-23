import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { OptionPickerModal } from "../OptionPickerModal";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock("../../../hooks/useHapticFeedback", () => ({
  useHapticFeedback: () => ({
    selection: jest.fn(),
    impact: jest.fn(),
    notify: jest.fn(),
  }),
}));

const stringOptions = [
  { label: "Dark", value: "dark" },
  { label: "Light", value: "light" },
  { label: "System", value: "system" },
];

const numberOptions = [
  { label: "Small", value: 12 },
  { label: "Medium", value: 14 },
  { label: "Large", value: 16 },
];

describe("OptionPickerModal", () => {
  const defaultProps = {
    visible: true,
    title: "Choose Theme",
    options: stringOptions,
    selectedValue: "dark" as string,
    onSelect: jest.fn(),
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders dialog title", () => {
    render(<OptionPickerModal {...defaultProps} />);

    expect(screen.getByText("Choose Theme")).toBeTruthy();
  });

  it("renders all option labels", () => {
    render(<OptionPickerModal {...defaultProps} />);

    expect(screen.getByText("Dark")).toBeTruthy();
    expect(screen.getByText("Light")).toBeTruthy();
    expect(screen.getByText("System")).toBeTruthy();
  });

  it("renders close button", () => {
    render(<OptionPickerModal {...defaultProps} />);

    expect(screen.getByText("common.close")).toBeTruthy();
  });

  it("calls onClose when close button is pressed", () => {
    render(<OptionPickerModal {...defaultProps} />);

    fireEvent.press(screen.getByText("common.close"));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it("passes selectedValue to RadioGroup as string", () => {
    render(<OptionPickerModal {...defaultProps} selectedValue="light" />);

    const radioGroup = screen.getByTestId("radio-group");
    expect(radioGroup.props.value).toBe("light");
  });

  it("calls onSelect and onClose when option value changes", () => {
    render(<OptionPickerModal {...defaultProps} />);

    const radioGroup = screen.getByTestId("radio-group");
    radioGroup.props.onValueChange("light");

    expect(defaultProps.onSelect).toHaveBeenCalledWith("light");
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("works with number options", () => {
    render(
      <OptionPickerModal
        visible
        title="Font Size"
        options={numberOptions}
        selectedValue={14}
        onSelect={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByText("Small")).toBeTruthy();
    expect(screen.getByText("Medium")).toBeTruthy();
    expect(screen.getByText("Large")).toBeTruthy();
  });

  it("coerces number values correctly on selection", () => {
    const onSelect = jest.fn();
    render(
      <OptionPickerModal
        visible
        title="Font Size"
        options={numberOptions}
        selectedValue={14}
        onSelect={onSelect}
        onClose={jest.fn()}
      />,
    );

    const radioGroup = screen.getByTestId("radio-group");
    radioGroup.props.onValueChange("16");

    expect(onSelect).toHaveBeenCalledWith(16);
  });

  it("renders dialog structure (Portal, Overlay, Content)", () => {
    render(<OptionPickerModal {...defaultProps} />);

    expect(screen.getByTestId("dialog")).toBeTruthy();
    expect(screen.getByTestId("dialog-portal")).toBeTruthy();
    expect(screen.getByTestId("dialog-overlay")).toBeTruthy();
    expect(screen.getByTestId("dialog-content")).toBeTruthy();
  });

  it("calls onClose when dialog is closed via onOpenChange", () => {
    render(<OptionPickerModal {...defaultProps} />);

    const dialog = screen.getByTestId("dialog");
    dialog.props.onOpenChange(false);

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("does not call onClose when dialog onOpenChange is called with true", () => {
    render(<OptionPickerModal {...defaultProps} />);

    const dialog = screen.getByTestId("dialog");
    dialog.props.onOpenChange(true);

    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });
});
