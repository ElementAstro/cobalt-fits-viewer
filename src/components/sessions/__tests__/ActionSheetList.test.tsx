import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { ActionSheetList } from "../ActionSheetList";
import type { ActionItem } from "../ActionSheetList";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

describe("ActionSheetList", () => {
  const onClose = jest.fn();
  const actions: ActionItem[] = [
    { label: "Edit", icon: "create-outline", onPress: jest.fn() },
    { label: "Delete", icon: "trash-outline", onPress: jest.fn(), destructive: true },
    { label: "Sync", icon: "sync-outline", onPress: jest.fn(), highlight: true },
  ];

  beforeEach(() => jest.clearAllMocks());

  it("renders title and action labels", () => {
    render(<ActionSheetList visible title="Test Sheet" actions={actions} onClose={onClose} />);
    expect(screen.getByText("Test Sheet")).toBeTruthy();
    expect(screen.getByText("Edit")).toBeTruthy();
    expect(screen.getByText("Delete")).toBeTruthy();
    expect(screen.getByText("Sync")).toBeTruthy();
  });

  it("renders cancel button", () => {
    render(<ActionSheetList visible title="Test Sheet" actions={actions} onClose={onClose} />);
    expect(screen.getByText("common.cancel")).toBeTruthy();
  });

  it("calls onClose and action.onPress when action is pressed", () => {
    render(<ActionSheetList visible title="Test Sheet" actions={actions} onClose={onClose} />);
    fireEvent.press(screen.getByText("Edit"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(actions[0].onPress).toHaveBeenCalledTimes(1);
  });

  it("applies destructive styling to destructive actions", () => {
    render(<ActionSheetList visible title="Test Sheet" actions={actions} onClose={onClose} />);
    const deleteText = screen.getByText("Delete");
    expect(deleteText.props.className).toContain("text-red-500");
  });
});
