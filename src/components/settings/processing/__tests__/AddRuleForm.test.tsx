import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { AddRuleForm } from "../AddRuleForm";

jest.mock("../../../../i18n/useI18n", () => ({
  useI18n: () => ({ t: (k: string) => k }),
}));

const frameTypeDefinitions = [
  { key: "light", label: "Light", builtin: true },
  { key: "dark", label: "Dark", builtin: true },
];

const frameTypeLabels = new Map([
  ["light", "Light"],
  ["dark", "Dark"],
]);

describe("AddRuleForm", () => {
  const defaultProps = {
    frameTypeDefinitions,
    frameTypeLabels,
    newRuleTarget: "filename" as const,
    newRuleMatchType: "contains" as const,
    newRuleHeaderField: "ANY" as const,
    newRulePattern: "",
    newRuleFrameType: "light",
    newRulePriority: "100",
    newRuleCaseSensitive: false,
    onTargetChange: jest.fn(),
    onMatchTypeChange: jest.fn(),
    onHeaderFieldChange: jest.fn(),
    onPatternChange: jest.fn(),
    onFrameTypeChange: jest.fn(),
    onPriorityChange: jest.fn(),
    onCaseSensitiveChange: jest.fn(),
    onAddRule: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders add rule title", () => {
    render(<AddRuleForm {...defaultProps} />);

    expect(screen.getAllByText("settings.addRule").length).toBeGreaterThanOrEqual(1);
  });

  it("renders target chips", () => {
    render(<AddRuleForm {...defaultProps} />);

    expect(screen.getByText("header")).toBeTruthy();
    expect(screen.getByText("filename")).toBeTruthy();
  });

  it("renders match type chips", () => {
    render(<AddRuleForm {...defaultProps} />);

    expect(screen.getByText("exact")).toBeTruthy();
    expect(screen.getByText("contains")).toBeTruthy();
    expect(screen.getByText("regex")).toBeTruthy();
  });

  it("renders frame type chips from definitions", () => {
    render(<AddRuleForm {...defaultProps} />);

    expect(screen.getByText("Light")).toBeTruthy();
    expect(screen.getByText("Dark")).toBeTruthy();
  });

  it("calls onTargetChange when target chip is pressed", () => {
    render(<AddRuleForm {...defaultProps} />);

    fireEvent.press(screen.getByText("header"));
    expect(defaultProps.onTargetChange).toHaveBeenCalledWith("header");
  });

  it("calls onMatchTypeChange when match type chip is pressed", () => {
    render(<AddRuleForm {...defaultProps} />);

    fireEvent.press(screen.getByText("exact"));
    expect(defaultProps.onMatchTypeChange).toHaveBeenCalledWith("exact");
  });

  it("calls onAddRule when add button is pressed", () => {
    render(<AddRuleForm {...defaultProps} />);

    const addButtons = screen.getAllByText("settings.addRule");
    fireEvent.press(addButtons[addButtons.length - 1]);
    expect(defaultProps.onAddRule).toHaveBeenCalledTimes(1);
  });

  it("renders header field chips when target is header", () => {
    render(<AddRuleForm {...defaultProps} newRuleTarget="header" />);

    expect(screen.getByText("IMAGETYP")).toBeTruthy();
    expect(screen.getByText("FRAME")).toBeTruthy();
    expect(screen.getByText("ANY")).toBeTruthy();
  });

  it("does not render header field chips when target is filename", () => {
    render(<AddRuleForm {...defaultProps} newRuleTarget="filename" />);

    expect(screen.queryByText("IMAGETYP")).toBeNull();
  });
});
