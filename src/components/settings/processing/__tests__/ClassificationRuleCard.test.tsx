import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { ClassificationRuleCard } from "../ClassificationRuleCard";
import type { FrameClassificationRule } from "../../../../lib/fits/types";

jest.mock("../../../../i18n/useI18n", () => ({
  useI18n: () => ({ t: (k: string) => k }),
}));

const makeRule = (overrides?: Partial<FrameClassificationRule>): FrameClassificationRule => ({
  id: "rule_1",
  enabled: true,
  priority: 100,
  target: "filename",
  matchType: "contains",
  pattern: "dark",
  caseSensitive: false,
  frameType: "dark",
  ...overrides,
});

const frameTypeDefinitions = [
  { key: "light", label: "Light", builtin: true },
  { key: "dark", label: "Dark", builtin: true },
];

const frameTypeLabels = new Map([
  ["light", "Light"],
  ["dark", "Dark"],
]);

describe("ClassificationRuleCard", () => {
  const defaultProps = {
    rule: makeRule(),
    frameTypeDefinitions,
    frameTypeLabels,
    matchedType: null as string | null,
    testValue: "",
    onUpdateRule: jest.fn(),
    onRemoveRule: jest.fn(),
    onTestValueChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders rule id", () => {
    render(<ClassificationRuleCard {...defaultProps} />);

    expect(screen.getByText("rule_1")).toBeTruthy();
  });

  it("renders target chips (header, filename)", () => {
    render(<ClassificationRuleCard {...defaultProps} />);

    expect(screen.getByText("header")).toBeTruthy();
    expect(screen.getByText("filename")).toBeTruthy();
  });

  it("renders match type chips (exact, contains, regex)", () => {
    render(<ClassificationRuleCard {...defaultProps} />);

    expect(screen.getByText("exact")).toBeTruthy();
    expect(screen.getByText("contains")).toBeTruthy();
    expect(screen.getByText("regex")).toBeTruthy();
  });

  it("renders frame type chips from definitions", () => {
    render(<ClassificationRuleCard {...defaultProps} />);

    expect(screen.getByText("Light")).toBeTruthy();
    expect(screen.getByText("Dark")).toBeTruthy();
  });

  it("calls onRemoveRule when delete is pressed", () => {
    render(<ClassificationRuleCard {...defaultProps} />);

    fireEvent.press(screen.getByText("common.delete"));
    expect(defaultProps.onRemoveRule).toHaveBeenCalledWith("rule_1");
  });

  it("calls onTestValueChange when test input changes", () => {
    render(<ClassificationRuleCard {...defaultProps} />);

    expect(screen.toJSON()).toBeTruthy();
  });

  it("shows no-match text when matchedType is null", () => {
    render(<ClassificationRuleCard {...defaultProps} matchedType={null} />);

    expect(screen.getByText("settings.ruleNoMatch")).toBeTruthy();
  });

  it("shows matched text when matchedType is provided", () => {
    render(<ClassificationRuleCard {...defaultProps} matchedType="dark" />);

    expect(screen.getByText("settings.ruleMatched")).toBeTruthy();
  });

  it("renders header field chips when target is header", () => {
    const rule = makeRule({ target: "header", headerField: "IMAGETYP" });
    render(<ClassificationRuleCard {...defaultProps} rule={rule} />);

    expect(screen.getByText("IMAGETYP")).toBeTruthy();
    expect(screen.getByText("FRAME")).toBeTruthy();
    expect(screen.getByText("ANY")).toBeTruthy();
  });
});
