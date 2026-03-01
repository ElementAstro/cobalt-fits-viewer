import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { OperationSummaryDialog, type SummaryItem } from "../OperationSummaryDialog";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

const baseItems: SummaryItem[] = [
  { label: "Detected", value: 5, color: "accent", icon: "telescope-outline" },
  { label: "Added", value: 3, color: "success", icon: "add-circle-outline" },
  { label: "Skipped", value: 1, color: "default" },
];

describe("OperationSummaryDialog", () => {
  it("passes visible=false to Dialog when not visible", () => {
    const { toJSON } = render(
      <OperationSummaryDialog
        visible={false}
        onClose={jest.fn()}
        title="Summary"
        items={baseItems}
      />,
    );

    // Dialog still renders in DOM but isOpen=false controls visibility
    expect(toJSON()).toBeTruthy();
  });

  it("renders title and all item labels when visible", () => {
    render(
      <OperationSummaryDialog
        visible={true}
        onClose={jest.fn()}
        title="Detection Summary"
        icon="scan-outline"
        status="success"
        items={baseItems}
      />,
    );

    expect(screen.getByText("Detection Summary")).toBeTruthy();
    expect(screen.getByText("Detected")).toBeTruthy();
    expect(screen.getByText("Added")).toBeTruthy();
    expect(screen.getByText("Skipped")).toBeTruthy();
  });

  it("renders item values", () => {
    render(
      <OperationSummaryDialog
        visible={true}
        onClose={jest.fn()}
        title="Summary"
        items={baseItems}
      />,
    );

    expect(screen.getByText("5")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();
  });

  it("renders footnote when provided", () => {
    render(
      <OperationSummaryDialog
        visible={true}
        onClose={jest.fn()}
        title="Summary"
        items={baseItems}
        footnote="No changes detected"
      />,
    );

    expect(screen.getByText("No changes detected")).toBeTruthy();
  });

  it("does not render footnote when not provided", () => {
    render(
      <OperationSummaryDialog
        visible={true}
        onClose={jest.fn()}
        title="Summary"
        items={baseItems}
      />,
    );

    expect(screen.queryByText("No changes detected")).toBeNull();
  });

  it("calls onClose when confirm button is pressed", () => {
    const onClose = jest.fn();
    render(
      <OperationSummaryDialog visible={true} onClose={onClose} title="Summary" items={baseItems} />,
    );

    fireEvent.press(screen.getByText("common.confirm"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders item without icon correctly", () => {
    const itemsNoIcon: SummaryItem[] = [{ label: "NoIcon", value: 10 }];
    render(
      <OperationSummaryDialog
        visible={true}
        onClose={jest.fn()}
        title="Summary"
        items={itemsNoIcon}
      />,
    );

    expect(screen.getByText("NoIcon")).toBeTruthy();
    expect(screen.getByText("10")).toBeTruthy();
  });

  it("renders with default status when not specified", () => {
    render(
      <OperationSummaryDialog
        visible={true}
        onClose={jest.fn()}
        title="Default Status"
        items={baseItems}
      />,
    );

    expect(screen.getByText("Default Status")).toBeTruthy();
  });

  it("renders icon when provided", () => {
    render(
      <OperationSummaryDialog
        visible={true}
        onClose={jest.fn()}
        title="With Icon"
        icon="scan-outline"
        status="success"
        items={baseItems}
      />,
    );

    expect(screen.getByText("With Icon")).toBeTruthy();
  });
});
