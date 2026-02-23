import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react-native";
import { PromptDialog } from "../PromptDialog";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

const defaultProps = {
  visible: true,
  title: "Enter Name",
  onConfirm: jest.fn(),
  onCancel: jest.fn(),
};

describe("PromptDialog", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders dialog title", () => {
    render(<PromptDialog {...defaultProps} />);

    expect(screen.getByText("Enter Name")).toBeTruthy();
  });

  it("renders confirm and cancel buttons", () => {
    render(<PromptDialog {...defaultProps} />);

    expect(screen.getByText("common.confirm")).toBeTruthy();
    expect(screen.getByText("common.cancel")).toBeTruthy();
  });

  it("renders with placeholder", () => {
    render(<PromptDialog {...defaultProps} placeholder="Type here..." />);

    expect(screen.toJSON()).toBeTruthy();
  });

  it("renders with defaultValue", () => {
    render(<PromptDialog {...defaultProps} defaultValue="Hello" />);

    expect(screen.toJSON()).toBeTruthy();
  });

  it("calls onCancel when cancel button is pressed", () => {
    render(<PromptDialog {...defaultProps} />);

    fireEvent.press(screen.getByText("common.cancel"));
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onConfirm with trimmed value when confirm is pressed", () => {
    render(<PromptDialog {...defaultProps} defaultValue="  Hello  " />);

    fireEvent.press(screen.getByText("common.confirm"));
    expect(defaultProps.onConfirm).toHaveBeenCalledWith("Hello");
  });

  it("does not call onConfirm with empty value when allowEmpty is false", () => {
    render(<PromptDialog {...defaultProps} defaultValue="" allowEmpty={false} />);

    fireEvent.press(screen.getByText("common.confirm"));
    expect(defaultProps.onConfirm).not.toHaveBeenCalled();
  });

  it("calls onConfirm with empty value when allowEmpty is true", () => {
    render(<PromptDialog {...defaultProps} defaultValue="" allowEmpty={true} />);

    fireEvent.press(screen.getByText("common.confirm"));
    expect(defaultProps.onConfirm).toHaveBeenCalledWith("");
  });

  it("resets value when dialog becomes visible", () => {
    const { rerender } = render(
      <PromptDialog {...defaultProps} visible={false} defaultValue="A" />,
    );

    rerender(<PromptDialog {...defaultProps} visible={true} defaultValue="B" />);

    fireEvent.press(screen.getByText("common.confirm"));
    expect(defaultProps.onConfirm).toHaveBeenCalledWith("B");
  });

  it("updates input text via onChangeText", () => {
    render(<PromptDialog {...defaultProps} defaultValue="" />);

    const input = screen.getByTestId("input");
    act(() => {
      input.props.onChangeText("New Value");
    });

    fireEvent.press(screen.getByText("common.confirm"));
    expect(defaultProps.onConfirm).toHaveBeenCalledWith("New Value");
  });
});
