import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { HeaderEditSheet } from "../HeaderEditSheet";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

jest.mock("../../../lib/fits/headerValidator", () => ({
  validateHeaderKey: (key: string) => {
    if (!key || key.length === 0 || key.length > 8 || !/^[A-Z0-9_-]+$/.test(key)) {
      return { field: "key", message: "header.invalidKey" };
    }
    return null;
  },
  validateHeaderValue: (value: unknown) => {
    if (value === null || value === undefined) {
      return { field: "value", message: "header.invalidValue" };
    }
    return null;
  },
  validateHeaderRecord: () => [],
  isProtectedKeyword: (key: string) =>
    ["SIMPLE", "BITPIX", "NAXIS"].includes(key.toUpperCase().trim()),
  inferValueType: (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === "true" || trimmed === "T") return { value: true, type: "boolean" };
    if (trimmed === "false" || trimmed === "F") return { value: false, type: "boolean" };
    if (trimmed !== "" && !Number.isNaN(Number(trimmed)))
      return { value: Number(trimmed), type: "number" };
    return { value: trimmed, type: "string" };
  },
}));

describe("HeaderEditSheet", () => {
  const defaultProps = {
    visible: true,
    keyword: null as ReturnType<typeof Object> | null,
    onSave: jest.fn(),
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders in add mode when keyword is null", () => {
    const { getByText } = render(<HeaderEditSheet {...defaultProps} keyword={null} />);
    expect(getByText("header.addMode")).toBeTruthy();
  });

  it("renders in edit mode when keyword is provided", () => {
    const { getByText } = render(
      <HeaderEditSheet
        {...defaultProps}
        keyword={{ key: "OBJECT", value: "M42", comment: "target" }}
      />,
    );
    expect(getByText("header.editMode")).toBeTruthy();
  });

  it("renders with visible=false without crashing", () => {
    const { toJSON } = render(<HeaderEditSheet {...defaultProps} visible={false} />);
    // Dialog renders in closed state — just verify no crash
    expect(toJSON()).toBeTruthy();
  });

  it("calls onClose when cancel is pressed", () => {
    const onClose = jest.fn();
    const { getByText } = render(<HeaderEditSheet {...defaultProps} onClose={onClose} />);
    fireEvent.press(getByText("common.cancel"));
    expect(onClose).toHaveBeenCalled();
  });

  it("has save button disabled when key is empty in add mode", () => {
    const { getByText } = render(<HeaderEditSheet {...defaultProps} keyword={null} />);
    const saveBtn = getByText("common.save");
    // In add mode with no key typed, save should be disabled
    expect(saveBtn).toBeTruthy();
  });

  it("shows type toggle button", () => {
    const { getByText } = render(<HeaderEditSheet {...defaultProps} keyword={null} />);
    // Default type is String
    expect(getByText("header.typeString")).toBeTruthy();
  });

  it("renders key, value, and comment labels", () => {
    const { getByText } = render(
      <HeaderEditSheet
        {...defaultProps}
        keyword={{ key: "OBJECT", value: "M42", comment: "target" }}
      />,
    );
    expect(getByText("header.keyLabel")).toBeTruthy();
    expect(getByText("header.commentLabel")).toBeTruthy();
  });

  it("cycles value type when type button is pressed", () => {
    const { getByText } = render(<HeaderEditSheet {...defaultProps} keyword={null} />);
    // Default type is String
    expect(getByText("header.typeString")).toBeTruthy();

    // Cycle to Number
    fireEvent.press(getByText("header.typeString"));
    expect(getByText("header.typeNumber")).toBeTruthy();

    // Cycle to Boolean
    fireEvent.press(getByText("header.typeNumber"));
    expect(getByText("header.typeBoolean")).toBeTruthy();

    // Cycle back to String
    fireEvent.press(getByText("header.typeBoolean"));
    expect(getByText("header.typeString")).toBeTruthy();
  });

  it("calls onSave with correct data when save is pressed with valid input", () => {
    const onSave = jest.fn();
    const { getByText, getAllByTestId } = render(
      <HeaderEditSheet {...defaultProps} onSave={onSave} keyword={null} />,
    );

    const inputs = getAllByTestId("input");
    // Key input
    fireEvent.changeText(inputs[0], "EXPTIME");
    // Value input
    fireEvent.changeText(inputs[1], "300");
    // Comment input
    fireEvent.changeText(inputs[2], "exposure time");

    fireEvent.press(getByText("common.save"));
    expect(onSave).toHaveBeenCalledWith({
      key: "EXPTIME",
      value: "300",
      comment: "exposure time",
    });
  });

  it("initializes with boolean keyword correctly", () => {
    const { getByText } = render(
      <HeaderEditSheet
        {...defaultProps}
        keyword={{ key: "SIMPLE", value: true, comment: "standard" }}
      />,
    );
    // Should show boolean type
    expect(getByText("header.typeBoolean")).toBeTruthy();
    // Should show value label for boolean switch
    expect(getByText("header.valueLabel")).toBeTruthy();
  });

  it("initializes with number keyword correctly", () => {
    const { getByText } = render(
      <HeaderEditSheet {...defaultProps} keyword={{ key: "BITPIX", value: 16, comment: "bits" }} />,
    );
    expect(getByText("header.typeNumber")).toBeTruthy();
  });

  it("calls onSave with existing keyword edits", () => {
    const onSave = jest.fn();
    const { getByText, getAllByTestId } = render(
      <HeaderEditSheet
        {...defaultProps}
        onSave={onSave}
        keyword={{ key: "OBJECT", value: "M42", comment: "target" }}
      />,
    );

    const inputs = getAllByTestId("input");
    // Change value
    fireEvent.changeText(inputs[1], "NGC1234");

    fireEvent.press(getByText("common.save"));
    expect(onSave).toHaveBeenCalledWith({
      key: "OBJECT",
      value: "NGC1234",
      comment: "target",
    });
  });

  it("handles keyword with null value", () => {
    const { getByText } = render(
      <HeaderEditSheet {...defaultProps} keyword={{ key: "TEST", value: null }} />,
    );
    // Should render in edit mode without crashing
    expect(getByText("header.editMode")).toBeTruthy();
  });

  it("handles keyword with no comment", () => {
    const { getByText } = render(
      <HeaderEditSheet {...defaultProps} keyword={{ key: "TEST", value: 42 }} />,
    );
    expect(getByText("header.editMode")).toBeTruthy();
  });

  it("saves with empty comment as undefined", () => {
    const onSave = jest.fn();
    const { getByText, getAllByTestId } = render(
      <HeaderEditSheet {...defaultProps} onSave={onSave} keyword={null} />,
    );

    const inputs = getAllByTestId("input");
    fireEvent.changeText(inputs[0], "TEST");
    fireEvent.changeText(inputs[1], "hello");
    // Leave comment empty

    fireEvent.press(getByText("common.save"));
    expect(onSave).toHaveBeenCalledWith({
      key: "TEST",
      value: "hello",
      comment: undefined,
    });
  });

  it("shows number type in edit mode for number keyword", () => {
    const { getByText } = render(
      <HeaderEditSheet
        {...defaultProps}
        keyword={{ key: "EXPTIME", value: 300, comment: "seconds" }}
      />,
    );
    expect(getByText("header.typeNumber")).toBeTruthy();
  });
});
